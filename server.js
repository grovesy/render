// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const { buildGraphFromSchemas } = require("./schemaGraph");
const { buildConceptGraphFromFile } = require("./conceptGraph");

const app = express();

app.use(express.json());

// Static frontend (Vite build or public assets if you’re still doing that)
app.use(express.static(path.join(__dirname, "public")));

// Directories to scan for schemas / docs / concepts
// e.g. SCHEMA_DIRS=examples,more_examples
const SCHEMA_DIRS = (process.env.SCHEMA_DIRS || "examples")
  .split(",")
  .map((p) => path.resolve(p.trim()))
  .filter(Boolean);

console.log("Schema dirs:", SCHEMA_DIRS.join(", "));

// ---------- /graph : UML graph data from JSON Schemas ----------

app.get("/graph", (req, res) => {
  try {
    const graph = buildGraphFromSchemas(SCHEMA_DIRS);
    res.json(graph);
  } catch (err) {
    console.error("Error building graph:", err);
    res.status(500).json({ error: "Failed to build schema graph" });
  }
});

// ---------- File scanning helpers ----------

function scanFilesByExt(rootDirs, exts) {
  const results = [];
  const lowerExts = new Set(exts.map((e) => e.toLowerCase()));

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir);
    } catch {
      return;
    }

    for (const name of entries) {
      const full = path.join(dir, name);
      let stat;
      try {
        stat = fs.statSync(full);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        walk(full);
      } else if (stat.isFile()) {
        const ext = path.extname(full).toLowerCase();
        if (lowerExts.has(ext)) {
          results.push({
            path: full,
            name,
          });
        }
      }
    }
  }

  rootDirs.forEach(walk);
  return results;
}

// ---------- /files : index of JSON / Markdown / Concept files ----------

app.get("/files", (req, res) => {
  try {
    const jsonModels = scanFilesByExt(SCHEMA_DIRS, [".json"]);
    const markdown = scanFilesByExt(SCHEMA_DIRS, [".md", ".markdown"]);
    const concepts = scanFilesByExt(SCHEMA_DIRS, [".concept"]);

    res.json({ jsonModels, markdown, concepts });
  } catch (err) {
    console.error("Error scanning files:", err);
    res.status(500).json({ error: "Failed to scan files" });
  }
});

// ---------- /concepts : convenience endpoint (just concept files) ----------

app.get("/concepts", (req, res) => {
  try {
    const concepts = scanFilesByExt(SCHEMA_DIRS, [".concept"]);
    res.json({ concepts });
  } catch (err) {
    console.error("Error scanning concept files:", err);
    res.status(500).json({ error: "Failed to scan concept files" });
  }
});

// ---------- /file : return raw file content (for viewer) ----------

function isPathInsideAllowedRoot(fullPath) {
  const resolved = path.resolve(fullPath);
  return SCHEMA_DIRS.some((root) => resolved.startsWith(root + path.sep));
}

app.get("/file", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: "Missing path query parameter" });
  }

  const resolved = path.resolve(filePath);
  if (!isPathInsideAllowedRoot(resolved)) {
    return res.status(403).json({ error: "Access denied" });
  }

  fs.readFile(resolved, "utf8", (err, data) => {
    if (err) {
      console.error("Error reading file:", err);
      return res.status(500).json({ error: "Failed to read file" });
    }
    res.type("text/plain").send(data);
  });
});

// ---------- /concept-graph : graph from a .concept DSL file ----------
//
// GET /concept-graph?path=/abs/path/to/file.concept
//
app.get("/concept-graph", (req, res) => {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: "Missing path query parameter" });
  }

  const resolved = path.resolve(filePath);
  if (!isPathInsideAllowedRoot(resolved)) {
    return res.status(403).json({ error: "Access denied" });
  }

  try {
    const graph = buildConceptGraphFromFile(resolved);
    res.json(graph); // { nodes: [...], edges: [...] }
  } catch (err) {
    console.error("Error building concept graph:", err);
    res.status(500).json({ error: "Failed to build concept graph" });
  }
});

// ---------- Start server ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Schema graph server listening on http://localhost:${PORT}`);
});
