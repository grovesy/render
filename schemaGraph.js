// schemaGraph.js
// Build a graph description from JSON Schema files for the UML front-end.
//
// Output shape for /graph:
//
// {
//   entities: [
//     {
//       domain: "contact.org.biz",
//       model: "address",
//       title: "Address",
//       attrs: [
//          { field: "addressId", type: "string" },
//          { field: "address.line1", type: "string" },
//          ...
//       ],
//       refs:  [{ field: "owners", ref: "data://contact.org.biz/model/1/contact" }]
//     },
//     ...
//   ]
// }

const fs = require("fs");
const path = require("path");

// ----------------- helpers -----------------

function parseSchemaId(idStr) {
  // data://<domain1>.<domain2>.<domain3>/model/version/model-name
  if (!idStr || !idStr.startsWith("data://")) {
    throw new Error(`Unsupported id format: ${idStr}`);
  }

  const without = idStr.substring("data://".length);
  const [domain, rest] = without.split("/model/");
  if (!domain || !rest) {
    throw new Error(`Cannot parse id: ${idStr}`);
  }
  const [version, modelName] = rest.split("/");
  return { domain, version, modelName };
}

function inferTypeForProperty(node) {
  if (!node || typeof node !== "object") return "any";

  if (node.type === "array") {
    const items = node.items || {};
    let inner = "any";

    if (items.$ref) {
      inner = "ref";
    } else if (items.type) {
      inner = Array.isArray(items.type) ? items.type.join("|") : items.type;
    } else {
      inner = "any";
    }

    return `array<${inner}>`;
  }

  if (node.$ref) return "ref";

  if (node.type) {
    return Array.isArray(node.type) ? node.type.join("|") : node.type;
  }

  if (node.enum) return "enum";

  return "any";
}

/**
 * Recursively collect all $ref nodes under `schemaNode`,
 * attributing them to the *fieldPath* (top-level or nested).
 *
 * Covers:
 *   - direct $ref on the property
 *   - $ref inside array items
 *   - $ref nested inside object properties in that property
 *   - $ref inside allOf / oneOf / anyOf inside that property
 */
function collectRefs(schemaNode, fieldPath, outRefs) {
  if (!schemaNode || typeof schemaNode !== "object") return;

  if (schemaNode.$ref && typeof schemaNode.$ref === "string") {
    outRefs.push({ field: fieldPath, ref: schemaNode.$ref });
  }

  // Arrays: recurse into items
  if (schemaNode.type === "array" && schemaNode.items) {
    collectRefs(schemaNode.items, fieldPath, outRefs);
  }

  // Nested object properties
  if (schemaNode.properties && typeof schemaNode.properties === "object") {
    Object.entries(schemaNode.properties).forEach(([name, child]) => {
      const nestedPath = fieldPath ? `${fieldPath}.${name}` : name;
      collectRefs(child, nestedPath, outRefs);
    });
  }

  // Composition keywords
  ["allOf", "anyOf", "oneOf"].forEach(key => {
    if (Array.isArray(schemaNode[key])) {
      schemaNode[key].forEach(child => collectRefs(child, fieldPath, outRefs));
    }
  });
}

/**
 * Recursively flatten attributes from a "properties" block.
 *
 * - prefix "" => "address"
 * - prefix "address" + child "line1" => "address.line1"
 *
 * Also handles arrays whose items are objects:
 *   orders[].amount, orders[].currency, etc.
 */
function collectAttributes(props, prefix, attrsOut, refsOut) {
  if (!props || typeof props !== "object") return;

  Object.entries(props).forEach(([name, propSchema]) => {
    const fieldPath = prefix ? `${prefix}.${name}` : name;

    // Attribute for this property itself
    const typeLabel = inferTypeForProperty(propSchema);
    attrsOut.push({ field: fieldPath, type: typeLabel });

    // Foreign keys anywhere under this property
    collectRefs(propSchema, fieldPath, refsOut);

    // Flatten nested object properties
    if (propSchema && propSchema.type === "object" && propSchema.properties) {
      collectAttributes(propSchema.properties, fieldPath, attrsOut, refsOut);
    }

    // Flatten arrays-of-objects: orders[].amount, etc.
    if (
      propSchema &&
      propSchema.type === "array" &&
      propSchema.items &&
      propSchema.items.type === "object" &&
      propSchema.items.properties
    ) {
      const arrayPrefix = fieldPath + "[]";
      collectAttributes(propSchema.items.properties, arrayPrefix, attrsOut, refsOut);
    }
  });
}

// ----------------- load schemas -----------------

function loadSchemasFromDir(dirPaths) {
  const schemas = [];

  const walk = p => {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      const entries = fs.readdirSync(p);
      for (const name of entries) {
        walk(path.join(p, name));
      }
    } else if (stat.isFile() && p.toLowerCase().endsWith(".json")) {
      try {
        const text = fs.readFileSync(p, "utf8");
        const data = JSON.parse(text);
        schemas.push(data);
      } catch (err) {
        console.warn(`Warning: failed to read/parse ${p}:`, err.message);
      }
    }
  };

  dirPaths.forEach(walk);
  return schemas;
}

// ----------------- build graph -----------------

function buildGraphFromSchemas(schemaDirs) {
  const schemas = loadSchemasFromDir(schemaDirs);
  const entities = [];

  for (const schema of schemas) {
    const idStr = schema.$id || schema.id;
    if (!idStr) continue;

    let parsed;
    try {
      parsed = parseSchemaId(idStr);
    } catch (e) {
      console.warn(`Skipping schema with bad id: ${idStr} (${e.message})`);
      continue;
    }

    const { domain, modelName } = parsed;
    const title = schema.title || modelName;

    const attrs = [];
    const refs = [];

    // Flatten top-level + nested properties
    if (schema.properties && typeof schema.properties === "object") {
      collectAttributes(schema.properties, "", attrs, refs);
    }

    // ---- DEDUPE refs, normalizing array paths ----
    // Treat "owners" and "owners[]" (and any field with [] segments) as
    // the same FK for dedupe purposes, so we don't get double edges.
    const seen = new Set();
    const dedupedRefs = [];
    for (const r of refs) {
      if (!r || !r.ref) continue;

      const rawField = typeof r.field === "string" ? r.field : "";
      const normField = rawField.replace(/\[\]/g, ""); // strip [] anywhere

      const key = `${normField}||${r.ref}`;
      if (seen.has(key)) continue;
      seen.add(key);

      dedupedRefs.push({
        field: normField, // use clean label in the diagram
        ref: r.ref
      });
    }

    entities.push({
      domain,
      model: modelName,
      title,
      attrs,
      refs: dedupedRefs
    });
  }

  return { entities };
}

module.exports = {
  buildGraphFromSchemas
};
