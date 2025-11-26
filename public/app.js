// public/app.js

// -------------------------------------------------------------
// API helpers (match your server.js)
// -------------------------------------------------------------

async function fetchGraph() {
  const res = await fetch("/graph");
  if (!res.ok) throw new Error("Failed to load graph: " + res.status);
  const data = await res.json();
  console.log("Graph data from /graph:", data);
  return data;
}

// /files → { jsonModels: [{path,name}], markdown: [...], concepts: [...] }
async function fetchFilesIndex() {
  const res = await fetch("/files");
  if (!res.ok) throw new Error("Failed to load files index: " + res.status);
  const data = await res.json();
  console.log("Files index from /files:", data);
  return data;
}

// /file?path=... returns plain text
async function fetchFileContent(path) {
  const res = await fetch(`/file?path=${encodeURIComponent(path)}`);
  if (!res.ok) throw new Error("Failed to load file: " + res.status);
  const text = await res.text();
  return { path, content: text };
}

// -------------------------------------------------------------
// UML entity details panel
// -------------------------------------------------------------

function renderEntityDetails(cell, container) {
  const data = cell?.get("schemaData");
  if (!data) {
    container.textContent = "Select a class…";
    return;
  }

  const lines = [];
  lines.push(`Entity: ${data.title}`);
  lines.push(`Domain: ${data.domain}`);
  lines.push("");
  lines.push("Attributes:");
  (data.attrs || []).forEach(a => {
    lines.push(`  - ${a.field}: ${a.type}`);
  });

  if (data.refs && data.refs.length) {
    lines.push("");
    lines.push("Foreign keys:");
    data.refs.forEach(r => {
      lines.push(`  - ${r.field} → ${r.ref}`);
    });
  }

  container.textContent = lines.join("\n");
}

// -------------------------------------------------------------
// File viewer (right-hand panel)
// -------------------------------------------------------------

function clearActiveNav() {
  document
    .querySelectorAll("#nav-content li")
    .forEach(li => li.classList.remove("active"));
}

function guessFileKind(path, fallbackKind) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".concept")) return "concept";
  return fallbackKind || "text";
}

async function handleNavClick(li) {
  const fullPath = li.dataset.path;
  const kindHint = li.dataset.kind;

  clearActiveNav();
  li.classList.add("active");

  const titleEl = document.getElementById("file-title");
  const viewer = document.getElementById("file-viewer");

  if (!titleEl || !viewer) {
    console.warn("file-title or file-viewer not found in DOM");
    return;
  }

  titleEl.textContent = fullPath;
  viewer.textContent = "Loading…";

  try {
    const { content } = await fetchFileContent(fullPath);
    const kind = guessFileKind(fullPath, kindHint);

    if (kind === "json") {
      try {
        const obj = JSON.parse(content);
        viewer.textContent = JSON.stringify(obj, null, 2);
      } catch (e) {
        viewer.textContent = content; // fallback if not valid JSON
      }
    } else if (kind === "markdown") {
      if (window.marked && typeof window.marked.parse === "function") {
        viewer.innerHTML = window.marked.parse(content);
      } else {
        viewer.textContent = content;
      }
    } else {
      viewer.textContent = content; // concept / text
    }
  } catch (err) {
    console.error("Failed to load file:", err);
    viewer.textContent = "Error loading file (see console).";
  }
}

// -------------------------------------------------------------
// Navigator (left sidebar)
// -------------------------------------------------------------

function makeSection(title, kind, items) {
  const section = document.createElement("div");
  section.className = "nav-section";

  const h2 = document.createElement("h2");
  h2.textContent = title;
  section.appendChild(h2);

  const ul = document.createElement("ul");

  items.forEach(item => {
    // item: { path, name }
    const li = document.createElement("li");
    li.textContent = item.name || item.path;
    li.dataset.path = item.path;
    li.dataset.kind = kind;

    li.addEventListener("click", () => handleNavClick(li));

    ul.appendChild(li);
  });

  section.appendChild(ul);
  return section;
}

function renderNavigator(filesIndex) {
  const nav = document.getElementById("nav-content");
  if (!nav) return;

  nav.innerHTML = "";

  if (filesIndex.jsonModels && filesIndex.jsonModels.length) {
    nav.appendChild(
      makeSection("JSON MODELS", "json", filesIndex.jsonModels)
    );
  }

  if (filesIndex.markdown && filesIndex.markdown.length) {
    nav.appendChild(
      makeSection("MARKDOWN", "markdown", filesIndex.markdown)
    );
  }

  if (filesIndex.concepts && filesIndex.concepts.length) {
    nav.appendChild(
      makeSection("CONCEPTS", "concept", filesIndex.concepts)
    );
  }
}

// -------------------------------------------------------------
// UML Diagram (JointJS) – NO DAGRE, manual grid layout
// -------------------------------------------------------------

function buildGraph(graphData) {
  if (!window.joint || !joint.dia || !joint.dia.Graph) {
    throw new Error("JointJS not loaded – check script imports in index.html");
  }

  const graph = new joint.dia.Graph();
  const paperContainer = document.getElementById("paper");

  const paper = new joint.dia.Paper({
    el: paperContainer,
    model: graph,
    width: 4000,
    height: 4000,
    gridSize: 10,
    drawGrid: { name: "dot" },
    background: { color: "#ffffff" },
    interactive: { linkMove: false }
  });

  const uml = joint.shapes.uml;
  const entityCells = {};

  // Normalise graphData.entities
  let entities = [];
  if (graphData && Array.isArray(graphData.entities)) {
    entities = graphData.entities;
  } else if (Array.isArray(graphData)) {
    entities = graphData;
  } else {
    console.warn("No entities found in /graph response:", graphData);
  }

  if (!entities.length) {
    const detailsEl = document.getElementById("details");
    if (detailsEl) {
      detailsEl.textContent =
        "No entities returned from /graph. Check schemaGraph.js or /graph JSON.";
    }
    return { graph, paper };
  }

  console.log("Entities to render:", entities);

  // Manual grid layout: N columns, M rows
  const cardW = 260;
  const cardH = 160;
  const marginX = 80;
  const marginY = 80;
  const colGap = 100;
  const rowGap = 60;

  const cols = Math.max(1, Math.ceil(Math.sqrt(entities.length)));

  entities.forEach((e, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);

    const x = marginX + col * (cardW + colGap);
    const y = marginY + row * (cardH + rowGap);

    const domainLabel = e.domain ? `*${e.domain.toUpperCase()}*` : "";
    const attrs = (e.attrs || []).map(a => `${a.field} : ${a.type}`);

    const cls = new uml.Class({
      position: { x, y },
      size: { width: cardW, height: cardH },
      name: domainLabel ? `${domainLabel}\n${e.title}` : e.title,
      attributes: attrs,
      methods: [],
      attrs: {
        ".uml-class-name-rect": {
          fill: "#1e3a8a",
          stroke: "#0f172a",
          "stroke-width": 1
        },
        ".uml-class-name-text": {
          fill: "#f9fafb",
          "font-size": 12,
          "font-style": "italic",
          "font-weight": 600
        },
        ".uml-class-attrs-rect": {
          fill: "#3b82f6",
          stroke: "#1e3a8a",
          "stroke-width": 1
        },
        ".uml-class-attrs-text": {
          fill: "#f9fafb",
          "font-size": 11
        }
      }
    });

    cls.set("schemaData", e);
    cls.addTo(graph);

    entityCells[`${e.domain}:${e.model}`] = cls;
  });

  // Connect foreign-key refs
  entities.forEach(e => {
    const src = entityCells[`${e.domain}:${e.model}`];
    if (!src) return;

    (e.refs || []).forEach(r => {
      const clean = r.ref.split("#")[0].replace("data://", "");
      const [refDomain, rest] = clean.split("/model/");
      if (!refDomain || !rest) return;
      const refModel = rest.split("/")[1];

      const tgt = entityCells[`${refDomain}:${refModel}`];
      if (!tgt) return;

      new joint.dia.Link({
        source: { id: src.id },
        target: { id: tgt.id },
        labels: [
          {
            position: 0.5,
            attrs: {
              text: {
                text: r.field,
                "font-size": 10,
                fill: "#111827",
                "font-family": "system-ui"
              }
            }
          }
        ],
        attrs: {
          line: {
            stroke: "#6b7280",
            "stroke-width": 1.5,
            targetMarker: {
              type: "path",
              d: "M 10 -5 0 0 10 5 Z",
              fill: "#6b7280"
            }
          }
        }
      }).addTo(graph);
    });
  });

  // Center the whole graph in view
  const bbox = graph.getBBox();
  if (bbox && isFinite(bbox.x) && isFinite(bbox.y)) {
    const viewW = paperContainer.clientWidth || 1200;
    const viewH = paperContainer.clientHeight || 800;
    const tx = (viewW - bbox.width) / 2 - bbox.x;
    const ty = (viewH - bbox.height) / 2 - bbox.y;
    paper.translate(tx, ty);
  }

  // Details panel hookup
  const detailsEl = document.getElementById("details");

  paper.on("element:pointerdown", view => {
    renderEntityDetails(view.model, detailsEl);
  });

  paper.on("blank:pointerdown", () => {
    renderEntityDetails(null, detailsEl);
  });

  return { graph, paper };
}

// -------------------------------------------------------------
// Init – render graph first, then sidebar
// -------------------------------------------------------------

async function init() {
  try {
    const graphData = await fetchGraph();
    buildGraph(graphData);
  } catch (err) {
    console.error("Failed to init graph:", err);
    alert("Failed to load schema graph – see console for details.");
  }

  try {
    const filesIndex = await fetchFilesIndex();
    renderNavigator(filesIndex);
  } catch (err) {
    console.warn("Failed to load file index (nav will be empty):", err);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error("Failed to init app:", err);
  });
});
