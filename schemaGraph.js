const fs = require("fs");
const path = require("path");

function isJsonFile(p) {
  return typeof p === "string" && p.toLowerCase().endsWith(".json");
}

async function walk(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) await walk(full, out);
    else if (isJsonFile(e.name)) out.push(full);
  }
  return out;
}

function parseId(idStr) {
  if (!idStr || !idStr.startsWith("data://")) return null;
  const without = idStr.replace("data://", "");
  const [domain, rest] = without.split("/model/");
  const [version, model] = rest.split("/");
  return { domain, version, model };
}

function extractSchema(file) {
  try {
    const raw = fs.readFileSync(file, "utf8");
    const schema = JSON.parse(raw);

    const id = schema.$id || schema.id;
    const meta = parseId(id);
    if (!meta) return null;

    const properties = schema.properties || {};
    const attrs = [];
    const refs = [];

    for (const [key, val] of Object.entries(properties)) {
      if (val.$ref) refs.push({ field: key, ref: val.$ref });
      else attrs.push({ field: key, type: val.type || "string" });
    }

    return {
      file,
      title: schema.title || meta.model,
      domain: meta.domain,
      model: meta.model,
      attrs,
      refs
    };
  } catch (e) {
    console.warn("Failed to load schema:", file, e);
    return null;
  }
}

async function buildGraphFromSchemas(schemaDirs) {
  let files = [];

  for (const dir of schemaDirs) {
    if (fs.existsSync(dir)) {
      const walked = await walk(dir);
      files = files.concat(walked);
    }
  }

  const schemas = files
    .map(extractSchema)
    .filter((s) => s !== null);

  const domains = {};
  for (const s of schemas) {
    if (!domains[s.domain]) domains[s.domain] = [];
    domains[s.domain].push(s);
  }

  return {
    domains,
    entities: schemas
  };
}

module.exports = { buildGraphFromSchemas };
