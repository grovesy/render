// src/components/GraphView.jsx
import React, { useEffect, useRef, useState } from "react";
import * as joint from "jointjs";
import dagre from "dagre";
import graphlib from "graphlib";
import "jointjs/dist/joint.css";

// Frontend .env: VITE_API_BASE_URL=http://localhost:3000
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.replace(/\/$/, "");

// ------------------------------------------------------------
// Fetch graph JSON from backend
// ------------------------------------------------------------
async function fetchGraph() {
  const url = `${API_BASE}/graph`;
  console.log("[GraphView] Fetching graph from:", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load graph: " + res.status);
  const data = await res.json();
  console.log("[GraphView] Graph JSON loaded:", data);
  return data;
}

// ------------------------------------------------------------
// Render details + raw JSON into the side panel from raw data
// ------------------------------------------------------------
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

  // --- Raw JSON section ---
  const rawSource = data.raw || data; // if backend later attaches full schema under .raw
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

export default function GraphView({ selectedKey }) {
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

  // prevent double-init in StrictMode
  const initializedRef = useRef(false);

  // ------------- helpers for view size & centering -------------

  function getViewportSize() {
    return {
      width: window.innerWidth || 1200,
      height: window.innerHeight || 800,
    };
  }

  function centerOnBBox(bbox, label = "centerOnBBox") {
    const paper = paperObjRef.current;
    if (!paper || !bbox || !isFinite(bbox.x) || !isFinite(bbox.y)) {
      console.warn("[GraphView]", label, "bbox invalid:", bbox);
      return;
    }

    const { width: viewW, height: viewH } = getViewportSize();
    const zoom = zoomRef.current || 1;

    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;

    const tx = viewW / 2 - zoom * cx;
    const ty = viewH / 2 - zoom * cy;

    console.log("[GraphView]", label, {
      zoom,
      viewW,
      viewH,
      bbox,
      centerX: cx,
      centerY: cy,
      translate: { tx, ty },
    });

    paper.translate(tx, ty);
    translateRef.current = { x: tx, y: ty };
  }

  function centerOnCell(cell, label = "centerOnCell") {
    if (!cell) {
      console.warn("[GraphView]", label, "called with null cell");
      return;
    }
    const bbox = cell.getBBox();
    console.log("[GraphView]", label, "cell bbox:", bbox);
    centerOnBBox(bbox, label);
  }

  // ------------------ INITIAL GRAPH SETUP ------------------
  useEffect(() => {
    if (initializedRef.current) {
      return;
    }
    initializedRef.current = true;

    let graph = null;
    let paper = null;

    let isPanning = false;
    let panStart = { x: 0, y: 0 };
    let dragStartTranslate = { x: 0, y: 0 };

    let onMouseDownPaper, onMouseMoveWindow, onMouseUpWindow, onWheelPaper;

    async function init() {
      try {
        const graphData = await fetchGraph();

        const paperContainer = paperRef.current;
        if (!paperContainer) {
          setError("Paper container not found");
          return;
        }

        graph = new joint.dia.Graph();
        paper = new joint.dia.Paper({
          el: paperContainer,
          model: graph,
          width: 5000,
          height: 4000,
          gridSize: 10,
          drawGrid: true,
        });

        graphRef.current = graph;
        paperObjRef.current = paper;

        // ------------------ PAN + ZOOM ------------------
        onMouseDownPaper = (e) => {
          if (e.target.tagName === "svg" || e.target === paperContainer) {
            isPanning = true;
            panStart = { x: e.clientX, y: e.clientY };
            dragStartTranslate = { ...translateRef.current };
            console.log("[GraphView] Pan start", {
              panStart,
              dragStartTranslate,
            });
          }
        };

        onMouseMoveWindow = (e) => {
          if (isResizingDetailsRef.current) {
            const dx = startXDetailsRef.current - e.clientX;
            const newWidth = Math.min(
              640,
              Math.max(220, startWidthDetailsRef.current + dx)
            );
            setDetailsWidth(newWidth);
            return;
          }

          if (!isPanning) return;
          const dx = e.clientX - panStart.x;
          const dy = e.clientY - panStart.y;
          const newX = dragStartTranslate.x + dx;
          const newY = dragStartTranslate.y + dy;
          paper.translate(newX, newY);
        };

        onMouseUpWindow = (e) => {
          if (isPanning) {
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            const newX = dragStartTranslate.x + dx;
            const newY = dragStartTranslate.y + dy;
            translateRef.current = { x: newX, y: newY };
            console.log("[GraphView] Pan end", {
              panStart,
              dx,
              dy,
              finalTranslate: translateRef.current,
            });
            isPanning = false;
          }
          isResizingDetailsRef.current = false;
        };

        onWheelPaper = (e) => {
          e.preventDefault();
          const delta = e.deltaY < 0 ? 0.1 : -0.1;
          const prev = zoomRef.current || 1;
          const next = Math.min(2.0, Math.max(0.2, prev + delta));
          zoomRef.current = next;
          paper.scale(next, next);
          console.log("[GraphView] Zoom", { prev, next });
        };

        paperContainer.addEventListener("mousedown", onMouseDownPaper);
        window.addEventListener("mousemove", onMouseMoveWindow);
        window.addEventListener("mouseup", onMouseUpWindow);
        paperContainer.addEventListener("wheel", onWheelPaper, {
          passive: false,
        });

        // ------------------ BUILD UML CLASSES ------------------
        const uml = joint.shapes.uml;
        const entityCells = {};

        (graphData.entities || []).forEach((e, idx) => {
          const domainLabel = `*${e.domain.toUpperCase()}*`;

          const fieldNames = e.attrs.map((a) => a.field);
          const maxFieldLen = fieldNames.length
            ? fieldNames.reduce((m, s) => Math.max(m, s.length), 0)
            : 0;

          const attrLines = e.attrs.map((a) =>
            `${a.field.padEnd(maxFieldLen, " ")}  :  ${a.type}`
          );

          const headerHeight = 50;
          const lineHeight = 18;
          const attrCount = attrLines.length || 1;
          const height = headerHeight + lineHeight * attrCount;

          const maxLineLen = attrLines.length
            ? attrLines.reduce((m, s) => Math.max(m, s.length), 0)
            : 10;

          const charWidth = 7;
          const padding = 40;
          let width = padding + maxLineLen * charWidth;
          width = Math.max(220, Math.min(420, width));

          const cls = new uml.Class({
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
                ry: 6,
              },
              ".uml-class-name-text": {
                fill: "#f1f5f9",
                "font-size": 14,
                "font-family":
                  "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                "font-weight": "600",
                "font-style": "italic",
              },
              ".uml-class-attrs-rect": {
                fill: "#3b82f6",
                stroke: "#1e3a8a",
                "stroke-width": 1,
                rx: 6,
                ry: 6,
              },
              ".uml-class-attrs-text": {
                fill: "#f9fafb",
                "font-size": 12,
                "font-family":
                  "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
                "font-weight": "400",
                "line-height": "1.5em",
                "white-space": "pre",
                "xml:space": "preserve",
              },
            },
          });

          cls.set("schemaData", e);
          cls.addTo(graph);

          const key = `${e.domain}:${e.model}`;
          entityCells[key] = cls;

          console.log("[GraphView] Added node:", key, "at", cls.position());
        });

        cellsByKeyRef.current = entityCells;

        // ------------------ LINKS (foreign keys) ------------------
        (graphData.entities || []).forEach((e) => {
          const src = entityCells[`${e.domain}:${e.model}`];
          if (!src) return;

          e.refs.forEach((r) => {
            const clean = r.ref.split("#")[0].replace("data://", "");
            const [refDomain, rest] = clean.split("/model/");
            if (!refDomain || !rest) return;

            const refModel = rest.split("/")[1];
            const tgtKey = `${refDomain}:${refModel}`;
            const tgt = entityCells[tgtKey];
            if (!tgt) {
              console.warn(
                "[GraphView] No target cell for",
                tgtKey,
                "from ref",
                r.ref
              );
              return;
            }

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
                      "font-family":
                        "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                    },
                  },
                },
              ],
              attrs: {
                line: {
                  stroke: "#111827",
                  "stroke-width": 1.5,
                  targetMarker: {
                    type: "path",
                    d: "M 10 -5 0 0 10 5 Z",
                    fill: "#111827",
                  },
                },
              },
            }).addTo(graph);
          });
        });

        // ------------------ AUTOMATIC LAYOUT ------------------
        joint.layout.DirectedGraph.layout(graph, {
          dagre,
          graphlib,
          setLinkVertices: true,
          rankDir: "TB",
          nodeSep: 180,
          edgeSep: 60,
          rankSep: 280,
          marginX: 120,
          marginY: 120,
        });

        const layoutBBox = graph.getBBox();
        console.log("[GraphView] Layout graph bbox:", layoutBBox);

        // ------------------ DOMAIN-GROUP OFFSETS ------------------
        const elements = graph.getElements();

        const domainsSet = new Set();
        elements.forEach((el) => {
          const data = el.get("schemaData");
          if (data && data.domain) domainsSet.add(data.domain);
        });

        const domains = Array.from(domainsSet).sort();
        const domainIndex = {};
        domains.forEach((d, i) => {
          domainIndex[d] = i;
        });
        console.log("[GraphView] Domains after layout:", domains);

        let globalMinX = Infinity;
        elements.forEach((el) => {
          const p = el.position();
          if (p.x < globalMinX) globalMinX = p.x;
        });
        if (!isFinite(globalMinX)) globalMinX = 0;
        console.log("[GraphView] globalMinX before domain shift:", globalMinX);

        const domainGap = 500;

        elements.forEach((el) => {
          const data = el.get("schemaData");
          if (!data || !data.domain) return;

          const idx = domainIndex[data.domain] || 0;
          const pos = el.position();
          const newX = pos.x - globalMinX + idx * domainGap;
          el.position(newX, pos.y);
        });

        console.log(
          "[GraphView] Element positions after domain shift:",
          elements.map((el) => ({
            title: el.get("schemaData")?.title,
            domain: el.get("schemaData")?.domain,
            pos: el.position(),
          }))
        );

        // ------------------ INITIAL CENTERING (FIT TO WINDOW) ------------------
        function centerWholeGraph() {
          const bbox = graph.getBBox();
          console.log("[GraphView] centerWholeGraph bbox:", bbox);
          if (!bbox || !isFinite(bbox.x) || !isFinite(bbox.y)) return;

          const { width: viewW, height: viewH } = getViewportSize();
          const margin = 80;

          const scaleX = (viewW - margin) / bbox.width;
          const scaleY = (viewH - margin) / bbox.height;
          let fitScale = Math.min(scaleX, scaleY);

          fitScale = Math.max(0.1, Math.min(1.0, fitScale));

          zoomRef.current = fitScale;
          paper.scale(fitScale, fitScale);

          console.log("[GraphView] centerWholeGraph fitScale:", {
            viewW,
            viewH,
            bbox,
            scaleX,
            scaleY,
            fitScale,
          });

          centerOnBBox(bbox, "centerWholeGraph");
        }

        setTimeout(centerWholeGraph, 120);

        // ------------------ DETAILS PANEL EVENTS ------------------
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
      if (paperContainer) {
        if (onMouseDownPaper)
          paperContainer.removeEventListener("mousedown", onMouseDownPaper);
        if (onWheelPaper)
          paperContainer.removeEventListener("wheel", onWheelPaper);
      }
      if (onMouseMoveWindow)
        window.removeEventListener("mousemove", onMouseMoveWindow);
      if (onMouseUpWindow)
        window.removeEventListener("mouseup", onMouseUpWindow);

      if (graph) graph.clear();
      if (paper) paper.remove();
    };
  }, []);

  // ------------------ React to selectedKey from left sidebar ------------------
  useEffect(() => {
    if (!graphRef.current || !paperObjRef.current) {
      console.log(
        "[GraphView] selectedKey changed but graph not ready yet:",
        selectedKey
      );
      return;
    }

    const cellsByKey = cellsByKeyRef.current;
    const cell = selectedKey ? cellsByKey[selectedKey] : null;
    const detailsEl = detailsRef.current;

    console.log("[GraphView] selectedKey effect:", {
      selectedKey,
      hasCell: !!cell,
    });

    if (selectedCellRef.current && selectedCellRef.current !== cell) {
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

      cell.attr(".uml-class-name-rect/stroke", "#f97316");
      cell.attr(".uml-class-attrs-rect/stroke", "#f97316");
      selectedCellRef.current = cell;

      console.log("[GraphView] Centering on selected cell:", {
        selectedKey,
        zoom: zoomRef.current,
        translate: translateRef.current,
      });
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
    <div
      style={{
        display: "flex",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* Main graph area */}
      <div
        ref={paperRef}
        id="paper"
        style={{
          flex: 1,
          position: "relative",
        }}
      />

      {/* Drag handle between graph and details */}
      <div
        style={{
          width: "4px",
          cursor: "col-resize",
          backgroundColor: "#e5e7eb",
          alignSelf: "stretch",
        }}
        onMouseDown={handleDetailsResizeMouseDown}
      />

      {/* Details panel with border + raw JSON */}
      <div
        style={{
          width: detailsWidth,
          backgroundColor: "#ffffff",
          color: "#111827",
          padding: "12px",
          fontFamily:
            "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
          fontSize: "12px",
          whiteSpace: "pre-wrap",
          overflowY: "auto",
          boxSizing: "border-box",
          borderLeft: "2px solid #9ca3af",
          borderTop: "1px solid #e5e7eb",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.08em",
            color: "#6b7280",
            marginBottom: "8px",
          }}
        >
          Details & Raw JSON
        </div>
        {error ? (
          <div style={{ color: "#b91c1c" }}>{error}</div>
        ) : (
          <pre
            ref={detailsRef}
            id="details"
            style={{
              margin: 0,
              whiteSpace: "pre-wrap",
            }}
          >
            Select a class…
          </pre>
        )}
      </div>
    </div>
  );
}
