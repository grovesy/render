// public/app.js — hub layout per domain, central link entities, pan/zoom,
// rounded corners, auto-sized boxes, flattened attributes rendered.

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

  // Group schemas by domain
  const byDomain = {};
  graphData.entities.forEach(e => {
    if (!byDomain[e.domain]) byDomain[e.domain] = [];
    byDomain[e.domain].push(e);
  });
  const domains = Object.keys(byDomain).sort();

  // Create all cells first with temporary positions
  graphData.entities.forEach((e, idx) => {
    const domainLabel = `*${e.domain.toUpperCase()}*`;

    // Align "name  :  type" with monospace font
    const fieldNames = e.attrs.map(a => a.field);
    const maxLen = fieldNames.length
      ? fieldNames.reduce((m, s) => Math.max(m, s.length), 0)
      : 0;

    const attrLines = e.attrs.map(a =>
      `${a.field.padEnd(maxLen, " ")}  :  ${a.type}`
    );

    // Auto height to fit attributes (header + attrs)
    const baseHeight = 50;        // for title/header
    const perAttr = 16;           // per attribute line
    const attrCount = attrLines.length || 1;
    const height = baseHeight + perAttr * attrCount;

    const cls = new uml.Class({
      position: { x: 100 + idx * 20, y: 100 + idx * 20 }, // temp; overridden by layout
      size: { width: 260, height: height },
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

  // ---------- Build degree / neighbors / cross-domain info ----------
  const metaByKey = {}; // key -> { entity, cell, inDegree, outDegree, degree, neighbors, neighborDomains }

  graphData.entities.forEach(e => {
    const key = `${e.domain}:${e.model}`;
    metaByKey[key] = {
      entity: e,
      cell: entityCells[key],
      inDegree: 0,
      outDegree: e.refs.length,
      neighbors: new Set(),
      neighborDomains: new Set()
    };
  });

  graphData.entities.forEach(e => {
    const srcKey = `${e.domain}:${e.model}`;
    const srcMeta = metaByKey[srcKey];
    if (!srcMeta) return;

    e.refs.forEach(r => {
      const clean = r.ref.split("#")[0].replace("data://", "");
      const [refDomain, rest] = clean.split("/model/");
      if (!refDomain || !rest) return;
      const refModel = rest.split("/")[1];
      const tgtKey = `${refDomain}:${refModel}`;
      const tgtMeta = metaByKey[tgtKey];
      if (!tgtMeta) return;

      tgtMeta.inDegree += 1;
      srcMeta.neighbors.add(tgtKey);
      tgtMeta.neighbors.add(srcKey);

      srcMeta.neighborDomains.add(refDomain);
      tgtMeta.neighborDomains.add(e.domain);
    });
  });

  Object.values(metaByKey).forEach(m => {
    m.degree = m.inDegree + m.outDegree;
  });

  // Orphans: degree 0
  const orphanKeys = Object.entries(metaByKey)
    .filter(([, m]) => m.degree === 0)
    .map(([k]) => k);

  // Linking / bridge entities: connect to >1 domain
  const linkingKeys = Object.entries(metaByKey)
    .filter(([, m]) => m.neighborDomains.size > 1)
    .map(([k]) => k);

  // ---------- Layout constants ----------
  const centerY = 500;           // vertical center row for hubs
  const baseDomainCenterX = 800;
  const domainSpacingX = 1100;   // distance between domain clusters
  const rowOffset = 260;         // distance hubs -> satellite rows
  const colSpacing = 320;        // spacing between satellites in a row

  const domainCenters = {};      // domain -> centerX used

  // ---------- Layout: hubs and satellites per domain ----------
  domains.forEach((domain, domainIdx) => {
    const allEntities = byDomain[domain];

    // Exclude orphans and linking nodes from the main hub layout
    const mainEntities = allEntities.filter(e => {
      const key = `${e.domain}:${e.model}`;
      return !orphanKeys.includes(key) && !linkingKeys.includes(key);
    });

    if (!mainEntities.length) {
      return;
    }

    const domainCenterX = baseDomainCenterX + domainIdx * domainSpacingX;
    domainCenters[domain] = domainCenterX;

    // Choose hub: highest degree in this domain among mainEntities
    let hubKey = null;
    let bestDegree = -1;
    mainEntities.forEach(e => {
      const key = `${e.domain}:${e.model}`;
      const m = metaByKey[key];
      const d = m ? m.degree : 0;
      if (d > bestDegree) {
        bestDegree = d;
        hubKey = key;
      }
    });
    if (!hubKey && mainEntities.length) {
      const e0 = mainEntities[0];
      hubKey = `${e0.domain}:${e0.model}`;
    }
    if (!hubKey) return;

    const hubMeta = metaByKey[hubKey];
    const hubCell = hubMeta.cell;

    // Put hub in center row
    hubCell.position(domainCenterX, centerY);

    // Satellites: remaining mainEntities in this domain
    const satellites = mainEntities
      .map(e => `${e.domain}:${e.model}`)
      .filter(key => key !== hubKey);

    const topRow = [];
    const bottomRow = [];
    satellites.forEach((key, idx) => {
      (idx % 2 === 0 ? topRow : bottomRow).push(key);
    });

    function layoutRow(rowKeys, y) {
      if (!rowKeys.length) return;
      const totalWidth = (rowKeys.length - 1) * colSpacing;
      const startX = domainCenterX - totalWidth / 2;
      rowKeys.forEach((key, i) => {
        const m = metaByKey[key];
        if (!m || !m.cell) return;
        const x = startX + i * colSpacing;
        m.cell.position(x, y);
      });
    }

    layoutRow(topRow, centerY - rowOffset);
    layoutRow(bottomRow, centerY + rowOffset);
  });

  // ---------- Layout linking entities in the CENTER ----------
  if (linkingKeys.length > 0) {
    const centerXs = Object.values(domainCenters);
    let midCenterX;
    if (centerXs.length === 0) {
      midCenterX = 2000;
    } else {
      const minX = Math.min(...centerXs);
      const maxX = Math.max(...centerXs);
      midCenterX = (minX + maxX) / 2;
    }

    const linkRowY = centerY;          // same vertical row as hubs
    const linkSpacingX = 320;
    const totalWidth = (linkingKeys.length - 1) * linkSpacingX;
    const startX = midCenterX - totalWidth / 2;

    linkingKeys.forEach((key, idx) => {
      const m = metaByKey[key];
      if (!m || !m.cell) return;
      const x = startX + idx * linkSpacingX;
      const y = linkRowY;
      m.cell.position(x, y);
    });
  }

  // ---------- Orphans: push to bottom row ----------
  if (orphanKeys.length > 0) {
    const centerXs = Object.values(domainCenters);
    let midCenterX;
    if (centerXs.length === 0) {
      midCenterX = 2000;
    } else {
      const minX = Math.min(...centerXs);
      const maxX = Math.max(...centerXs);
      midCenterX = (minX + maxX) / 2;
    }

    const orphanY = centerY + 3 * rowOffset;
    const orphanSpacingX = 300;
    const totalWidth = (orphanKeys.length - 1) * orphanSpacingX;
    const startX = midCenterX - totalWidth / 2;

    orphanKeys.forEach((key, idx) => {
      const m = metaByKey[key];
      if (!m || !m.cell) return;
      const x = startX + idx * orphanSpacingX;
      const y = orphanY;
      m.cell.position(x, y);
    });
  }

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

  // ---------- CENTER WHOLE GRAPH IN VIEW ----------
  const bbox = graph.getBBox();
  if (bbox && isFinite(bbox.x) && isFinite(bbox.y)) {
    const viewW = paperContainer.clientWidth || 1200;
    const viewH = paperContainer.clientHeight || 800;
    const tx = (viewW - bbox.width) / 2 - bbox.x;
    const ty = (viewH - bbox.height) / 2 - bbox.y;
    paper.translate(tx, ty);
    lastTranslate = { x: tx, y: ty };
  }

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
