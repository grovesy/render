// src/components/RFModelGraphView.jsx
import React, { useEffect, useState } from "react";
import { ReactFlow, Background, Controls, MarkerType } from "@xyflow/react";
import { Box, Typography, IconButton } from "@mui/material";
import "@xyflow/react/dist/style.css";
import ApiClient from "../lib/ApiClient";
import { nodeTypes } from "./shared/GraphComponents";

const api = ApiClient;

// Collision detection and adjustment
function adjustPositionForCollision(newNode, existingNodes, minPadding = 40) {
  let { x, y } = newNode.position;
  const width = newNode.width || 250;
  const height = newNode.height || 200;
  
  let hasCollision = true;
  let attempts = 0;
  const maxAttempts = 50;
  
  while (hasCollision && attempts < maxAttempts) {
    hasCollision = false;
    
    for (const existing of existingNodes) {
      const exW = existing.width || 250;
      const exH = existing.height || 200;
      
      // Check for overlap (with padding)
      const overlapsX = x < existing.position.x + exW + minPadding && 
                        x + width + minPadding > existing.position.x;
      const overlapsY = y < existing.position.y + exH + minPadding && 
                        y + height + minPadding > existing.position.y;
      
      if (overlapsX && overlapsY) {
        hasCollision = true;
        // Move down to avoid collision
        y = existing.position.y + exH + minPadding;
        break;
      }
    }
    attempts++;
  }
  
  return { x, y };
}

// Simple JSON syntax highlighter
function JsonHighlighter({ code }) {
  const highlightJson = (text) => {
    // Try to parse and pretty-print if valid JSON
    let formattedText = text;
    try {
      const parsed = JSON.parse(text);
      formattedText = JSON.stringify(parsed, null, 2);
    } catch {
      // If not valid JSON, use as-is
    }

    // Escape HTML first
    const escaped = formattedText
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Apply syntax highlighting
    const highlighted = escaped
      .replace(/("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?)/g, (match) => {
        if (/:$/.test(match)) {
          // Property key
          return `<span style="color:#0451a5;font-weight:bold">${match}</span>`;
        }
        // String value
        return `<span style="color:#a31515">${match}</span>`;
      })
      .replace(/\b(true|false|null)\b/g, '<span style="color:#0000ff;font-weight:bold">$1</span>')
      .replace(/\b(-?\d+\.?\d*)\b/g, '<span style="color:#098658">$1</span>');

    return highlighted;
  };

  return (
    <pre 
      style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
      dangerouslySetInnerHTML={{ __html: highlightJson(code) }}
    />
  );
}

export default function RFModelGraphView({ selectedKey, layoutStyle, groupByDomains, onLayoutChange, onGroupDomainsChange }) {
  const [elk, setElk] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [detailsWidth, setDetailsWidth] = useState(400);
  const [rawJson, setRawJson] = useState(null);
  const [isResizing, setIsResizing] = useState(false);

  // Sync selectedKey from parent
  useEffect(() => {
    if (selectedKey) {
      setSelectedId(selectedKey);
    }
  }, [selectedKey]);

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

  useEffect(() => {
    if (!elk) return;
    
    async function load() {
      const fetchedGraphData = await api.fetchGraph();
      setGraphData(fetchedGraphData);

      // Build nodes with measured size (match UMLNode calc)
      const tempNodes = (fetchedGraphData.entities || []).map((e) => {
        const rowH = 24; const headerH = 44; const padding = 12;
        const maxField = Math.max(...(e.attrs || []).map(a => (a.field || "").length), 0);
        const charW = 8; const sepX = padding + maxField * charW + 12;
        const width = Math.max(240, sepX + 120 + padding);
        const height = headerH + padding + (e.attrs || []).length * rowH + padding;
        return {
          id: `${e.domain}:${e.model}`,
          type: "uml",
          data: { 
            title: e.title, 
            attrs: e.attrs,
            domain: e.domain,
            model: e.model
          },
          position: { x: 0, y: 0 },
          width,
          height,
        };
      });

      const tempEdges = [];
      (fetchedGraphData.entities || []).forEach((e) => {
        (e.refs || []).forEach((r) => {
          const clean = r.ref.split("#")[0].replace("data://", "");
          const [refDomain, rest] = clean.split("/model/");
          if (!refDomain || !rest) return;
          const refModel = rest.split("/")[1];
          const edgeId = `${e.domain}:${e.model}-${r.field}`;
          const sourceId = `${e.domain}:${e.model}`;
          const targetId = `${refDomain}:${refModel}`;
          console.log('Creating edge:', { edgeId, sourceId, targetId, field: r.field });
          tempEdges.push({ 
            id: edgeId, 
            source: sourceId, 
            target: targetId,
            field: r.field
          });
        });
      });

      console.log('Total edges created:', tempEdges.length);

      // Configure ELK layout based on selected style
      let layoutOptions = {};
      if (layoutStyle === 'hierarchical') {
        layoutOptions = {
          "elk.algorithm": "layered",
          "elk.direction": "RIGHT",
          "elk.layered.spacing.nodeNodeBetweenLayers": "120",
          "elk.spacing.nodeNode": "80",
          "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
        };
      } else if (layoutStyle === 'force') {
        layoutOptions = {
          "elk.algorithm": "force",
          "elk.force.repulsion": "1000",
          "elk.spacing.nodeNode": "100",
        };
      } else if (layoutStyle === 'star') {
        // Star schema will use custom positioning (see below)
        layoutOptions = {
          "elk.algorithm": "layered",
          "elk.direction": "DOWN",
          "elk.layered.spacing.nodeNodeBetweenLayers": "150",
          "elk.spacing.nodeNode": "100",
        };
      }

      const elkGraph = {
        id: "root",
        layoutOptions,
        children: tempNodes.map(n => ({ 
          id: n.id, 
          width: n.width, 
          height: n.height 
        })),
        edges: tempEdges.map(e => ({ 
          id: e.id, 
          sources: [e.source], 
          targets: [e.target] 
        })),
      };

      const layout = await elk.layout(elkGraph);
      const posMap = {};
      (layout.children || []).forEach((c) => { 
        posMap[c.id] = { x: c.x || 0, y: c.y || 0 }; 
      });

      // Apply ELK layout positions to all nodes
      const positionedNodes = tempNodes.map(n => ({
        ...n,
        position: posMap[n.id] || { x: 0, y: 0 }
      }));

      // Conditionally add domain boxes if grouping is enabled
      const domainBoxNodes = [];
      
      if (groupByDomains) {
        // Group nodes by domain for domain boxes
        const nodesByDomain = {};
        positionedNodes.forEach(n => {
          const domain = n.data.domain;
          if (!nodesByDomain[domain]) nodesByDomain[domain] = [];
          nodesByDomain[domain].push(n);
        });

        // Add domain box background nodes - calculate bounds from ALL nodes in each domain
        const placedDomainBoxes = []; // Track placed boxes for collision detection
        const domainOffsets = {}; // Track how much each domain box was moved
        
      Object.keys(nodesByDomain).forEach(domain => {
        const nodesInDomain = nodesByDomain[domain];
        
        if (nodesInDomain.length === 0) return;
        
        // Calculate bounds from all positioned nodes in this domain
        let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
        
        nodesInDomain.forEach(n => {
          minX = Math.min(minX, n.position.x);
          maxX = Math.max(maxX, n.position.x + (n.width || 250));
          minY = Math.min(minY, n.position.y);
          maxY = Math.max(maxY, n.position.y + (n.height || 200));
        });
        
        // Add padding
        const padding = { left: 60, right: 60, top: 80, bottom: 40 };
        
        let boxX = minX - padding.left;
        let boxY = minY - padding.top;
        const originalBoxY = boxY; // Track original position
        const boxWidth = (maxX - minX) + padding.left + padding.right;
        const boxHeight = (maxY - minY) + padding.top + padding.bottom;
        
        // Check for collision with other domain boxes and adjust position
        let hasCollision = true;
        let attempts = 0;
        const maxAttempts = 50;
        
        while (hasCollision && attempts < maxAttempts) {
          hasCollision = false;
          
          for (const placedBox of placedDomainBoxes) {
            const overlapsX = boxX < placedBox.position.x + placedBox.data.width + 20 && 
                              boxX + boxWidth + 20 > placedBox.position.x;
            const overlapsY = boxY < placedBox.position.y + placedBox.data.height + 20 && 
                              boxY + boxHeight + 20 > placedBox.position.y;
            
            if (overlapsX && overlapsY) {
              hasCollision = true;
              // Move down to avoid collision
              boxY = placedBox.position.y + placedBox.data.height + 30;
              break;
            }
          }
          attempts++;
        }
        
        // Calculate offset if box was moved
        const offsetY = boxY - originalBoxY;
        domainOffsets[domain] = { x: 0, y: offsetY };
        
        const domainBox = {
          id: `domain-box-${domain}`,
          type: 'domainBox',
          position: { x: boxX, y: boxY },
          data: {
            label: domain,
            width: boxWidth,
            height: boxHeight
          },
          selectable: false,
          draggable: false,
          zIndex: -1
        };
        
        domainBoxNodes.push(domainBox);
        placedDomainBoxes.push(domainBox);
      });

        // Apply domain offsets to all nodes in moved domains
        positionedNodes.forEach(node => {
          const domain = node.data?.domain;
          if (domain && domainOffsets[domain]) {
            const offset = domainOffsets[domain];
            node.position.x += offset.x;
            node.position.y += offset.y;
          }
        });
      }

      setNodes([...domainBoxNodes, ...positionedNodes]);
      
      // Smart edge routing: determine which handle to use based on node positions
      const finalEdges = tempEdges.map(e => {
        const sourceNode = positionedNodes.find(n => n.id === e.source);
        const targetNode = positionedNodes.find(n => n.id === e.target);
        
        let sourceHandle = 'right';
        let targetHandle = 'left';
        
        if (sourceNode && targetNode) {
          // If source is to the right of target, connect from left side
          if (sourceNode.position.x > targetNode.position.x) {
            sourceHandle = 'left';
            targetHandle = 'right';
          }
        }
        
        return {
          ...e,
          type: 'default',
          sourceHandle,
          targetHandle,
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#111827'
          },
          style: { stroke: '#111827', strokeWidth: 2 },
          label: e.field,
          labelStyle: { fill: '#111827', fontSize: 12, fontWeight: 500 }
        };
      });
      console.log('Final edges with markers:', finalEdges);
      setEdges(finalEdges);
    }
    load();
  }, [elk, layoutStyle, groupByDomains]);

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
        
        // Auto-size based on content
        const lines = raw.split('\n');
        const maxLineLength = Math.max(...lines.map(l => l.length));
        const charWidth = 7.2; // approximate width of monospace char at font-size 12
        const estimatedWidth = Math.min(800, Math.max(400, maxLineLength * charWidth + 48));
        setDetailsWidth(estimatedWidth);
      } catch (err) {
        console.error('Failed to fetch raw JSON:', err);
        setRawJson(`Error loading file: ${err.message}`);
      }
    }
    fetchRaw();
  }, [selectedEntity]);

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

  return (
    <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0, flexDirection: 'column' }}>
      {/* Layout controls */}
      <Box sx={{ 
        display: 'flex', 
        gap: 2, 
        p: 1.5, 
        borderBottom: '1px solid #e5e7eb',
        bgcolor: 'background.paper',
        alignItems: 'center'
      }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13, minWidth: 80 }}>
            Layout:
          </Typography>
          <select
            value={layoutStyle}
            onChange={(e) => onLayoutChange(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '13px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '140px'
            }}
          >
            <option value="hierarchical">Hierarchical</option>
            <option value="force">Force Directed</option>
            <option value="star">Star Schema</option>
          </select>
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <input
            type="checkbox"
            checked={groupByDomains}
            onChange={(e) => onGroupDomainsChange(e.target.checked)}
            id="group-domains-toggle"
            style={{ cursor: 'pointer' }}
          />
          <label 
            htmlFor="group-domains-toggle" 
            style={{ fontSize: '13px', cursor: 'pointer', userSelect: 'none' }}
          >
            Group by domains
          </label>
        </Box>
      </Box>
      
      <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
          <ReactFlow
        nodes={nodes.map(n => (
          selectedId === n.id ? { ...n, style: { outline: '2px solid #ef4444', borderRadius: 8 } } : n
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
      </Box>
      
      {/* Details Panel */}
      {selectedEntity && (
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
                  {selectedEntity.title}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  <IconButton
                    size="small"
                    onClick={() => setDetailsWidth(Math.max(300, detailsWidth - 100))}
                    title="Decrease width"
                  >
                    â—€
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setDetailsWidth(Math.min(800, detailsWidth + 100))}
                    title="Increase width"
                  >
                    â–¶
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setDetailsExpanded(false)}
                    title="Close panel"
                  >
                    âœ•
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
                {rawJson ? <JsonHighlighter code={rawJson} /> : 'Loading...'}
              </Box>
            </>
          )}
          </Box>
        </>
      )}
      
      {/* Collapsed panel toggle */}
      {selectedEntity && !detailsExpanded && (
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
    </Box>
  );
}
