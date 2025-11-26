// src/components/ConceptGraphView.jsx
import React, { useEffect, useRef, useState } from "react";
import * as joint from "jointjs";
import dagre from "dagre";
import graphlib from "graphlib";
import "jointjs/dist/joint.css";

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.replace(/\/$/, "");

async function fetchConceptGraph(path) {
  if (!path) return null;
  const url = `${API_BASE}/concept-graph?path=${encodeURIComponent(path)}`;
  console.log("[ConceptGraphView] Fetching concept graph from:", url);
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to load concept graph: " + res.status);
  const data = await res.json();
  console.log("[ConceptGraphView] Concept graph JSON:", data);
  return data;
}

export default function ConceptGraphView({ conceptPath }) {
  const paperRef = useRef(null);
  const [error, setError] = useState("");
  const graphRef = useRef(null);
  const paperRefObj = useRef(null);

  useEffect(() => {
    let graph = null;
    let paper = null;

    async function init() {
      if (!conceptPath) {
        setError("Select a .concept file from the left to view its graph.");
        return;
      }

      try {
        const data = await fetchConceptGraph(conceptPath);

        const container = paperRef.current;
        if (!container) {
          setError("Paper container not found");
          return;
        }

        graph = new joint.dia.Graph();
        paper = new joint.dia.Paper({
          el: container,
          model: graph,
          width: 3000,
          height: 2000,
          gridSize: 10,
          drawGrid: true,
        });

        graphRef.current = graph;
        paperRefObj.current = paper;

        // nodes ->
        const nodeMap = {};
        (data.nodes || []).forEach((n, idx) => {
          const rect = new joint.shapes.standard.Rectangle({
            position: { x: 100 + (idx % 6) * 200, y: 100 + Math.floor(idx / 6) * 120 },
            size: { width: 140, height: 40 },
            attrs: {
              body: {
                fill: "#ecfeff",
                stroke: "#0e7490",
                "stroke-width": 1.5,
                rx: 6,
                ry: 6,
              },
              label: {
                text: n.label || n.id,
                fill: "#0f172a",
                "font-size": 13,
                "font-family":
                  "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
              },
            },
          });
          rect.addTo(graph);
          nodeMap[n.id] = rect;
        });

        // edges ->
        (data.edges || []).forEach((e) => {
          const src = nodeMap[e.source];
          const tgt = nodeMap[e.target];
          if (!src || !tgt) return;

          new joint.dia.Link({
            source: { id: src.id },
            target: { id: tgt.id },
            labels: [
              {
                position: 0.5,
                attrs: {
                  text: {
                    text: e.label || "",
                    "font-size": 11,
                    fill: "#111827",
                    "font-family":
                      "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
                  },
                },
              },
            ],
            attrs: {
              line: {
                stroke: "#0f172a",
                "stroke-width": 1.4,
                targetMarker: {
                  type: "path",
                  d: "M 10 -5 0 0 10 5 Z",
                  fill: "#0f172a",
                },
              },
            },
          }).addTo(graph);
        });

        // layout
        joint.layout.DirectedGraph.layout(graph, {
          dagre,
          graphlib,
          setLinkVertices: true,
          rankDir: "LR", // left-to-right conceptual chain
          nodeSep: 120,
          rankSep: 140,
          marginX: 80,
          marginY: 80,
        });

        setError("");
      } catch (err) {
        console.error("[ConceptGraphView] Failed:", err);
        setError(err.message || "Failed to load concept graph");
      }
    }

    // Clear previous
    if (paperRef.current) {
      paperRef.current.innerHTML = "";
    }
    if (graphRef.current) graphRef.current.clear();

    init();

    return () => {
      if (graph) graph.clear();
      if (paper) paper.remove();
    };
  }, [conceptPath]);

  return (
    <div
      style={{
        display: "flex",
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        backgroundColor: "#f9fafb",
      }}
    >
      <div
        ref={paperRef}
        style={{
          flex: 1,
          minHeight: 0,
          minWidth: 0,
        }}
      />
      {error && (
        <div
          style={{
            position: "absolute",
            top: 70,
            right: 24,
            padding: "6px 10px",
            background: "#fee2e2",
            color: "#991b1b",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}
    </div>
  );
}
