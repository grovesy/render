// src/components/ModelGraphView.jsx
import React, { useEffect, useRef, useState } from "react";
import dagre from "dagre";
import graphlib from "graphlib";
import "jointjs/dist/joint.css";
import ApiClient from "../lib/ApiClient";
import { initJointCanvas, applyDirectedLayout } from "../lib/jointCanvas";
import { buildModelGraph } from "../lib/modelGraphBuilder";

const api = ApiClient;

// render details + raw JSON
function renderDetailsFromData(data, container) {
  if (!container) return;
  if (!data) {
    container.textContent = "Select a class…";
    return;
  }

  const lines = [];
  lines.push(`Entity: ${data.title}`);
  lines.push(`Domain: ${data.domain}`);
  lines.push("");
  lines.push("Attributes:");
  (data.attrs || []).forEach((a) => lines.push(`  - ${a.field}: ${a.type}`));

  if (data.refs && data.refs.length) {
    lines.push("");
    lines.push("Foreign keys:");
    data.refs.forEach((r) => lines.push(`  - ${r.field} → ${r.ref}`));
  }

  const rawSource = data.raw || data;
  let rawJson;
  try {
    rawJson = JSON.stringify(rawSource, null, 2);
  } catch {
    rawJson = String(rawSource);
  }

  lines.push("");
  lines.push("────────────────────────────");
  lines.push("Raw JSON:");
  lines.push(rawJson);

  container.textContent = lines.join("\n");
}

export default function ModelGraphView({ selectedKey }) {
  const paperRef = useRef(null);
  const detailsRef = useRef(null);
  const [error, setError] = useState("");

  const graphRef = useRef(null);
  const paperObjRef = useRef(null);
  const cellsByKeyRef = useRef({});

  const selectedCellRef = useRef(null);

  const zoomRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });

  const [detailsWidth, setDetailsWidth] = useState(320);
  const isResizingDetailsRef = useRef(false);
  const startXDetailsRef = useRef(0);
  const startWidthDetailsRef = useRef(detailsWidth);

  const initializedRef = useRef(false);

  function getViewportSize() {
    return {
      width: window.innerWidth || 1200,
      height: window.innerHeight || 800,
    };
  }

  function centerOnBBox(bbox, label = "centerOnBBox") {
    const paper = paperObjRef.current;
    if (!paper || !bbox || !isFinite(bbox.x) || !isFinite(bbox.y)) {
      console.warn("[ModelGraphView]", label, "bbox invalid:", bbox);
      return;
    }

    const { width: viewW, height: viewH } = getViewportSize();
    const zoom = zoomRef.current || 1;

    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;

    const tx = viewW / 2 - zoom * cx;
    const ty = viewH / 2 - zoom * cy;

    paper.translate(tx, ty);
    translateRef.current = { x: tx, y: ty };
  }

  function centerOnCell(cell, label = "centerOnCell") {
    if (!cell) {
      console.warn("[ModelGraphView]", label, "called with null cell");
      return;
    }
    const bbox = cell.getBBox();
    centerOnBBox(bbox, label);
  }

  // ----- INIT graph once -----
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    let graph = null;
    let paper = null;
    let initObj = null;

    async function init() {
      try {
        const graphData = await api.fetchGraph();
        const paperContainer = paperRef.current;
        if (!paperContainer) {
          setError("Paper container not found");
          return;
        }

        // initialize graph + paper with shared pan/zoom handlers
        const init = initJointCanvas(paperContainer, { width: 5000, height: 4000 });
        initObj = init;

        graph = init.graph;
        paper = init.paper;

        graphRef.current = graph;
        paperObjRef.current = paper;
        // sync shared zoom/translate refs
        zoomRef.current = init.zoomRef.current || zoomRef.current;
        translateRef.current = init.translateRef.current || translateRef.current;

        // ---- BUILD MODEL GRAPH ----
        const entityCells = buildModelGraph(
          graphData,
          graph,
          applyDirectedLayout,
          {
            dagre,
            graphlib,
            setLinkVertices: false,
            rankDir: "LR",
            nodeSep: 120,
            edgeSep: 40,
            rankSep: 200,
            marginX: 60,
            marginY: 60,
            layoutStrategy: "pivot",
            // Pivot layout spacing (tighter for compactness)
            colGap: 300,
            rowGap: 170,
          }
        );

        cellsByKeyRef.current = entityCells;
        function centerWholeGraph() {
          const bbox = graph.getBBox();
          if (!bbox || !isFinite(bbox.x) || !isFinite(bbox.y)) return;

          const { width: viewW, height: viewH } = getViewportSize();
          const margin = 80;

          const scaleX = (viewW - margin) / bbox.width;
          const scaleY = (viewH - margin) / bbox.height;
          let fitScale = Math.min(scaleX, scaleY);
          fitScale = Math.max(0.1, Math.min(1.0, fitScale));

          zoomRef.current = fitScale;
          paper.scale(fitScale, fitScale);

          centerOnBBox(bbox, "centerWholeGraph");
        }

        setTimeout(centerWholeGraph, 120);

        // ---- details panel events ----
        const detailsEl = detailsRef.current;

        paper.on("element:pointerdown", (view) => {
          const data = view.model.get("schemaData");
          renderDetailsFromData(data, detailsEl);
        });

        paper.on("blank:pointerdown", () => {
          renderDetailsFromData(null, detailsEl);
        });

        setError("");
      } catch (err) {
        console.error("Failed to init UML view:", err);
        setError(err.message || "Failed to load UML diagram.");
      }
    }

    init();

    return () => {
      const paperContainer = paperRef.current;
      if (initObj && typeof initObj.destroy === "function") initObj.destroy();

      if (graph) graph.clear();
      if (paper) paper.remove();
    };
  }, []);

  // react to `selectedKey` from sidebar
  useEffect(() => {
    if (!graphRef.current || !paperObjRef.current) return;

    const cellsByKey = cellsByKeyRef.current;
    const cell = selectedKey ? cellsByKey[selectedKey] : null;
    const detailsEl = detailsRef.current;

    if (selectedCellRef.current && selectedCellRef.current !== cell) {
      // Reset strokes on classic UML class
      selectedCellRef.current.attr(".uml-class-name-rect/stroke", "#1e293b");
      selectedCellRef.current.attr(".uml-class-attrs-rect/stroke", "#1e3a8a");
      selectedCellRef.current = null;
    }

    if (!selectedKey) {
      renderDetailsFromData(null, detailsEl);
      return;
    }

    if (cell) {
      const data = cell.get("schemaData");
      renderDetailsFromData(data, detailsEl);

      // Highlight selected UML class borders
      cell.attr(".uml-class-name-rect/stroke", "#f97316");
      cell.attr(".uml-class-attrs-rect/stroke", "#f97316");
      selectedCellRef.current = cell;

      centerOnCell(cell, "centerOnSelectedCell");
    } else {
      renderDetailsFromData(null, detailsEl);
    }
  }, [selectedKey]);

  function handleDetailsResizeMouseDown(e) {
    isResizingDetailsRef.current = true;
    startXDetailsRef.current = e.clientX;
    startWidthDetailsRef.current = detailsWidth;
  }

  return (
    <div style={{ display: "flex", height: "100%", width: "100%", overflow: "hidden" }}>
      <div ref={paperRef} id="paper" style={{ flex: 1, position: "relative", backgroundColor: "#f9fafb" }} />

      <div style={{ width: "4px", cursor: "col-resize", backgroundColor: "#e5e7eb", alignSelf: "stretch" }} onMouseDown={handleDetailsResizeMouseDown} />

      <div style={{ width: detailsWidth, backgroundColor: "#ffffff", color: "#111827", padding: "12px", fontFamily: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace", fontSize: "12px", whiteSpace: "pre-wrap", overflowY: "auto", boxSizing: "border-box", borderLeft: "2px solid #9ca3af" }}>
        <div style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.08em", color: "#6b7280", marginBottom: "8px" }}>
          Details & Raw JSON
        </div>
        {error ? (
          <div style={{ color: "#b91c1c" }}>{error}</div>
        ) : (
          <pre ref={detailsRef} id="details" style={{ margin: 0, whiteSpace: "pre-wrap" }}>
            Select a class…
          </pre>
        )}
      </div>
    </div>
  );
}
