// src/components/ConceptGraphView.jsx
import React, { useEffect, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import { Box } from "@mui/material";
import "@xyflow/react/dist/style.css";
import ApiClient from "../lib/ApiClient";
import { nodeTypes } from "./shared/GraphComponents";
import ResizableDetailsPanel from "./shared/ResizableDetailsPanel";
import { useConceptGraphLayout } from "../hooks/useConceptGraphLayout";

const api = ApiClient;

export default function ConceptGraphView({ conceptPath }) {
  const [elk, setElk] = useState(null);
  const [rawContent, setRawContent] = useState(null);

  const { nodes, edges, error, selectedId, setSelectedId } = useConceptGraphLayout(elk, conceptPath, api);

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
      } catch (err) {
        console.error('Failed to fetch raw concept file:', err);
        setRawContent(`Error loading file: ${err.message}`);
      }
    }
    fetchRaw();
  }, [conceptPath]);

  const selectedNode = selectedId ? nodes.find(n => n.id === selectedId) : null;

  return (
    <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
      <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
        <ReactFlow
          nodes={nodes.map(n => ({
            ...n,
            className: selectedId === n.id ? 'selected' : ''
          }))}
          edges={edges}
          nodeTypes={nodeTypes}
          fitView
          minZoom={0.05}
          maxZoom={2}
          nodesDraggable={true}
          panOnDrag={[1, 2]}
          selectionOnDrag={false}
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
            bgcolor: 'error.light', 
            color: 'error.dark', 
            borderRadius: 1, 
            fontSize: 12 
          }}>
            {error}
          </Box>
        )}
      </Box>

      <ResizableDetailsPanel
        isOpen={!!conceptPath}
        title={conceptPath?.split('/').pop() || ''}
        content={
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'monospace', fontSize: 12 }}>
            {rawContent || 'Loading...'}
          </pre>
        }
        onClose={() => {}}
      />
    </Box>
  );
}
