// src/components/ConceptGraphView.jsx
import React, { useEffect, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import { Box, Typography, IconButton } from "@mui/material";
import "@xyflow/react/dist/style.css";
import ApiClient from "../lib/ApiClient";
import { nodeTypes } from "./shared/GraphComponents";

const api = ApiClient;

export default function ConceptGraphView({ conceptPath }) {
  const [elk, setElk] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState("");
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [detailsWidth, setDetailsWidth] = useState(400);
  const [rawContent, setRawContent] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  // Sync with ELK
  useEffect(() => {
    const checkELK = () => {
      if (window.ELK) {
        setElk(new window.ELK());
      } else {
        setTimeout(checkELK, 100);
      }
    };
    checkELK();
  }, []);

  useEffect(() => {
    if (!elk) return;
    if (!conceptPath) {
      setError("Select a .concept file from the left to view its graph.");
      return;
    }

    async function load() {
      try {
        const data = await api.fetchConceptGraph(conceptPath);

        // Build nodes with UML style - concept nodes show title only (no attrs)
        const tempNodes = (data.nodes || []).map((n) => {
          return {
            id: n.id,
            type: 'uml',
            data: { 
              title: n.label || n.id,
              attrs: [] // Empty attrs for concept nodes - title only
            },
            position: { x: 0, y: 0 }
          };
        });

        // Calculate node sizes for layout
        const nodeSizes = {};
        tempNodes.forEach(n => {
          const headerH = 44;
          const padding = 12;
          // Title-only nodes: just header + padding
          const width = Math.max(200, (n.data.title || "").length * 8 + padding * 2);
          const height = headerH + padding;
          nodeSizes[n.id] = { width, height };
        });

        // Build edges with smart routing
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
  }, [elk, conceptPath]);

  // Fetch raw concept file content
  useEffect(() => {
    async function fetchRaw() {
      if (!conceptPath) {
        setRawContent(null);
        return;
      }
      try {
        const raw = await api.fetchFileContent(conceptPath);
        setRawContent(raw);
        
        // Auto-size based on content
        const lines = raw.split('\n');
        const maxLineLength = Math.max(...lines.map(l => l.length));
        const charWidth = 7.2;
        const estimatedWidth = Math.min(800, Math.max(400, maxLineLength * charWidth + 48));
        setDetailsWidth(estimatedWidth);
      } catch (err) {
        console.error('Failed to fetch raw concept file:', err);
        setRawContent(`Error loading file: ${err.message}`);
      }
    }
    fetchRaw();
  }, [conceptPath]);

  // Handle mouse resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setDetailsWidth(Math.min(800, Math.max(300, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing]);

  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) : null;

  return (
    <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes.map(n => (
            selectedId === n.id 
              ? { ...n, style: { outline: '2px solid #ef4444', borderRadius: 8 } } 
              : n
          ))}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          onNodeClick={(_, node) => setSelectedId(node.id)}
          defaultEdgeOptions={{
            type: 'default',
            markerEnd: { type: MarkerType.ArrowClosed }
          }}
        >
          <Background variant="dots" gap={20} size={1} />
          <Controls />
        </ReactFlow>
        {error && (
          <Box sx={{ 
            position: "absolute", 
            top: 70, 
            right: 24, 
            p: 1, 
            bgcolor: "#fee2e2", 
            color: "#991b1b", 
            borderRadius: 1, 
            fontSize: 12 
          }}>
            {error}
          </Box>
        )}
      </Box>

      {/* Details Panel */}
      {conceptPath && (
        <>
          {/* Resize handle */}
          {detailsExpanded && (
            <Box
              onMouseDown={() => setIsResizing(true)}
              sx={{
                width: 4,
                bgcolor: isResizing ? '#3b82f6' : 'transparent',
                cursor: 'col-resize',
                transition: 'background-color 0.15s',
                '&:hover': {
                  bgcolor: '#93c5fd',
                },
                userSelect: 'none',
              }}
            />
          )}
          <Box
            sx={{
              width: detailsExpanded ? detailsWidth : 0,
              bgcolor: 'background.paper',
              borderLeft: detailsExpanded ? 'none' : '1px solid #e5e7eb',
              display: 'flex',
              flexDirection: 'column',
              transition: isResizing ? 'none' : 'width 0.2s ease-in-out',
              overflow: 'hidden',
            }}
          >
            {detailsExpanded && (
              <>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    p: 1.5,
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: 14 }}>
                    {conceptPath.split('/').pop()}
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <IconButton
                      size="small"
                      onClick={() => setDetailsWidth(Math.max(300, detailsWidth - 100))}
                      title="Decrease width"
                    >
                      ◀
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDetailsWidth(Math.min(800, detailsWidth + 100))}
                      title="Increase width"
                    >
                      ▶
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => setDetailsExpanded(false)}
                      title="Close panel"
                    >
                      ✕
                    </IconButton>
                  </Box>
                </Box>
                <Box
                  sx={{
                    flex: 1,
                    overflowY: 'auto',
                    p: 2,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    bgcolor: '#f8f9fa',
                  }}
                >
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {rawContent || 'Loading...'}
                  </pre>
                </Box>
              </>
            )}
          </Box>
        </>
      )}
      
      {/* Collapsed panel toggle */}
      {conceptPath && !detailsExpanded && (
        <Box
          sx={{
            width: 32,
            bgcolor: 'background.paper',
            borderLeft: '1px solid #e5e7eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setDetailsExpanded(true)}
        >
          <IconButton size="small" title="Open details panel">
            ◀
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
