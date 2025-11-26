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

// Additional ADR roots commonly used in repos
const ADR_ROOT_CANDIDATES = [
  path.resolve(path.join(__dirname, "adr")),
  path.resolve(path.join(__dirname, ".github", "adr")),
];
const ADR_DIRS = ADR_ROOT_CANDIDATES.filter((p) => {
  try {
    return fs.existsSync(p) && fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
});

// Allow /file reads from schema dirs and ADR dirs
const ALLOWED_ROOTS = [...SCHEMA_DIRS, ...ADR_DIRS];

console.log("Schema dirs:", SCHEMA_DIRS.join(", "));
if (ADR_DIRS.length) {
  console.log("ADR dirs:", ADR_DIRS.join(", "));
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

// ---------- /adrs : scan for .md files in 'adr' directories ----------

app.get("/adrs", (req, res) => {
  try {
    const adrs = [];

    function addAdrDir(dir) {
      try {
        const files = fs.readdirSync(dir);
        for (const file of files) {
          const filePath = path.join(dir, file);
          let fileStat;
          try {
            fileStat = fs.statSync(filePath);
          } catch {
            continue;
          }
          const ext = path.extname(file).toLowerCase();
          if (fileStat.isFile() && (ext === ".md" || ext === ".markdown")) {
            adrs.push({ path: filePath, name: file });
          }
        }
      } catch (err) {
        console.error(`Error reading adr directory ${dir}:`, err);
      }
    }

    function walkForADRs(dir) {
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
          // If directory is named 'adr', scan for .md files
          if (name.toLowerCase() === 'adr') {
            addAdrDir(full);
          }
          // Continue walking subdirectories
          walkForADRs(full);
        }
      }
    }

    SCHEMA_DIRS.forEach(walkForADRs);
    // Also include well-known ADR directories at the repo root
    ADR_DIRS.forEach(addAdrDir);
    res.json({ adrs });
  } catch (err) {
    console.error("Error scanning ADR files:", err);
    res.status(500).json({ error: "Failed to scan ADR files" });
  }
});

// ---------- /file : return raw file content (for viewer) ----------

function isPathInsideAllowedRoot(fullPath) {
  const resolved = path.resolve(fullPath);
  return ALLOWED_ROOTS.some((root) => resolved.startsWith(root + path.sep));
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
