// src/components/RFModelGraphView.jsx
import React, { useEffect, useState, useRef } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import { Box } from "@mui/material";
import "@xyflow/react/dist/style.css";
import ApiClient from "../lib/ApiClient";
import { nodeTypes } from "./shared/GraphComponents";
import ResizableDetailsPanel from "./shared/ResizableDetailsPanel";
import JsonHighlighter from "./shared/JsonHighlighter";
import GraphControls from "./shared/GraphControls";
import ModelTableView from "./shared/ModelTableView";
import { useGraphLayout } from "../hooks/useGraphLayout";

const api = ApiClient;

export default function RFModelGraphView({ selectedKey, layoutStyle, groupByDomains, viewMode, onLayoutChange, onGroupDomainsChange, onViewModeChange }) {
  const [elk, setElk] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [rawJson, setRawJson] = useState(null);
  const [rawJsonFiles, setRawJsonFiles] = useState({});
  const [collapsedNodes, setCollapsedNodes] = useState({});
  const [allCollapsed, setAllCollapsed] = useState(true);
  const reactFlowInstance = useRef(null);
  const tableRowRefs = useRef({});
  const jsonCardRefs = useRef({});

  // Use custom hook for graph layout
  const { nodes, edges } = useGraphLayout(elk, graphData, layoutStyle, groupByDomains, collapsedNodes, setCollapsedNodes);

  // Sync selectedKey from parent
  useEffect(() => {
    setSelectedId(selectedKey);
  }, [selectedKey]);

  // Auto-focus on selected model
  useEffect(() => {
    if (!selectedId) return;

    // Auto-expand the selected node
    setCollapsedNodes(prev => ({
      ...prev,
      [selectedId]: false
    }));

    if (viewMode === 'graph' && reactFlowInstance.current) {
      // Focus on node in graph view - use timeout to ensure node is rendered after expansion
      setTimeout(() => {
        const node = nodes.find(n => n.id === selectedId);
        if (node && reactFlowInstance.current) {
          reactFlowInstance.current.fitView({
            nodes: [{ id: selectedId }],
            duration: 100,
            padding: 2.5,
          });
        }
      }, 50);
    } else if (viewMode === 'table' && tableRowRefs.current[selectedId]) {
      // Scroll to row in table view
      tableRowRefs.current[selectedId].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    } else if (viewMode === 'json' && jsonCardRefs.current[selectedId]) {
      // Scroll to card in JSON view
      jsonCardRefs.current[selectedId].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedId, viewMode]);

  useEffect(() => {
    // Wait for ELK to be available from the global script
    const checkELK = () => {
      if (window.ELK) {
        setElk(new window.ELK());
      } else {
        setTimeout(checkELK, 100);
      }
    };
    checkELK();
  }, []);

  // Fetch graph data
  useEffect(() => {
    async function load() {
      const fetchedGraphData = await api.fetchGraph();
      setGraphData(fetchedGraphData);
    }
    load();
  }, []);

  // Global collapse/expand toggle
  const handleGlobalToggle = () => {
    if (!graphData) return;
    const newState = !allCollapsed;
    const newCollapsed = {};
    (graphData.entities || []).forEach((e) => {
      newCollapsed[`${e.domain}:${e.model}`] = newState;
    });
    setCollapsedNodes(newCollapsed);
    setAllCollapsed(newState);
  };

  // Find selected entity details
  const selectedEntity = selectedId && graphData 
    ? graphData.entities.find(e => `${e.domain}:${e.model}` === selectedId)
    : null;

  // Fetch raw JSON file when entity is selected
  useEffect(() => {
    async function fetchRaw() {
      if (!selectedEntity) {
        setRawJson(null);
        return;
      }
      try {
        // Use file path from entity metadata, or construct as fallback
        const filePath = selectedEntity.filePath || `examples/${selectedEntity.domain}/${selectedEntity.model}.json`;
        const raw = await api.fetchFileContent(filePath);
        setRawJson(raw);
      } catch (err) {
        console.error('Failed to fetch raw JSON:', err);
        setRawJson(`Error loading file: ${err.message}`);
      }
    }
    fetchRaw();
  }, [selectedEntity]);

  // Pre-fetch raw JSON files for all entities in JSON mode
  useEffect(() => {
    if (viewMode !== 'json' || !graphData?.entities) return;
    
    async function fetchAllRaw() {
      const files = {};
      for (const entity of graphData.entities) {
        const entityId = `${entity.domain}:${entity.model}`;
        try {
          const filePath = entity.filePath || `examples/${entity.domain}/${entity.model}.json`;
          const raw = await api.fetchFileContent(filePath);
          files[entityId] = raw;
        } catch (err) {
          console.error(`Failed to fetch ${entityId}:`, err);
          files[entityId] = `Error loading file: ${err.message}`;
        }
      }
      setRawJsonFiles(files);
    }
    
    fetchAllRaw();
  }, [viewMode, graphData]);

  return (
    <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'column' }}>
      <GraphControls
        viewMode={viewMode}
        layoutStyle={layoutStyle}
        groupByDomains={groupByDomains}
        allCollapsed={allCollapsed}
        onViewModeChange={onViewModeChange}
        onLayoutChange={onLayoutChange}
        onGroupDomainsChange={onGroupDomainsChange}
        onGlobalToggle={handleGlobalToggle}
      />
      
      <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        {viewMode === 'graph' ? (
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
      onInit={(instance) => { reactFlowInstance.current = instance; }}
      onNodeClick={(_, node) => setSelectedId(node.id)}
      defaultEdgeOptions={{
        type: 'default',
        markerEnd: { type: MarkerType.ArrowClosed }
      }}
        >
          <Background variant="dots" gap={20} size={1} />
          <Controls />
        </ReactFlow>
          </Box>
        ) : viewMode === 'table' ? (
          <ModelTableView
            graphData={graphData}
            selectedId={selectedId}
            setSelectedId={setSelectedId}
            tableRowRefs={tableRowRefs}
          />
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', bgcolor: 'background.default' }}>
            <Box sx={{ p: 2 }}>
              {graphData?.entities?.map((entity) => {
                const entityId = `${entity.domain}:${entity.model}`;
                return (
                  <Box 
                    key={entityId} 
                    ref={(el) => { jsonCardRefs.current[entityId] = el; }}
                    sx={{ mb: 3 }}
                  >
                    <Box 
                      sx={{ 
                        p: 2, 
                        bgcolor: 'background.paper',
                        borderRadius: 1,
                        border: 1,
                        borderColor: 'divider',
                        cursor: 'pointer',
                        '&:hover': { bgcolor: 'action.hover' }
                      }}
                      onClick={() => setSelectedId(entityId)}
                    >
                      <Box sx={{ 
                        fontWeight: 600, 
                        mb: 1,
                        color: 'primary.main',
                        fontSize: 14
                      }}>
                        {entity.domain}:{entity.model}
                      </Box>
                      <JsonHighlighter code={rawJsonFiles[entityId] || 'Loading...'} />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}
      
      {/* Details Panel - hidden in JSON mode */}
      {viewMode !== 'json' && (
        <ResizableDetailsPanel
          isOpen={!!selectedEntity}
          title={selectedEntity?.title || ''}
          content={rawJson ? <JsonHighlighter code={rawJson} /> : 'Loading...'}
          onClose={() => setSelectedId(null)}
        />
      )}
      </Box>
    </Box>
  );
}
