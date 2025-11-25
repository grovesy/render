// public/app.js — auto layout with DirectedGraph, domain-based vertical bands,
// pan/zoom, rounded UML boxes, auto-sized width & height, centered on load.

async function fetchGraph() {
  const res = await fetch("/graph");
  if (!res.ok) throw new Error("Failed to load graph: " + res.status);
  return res.json();
}

function renderDetails(cell, container) {
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
  data.attrs.forEach(a => lines.push(`  - ${a.field}: ${a.type}`));

  if (data.refs.length) {
    lines.push("");
    lines.push("Foreign keys:");
    data.refs.forEach(r =>
      lines.push(`  - ${r.field} → ${r.ref}`)
    );
  }

  container.textContent = lines.join("\n");
}

async function init() {
  const graphData = await fetchGraph();

  const graph = new joint.dia.Graph();
  const paperContainer = document.getElementById("paper");

  const paper = new joint.dia.Paper({
    el: paperContainer,
    model: graph,
    width: 5000,
    height: 4000,
    gridSize: 10,
    drawGrid: true
  });

  // ---------- PAN + ZOOM ----------
  let isPanning = false;
  let panStart = { x: 0, y: 0 };
  let lastTranslate = { x: 0, y: 0 };
  let zoomLevel = 1;

  paperContainer.addEventListener("mousedown", (e) => {
    if (e.target.tagName === "svg" || e.target === paperContainer) {
      isPanning = true;
      panStart = { x: e.clientX, y: e.clientY };
    }
  });

  window.addEventListener("mousemove", (e) => {
    if (!isPanning) return;
    const dx = e.clientX - panStart.x;
    const dy = e.clientY - panStart.y;
    const newX = lastTranslate.x + dx;
    const newY = lastTranslate.y + dy;
    paper.translate(newX, newY);
  });

  window.addEventListener("mouseup", (e) => {
    if (isPanning) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      lastTranslate = {
        x: lastTranslate.x + dx,
        y: lastTranslate.y + dy
      };
    }
    isPanning = false;
  });

  paperContainer.addEventListener("wheel", (e) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    zoomLevel = Math.min(2.0, Math.max(0.2, zoomLevel + delta));
    paper.scale(zoomLevel);
  });

  // ---------- BUILD UML CLASSES ----------
  const uml = joint.shapes.uml;
  const entityCells = {};  // key: `${domain}:${model}` -> cell

  graphData.entities.forEach((e, idx) => {
    const domainLabel = `*${e.domain.toUpperCase()}*`;

    // Align "name  :  type" with monospace font
    const fieldNames = e.attrs.map(a => a.field);
    const maxFieldLen = fieldNames.length
      ? fieldNames.reduce((m, s) => Math.max(m, s.length), 0)
      : 0;

    const attrLines = e.attrs.map(a =>
      `${a.field.padEnd(maxFieldLen, " ")}  :  ${a.type}`
    );

    // ---- Auto size based on content ----
    const headerHeight = 50;   // title area
    const lineHeight = 18;     // px per attribute line
    const attrCount = attrLines.length || 1;
    const height = headerHeight + lineHeight * attrCount;

    // Approximate width from longest attribute line
    const maxLineLen = attrLines.length
      ? attrLines.reduce((m, s) => Math.max(m, s.length), 0)
      : 10;

    const charWidth = 7;  // px per character for ~12px monospace
    const padding = 40;   // left/right padding inside rect
    let width = padding + maxLineLen * charWidth;
    width = Math.max(220, Math.min(420, width)); // clamp between min & max

    const cls = new uml.Class({
      // temporary position; DirectedGraph will override
      position: { x: 100 + idx * 20, y: 100 + idx * 20 },
      size: { width, height },
      name: `${domainLabel}\n${e.title}`,
      attributes: attrLines,
      methods: [],
      attrs: {
        ".uml-class-name-rect": {
          fill: "#0f172a",
          stroke: "#1e293b",
          "stroke-width": 1,
          rx: 6,
          ry: 6
        },
        ".uml-class-name-text": {
          fill: "#f1f5f9",
          "font-size": 14,
          "font-family": "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          "font-weight": "600",
          "font-style": "italic"
        },
        ".uml-class-attrs-rect": {
          fill: "#3b82f6",
          stroke: "#1e3a8a",
          "stroke-width": 1,
          rx: 6,
          ry: 6
        },
        ".uml-class-attrs-text": {
          fill: "#f9fafb",
          "font-size": 12,
          "font-family": "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          "font-weight": "400",
          "line-height": "1.5em",
          "white-space": "pre",
          "xml:space": "preserve"
        }
      }
    });

    cls.set("schemaData", e);
    cls.addTo(graph);

    entityCells[`${e.domain}:${e.model}`] = cls;
  });

  // ---------- LINKS (foreign keys) ----------
  graphData.entities.forEach(e => {
    const src = entityCells[`${e.domain}:${e.model}`];
    if (!src) return;

    e.refs.forEach(r => {
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
                "font-family": "system-ui, -apple-system, Segoe UI, Roboto, sans-serif"
              }
            }
          }
        ],
        attrs: {
          line: {
            stroke: "#111827",
            "stroke-width": 1.5,
            targetMarker: {
              type: "path",
              d: "M 10 -5 0 0 10 5 Z",
              fill: "#111827"
            }
          }
        }
      }).addTo(graph);
    });
  });

  // ---------- AUTOMATIC LAYOUT (DirectedGraph) ----------
  joint.layout.DirectedGraph.layout(graph, {
    setLinkVertices: true,
    rankDir: "TB",     // Top -> Bottom
    nodeSep: 180,      // min horizontal spacing between nodes
    edgeSep: 60,       // min spacing between edges
    rankSep: 280,      // vertical spacing between layers
    marginX: 120,
    marginY: 120
  });

  // ---------- DOMAIN-BASED GROUPING (vertical bands) ----------
  const elements = graph.getElements();

  // Collect domains from elements that have schemaData
  const domainsSet = new Set();
  elements.forEach(el => {
    const data = el.get("schemaData");
    if (data && data.domain) {
      domainsSet.add(data.domain);
    }
  });

  const domains = Array.from(domainsSet).sort();
  const baseX = 200;        // starting X for first domain
  const domainGap = 500;    // horizontal gap between domain columns

  // Map domain -> target centerX
  const domainCenters = {};
  domains.forEach((domain, idx) => {
    domainCenters[domain] = baseX + idx * domainGap;
  });

  // Reposition elements into vertical bands per domain, preserving Y from layout
  elements.forEach(el => {
    const data = el.get("schemaData");
    if (!data || !data.domain) return;

    const centerX = domainCenters[data.domain];
    if (centerX == null) return;

    const pos = el.position();
    el.position(centerX, pos.y);
  });

  // ---------- CENTER WHOLE GRAPH IN VIEW ON LOAD ----------
  function centerGraph() {
    const bbox = graph.getBBox();
    if (!bbox || !isFinite(bbox.x) || !isFinite(bbox.y)) return;

    // reset zoom to 1 before centering
    zoomLevel = 1;
    paper.scale(zoomLevel);

    const viewW = paperContainer.clientWidth || window.innerWidth || 1200;
    const viewH = paperContainer.clientHeight || window.innerHeight || 800;

    const tx = (viewW - bbox.width) / 2 - bbox.x;
    const ty = (viewH - bbox.height) / 2 - bbox.y;

    paper.translate(tx, ty);
    lastTranslate = { x: tx, y: ty };
  }

  // Defer centering slightly to ensure layout + render completed
  setTimeout(centerGraph, 80);

  // ---------- DETAILS PANEL ----------
  const detailsEl = document.getElementById("details");

  paper.on("element:pointerdown", view => {
    renderDetails(view.model, detailsEl);
  });

  paper.on("blank:pointerdown", () => {
    renderDetails(null, detailsEl);
  });
}

// bootstrap
document.addEventListener("DOMContentLoaded", () => {
  init().catch(err => {
    console.error("Failed to init UML view:", err);
    alert("Failed to load UML diagram – see console for details.");
  });
});
