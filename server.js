// server.js
const express = require("express");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const { buildGraphFromSchemas } = require("./schemaGraph");
const { buildConceptGraphFromFile } = require("./conceptGraph");

const app = express();

app.use(express.json());

// Enable CORS for local dev and tooling. Control allowed origins with
// ALLOW_ORIGINS env var (comma separated), otherwise allow all origins.
// Common usage: ALLOW_ORIGINS=http://localhost:5173
if (process.env.ALLOW_ORIGINS) {
  const allowed = process.env.ALLOW_ORIGINS.split(",").map((s) => s.trim());
  app.use(
    cors({
      origin: function (origin, cb) {
        // allow non-browser (e.g. curl) requests with no origin
        if (!origin) return cb(null, true);
        if (allowed.indexOf(origin) !== -1) return cb(null, true);
        return cb(new Error("CORS not allowed by ALLOW_ORIGINS"));
      },
    })
  );
} else {
  // permissive in development — restrict in production if needed
  app.use(cors());
}

// Static frontend (Vite build or public assets if you’re still doing that)
app.use(express.static(path.join(__dirname, "public")));

// Directories to scan for schemas / docs / concepts
// e.g. SCHEMA_DIRS=examples,more_examples
const SCHEMA_DIRS = (process.env.SCHEMA_DIRS || "examples,codification,docs")
  .split(",")
  .map((p) => path.resolve(p.trim()))
  .filter(Boolean);

console.log("Schema dirs:", SCHEMA_DIRS.join(", "));

// ---------- File scanning helpers ----------

function scanFiles(rootDirs, filterFn) {
  const results = [];

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
      } else if (stat.isFile() && filterFn(full, name)) {
        results.push({ path: full, name });
      }
    }
  }

  rootDirs.forEach(walk);
  return results;
}

function hasExt(exts) {
  return (fullPath) => exts.includes(path.extname(fullPath).toLowerCase());
}

function isPathInsideSchemaDir(fullPath) {
  const resolved = path.resolve(fullPath);
  return SCHEMA_DIRS.some((root) => resolved.startsWith(root + path.sep));
}

function handleScan(res, scanFn, errorMsg) {
  try {
    res.json(scanFn());
  } catch (err) {
    console.error(errorMsg, err);
    res.status(500).json({ error: errorMsg });
  }
}

function validateAndReadFile(req, res, processFn) {
  const filePath = req.query.path;
  if (!filePath) {
    return res.status(400).json({ error: "Missing path query parameter" });
  }

  const resolved = path.resolve(filePath);
  if (!isPathInsideSchemaDir(resolved)) {
    return res.status(403).json({ error: "Access denied" });
  }

  processFn(resolved);
}

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

// ---------- /files : index of JSON / Markdown / Concept files ----------

app.get("/files", (req, res) => {
  handleScan(res, () => ({
    jsonModels: scanFiles(SCHEMA_DIRS, hasExt([".json"])),
    markdown: scanFiles(SCHEMA_DIRS, hasExt([".md", ".markdown"])),
    concepts: scanFiles(SCHEMA_DIRS, hasExt([".concept"]))
  }), "Error scanning files");
});

// ---------- /concepts : convenience endpoint (just concept files) ----------

app.get("/concepts", (req, res) => {
  handleScan(res, () => ({
    concepts: scanFiles(SCHEMA_DIRS, hasExt([".concept"]))
  }), "Error scanning concept files");
});

// ---------- /adrs : scan for .md files in 'adr' directories ----------

app.get("/adrs", (req, res) => {
  handleScan(res, () => ({
    adrs: scanFiles(SCHEMA_DIRS, (fullPath) => {
      const ext = path.extname(fullPath).toLowerCase();
      const isMarkdown = ext === ".md" || ext === ".markdown";
      const inAdrDir = fullPath.split(path.sep).some(part => part.toLowerCase() === 'adr');
      return isMarkdown && inAdrDir;
    })
  }), "Error scanning ADR files");
});

// ---------- /file : return raw file content (for viewer) ----------

app.get("/file", (req, res) => {
  validateAndReadFile(req, res, (resolved) => {
    fs.readFile(resolved, "utf8", (err, data) => {
      if (err) {
        console.error("Error reading file:", err);
        return res.status(500).json({ error: "Failed to read file" });
      }
      res.type("text/plain").send(data);
    });
  });
});

// ---------- /concept-graph : graph from a .concept DSL file ----------

app.get("/concept-graph", (req, res) => {
  validateAndReadFile(req, res, (resolved) => {
    try {
      const graph = buildConceptGraphFromFile(resolved);
      res.json(graph);
    } catch (err) {
      console.error("Error building concept graph:", err);
      res.status(500).json({ error: "Failed to build concept graph" });
    }
  });
});

// ---------- Start server ----------

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Schema graph server listening on http://localhost:${PORT}`);
});
