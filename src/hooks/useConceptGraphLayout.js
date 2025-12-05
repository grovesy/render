// src/hooks/useConceptGraphLayout.js
import { useState, useEffect } from "react";
import { MarkerType } from "@xyflow/react";

export function useConceptGraphLayout(elk, conceptPath, api) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [error, setError] = useState("");
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    if (!elk) return;
    if (!conceptPath) {
      setError("Select a .concept file from the left to view its graph.");
      return;
    }

    async function load() {
      try {
        const data = await api.fetchConceptGraph(conceptPath);

        // Build nodes with UML style
        const tempNodes = (data.nodes || []).map((n) => ({
          id: n.id,
          type: 'uml',
          data: { 
            title: n.label || n.id,
            attrs: []
          },
          position: { x: 0, y: 0 }
        }));

        // Calculate node sizes
        const nodeSizes = {};
        tempNodes.forEach(n => {
          const headerH = 44;
          const padding = 12;
          const width = Math.max(200, (n.data.title || "").length * 8 + padding * 2);
          const height = headerH + padding;
          nodeSizes[n.id] = { width, height };
        });

        // Build edges
        const tempEdges = (data.edges || []).map((e) => ({
          id: `${e.source}-${e.target}`,
          source: e.source,
          target: e.target,
          label: e.label || '',
          type: 'default',
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { strokeWidth: 2 },
          labelStyle: { 
            fill: '#111827', 
            fontSize: 12, 
            fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
            fontWeight: 500
          }
        }));

        // ELK layout
        const elkGraph = {
          id: "root",
          layoutOptions: {
            "elk.algorithm": "layered",
            "elk.direction": "RIGHT",
            "elk.layered.spacing.nodeNodeBetweenLayers": "180",
            "elk.spacing.nodeNode": "100",
          },
          children: tempNodes.map(n => ({ 
            id: n.id, 
            width: nodeSizes[n.id].width, 
            height: nodeSizes[n.id].height 
          })),
          edges: tempEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] })),
        };

        const layout = await elk.layout(elkGraph);
        const posMap = {};
        (layout.children || []).forEach((c) => { posMap[c.id] = { x: c.x || 0, y: c.y || 0 }; });

        setNodes(tempNodes.map(n => ({ ...n, position: posMap[n.id] || { x: 0, y: 0 } })));
        
        // Smart edge routing
        const nodeMap = {};
        tempNodes.forEach(n => {
          nodeMap[n.id] = { ...n, position: posMap[n.id] || { x: 0, y: 0 } };
        });

        const finalEdges = tempEdges.map(edge => {
          const sourceNode = nodeMap[edge.source];
          const targetNode = nodeMap[edge.target];
          
          let sourceHandle = 'right';
          let targetHandle = 'left';
          
          if (sourceNode && targetNode) {
            if (sourceNode.position.x > targetNode.position.x) {
              sourceHandle = 'left';
              targetHandle = 'right';
            }
          }
          
          return {
            ...edge,
            sourceHandle,
            targetHandle
          };
        });

        setEdges(finalEdges);
        setError("");

        // Select first node by default
        if (tempNodes.length > 0) {
          setSelectedId(tempNodes[0].id);
        }
      } catch (err) {
        console.error("[ConceptGraphView] Failed:", err);
        setError(err.message || "Failed to load concept graph");
      }
    }

    load();
  }, [elk, conceptPath, api]);

  return { nodes, edges, error, selectedId, setSelectedId };
}
