// src/components/RFModelGraphView.jsx
import React, { useEffect, useState, useRef } from "react";
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

export default function RFModelGraphView({ selectedKey, layoutStyle, groupByDomains, viewMode, onLayoutChange, onGroupDomainsChange, onViewModeChange }) {
  const [elk, setElk] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [graphData, setGraphData] = useState(null);
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [detailsWidth, setDetailsWidth] = useState(400);
  const [rawJson, setRawJson] = useState(null);
  const [isResizing, setIsResizing] = useState(false);
  const [collapsedNodes, setCollapsedNodes] = useState({}); // Track which nodes are collapsed
  const [allCollapsed, setAllCollapsed] = useState(true); // Global collapse state - start collapsed
  const reactFlowInstance = useRef(null);
  const tableRowRefs = useRef({});

  // Sync selectedKey from parent
  useEffect(() => {
    if (selectedKey) {
      setSelectedId(selectedKey);
    }
  }, [selectedKey]);

  // Auto-focus on selected model
  useEffect(() => {
    if (!selectedId) return;

    if (viewMode === 'graph' && reactFlowInstance.current) {
      // Focus on node in graph view
      const node = nodes.find(n => n.id === selectedId);
      if (node) {
        reactFlowInstance.current.fitView({
          nodes: [{ id: selectedId }],
          duration: 400,
          padding: 0.3,
        });
      }
    } else if (viewMode === 'table' && tableRowRefs.current[selectedId]) {
      // Scroll to row in table view
      tableRowRefs.current[selectedId].scrollIntoView({
        behavior: 'smooth',
        block: 'center',
      });
    }
  }, [selectedId, viewMode, nodes]);

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

      // Initialize collapsed state for all nodes on first load
      if (Object.keys(collapsedNodes).length === 0) {
        const initialCollapsed = {};
        (fetchedGraphData.entities || []).forEach((e) => {
          initialCollapsed[`${e.domain}:${e.model}`] = true; // Start collapsed
        });
        setCollapsedNodes(initialCollapsed);
      }

      // Build nodes with measured size based on collapse state
      const tempNodes = (fetchedGraphData.entities || []).map((e) => {
        const rowH = 24; const headerH = 44; const padding = 12;
        const nodeId = `${e.domain}:${e.model}`;
        const isCollapsed = collapsedNodes[nodeId] !== undefined ? collapsedNodes[nodeId] : true;
        const maxField = Math.max(...(e.attrs || []).map(a => (a.field || "").length), 0);
        const charW = 8; const sepX = padding + maxField * charW + 12;
        const width = Math.max(240, sepX + 120 + padding);
        const expandedHeight = headerH + padding + (e.attrs || []).length * rowH + padding;
        const height = isCollapsed ? headerH : expandedHeight;
        
        return {
          id: nodeId,
          type: "uml",
          data: { 
            title: e.title, 
            attrs: e.attrs,
            domain: e.domain,
            model: e.model,
            collapsed: isCollapsed,
            onToggleCollapse: () => {
              setCollapsedNodes(prev => ({
                ...prev,
                [nodeId]: !prev[nodeId]
              }));
            }
          },
          position: { x: 0, y: 0 },
          width,
          height,
        };
      });

      // Build a set of valid node IDs for edge validation
      const validNodeIds = new Set(tempNodes.map(n => n.id));

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
          
          // Skip edges where target node doesn't exist
          if (!validNodeIds.has(targetId)) {
            console.warn(`Skipping edge ${edgeId}: target node "${targetId}" not found`);
            return;
          }
          
          console.log('Creating edge:', { edgeId, sourceId, targetId, field: r.field, cardinality: r.cardinality });
          tempEdges.push({ 
            id: edgeId, 
            source: sourceId, 
            target: targetId,
            field: r.field,
            cardinality: r.cardinality || "1"
          });
        });
      });

      console.log('Total edges created:', tempEdges.length);

      // Build reverse cardinality map: count how many edges point to each target
      const reverseCardinalityMap = new Map();
      tempEdges.forEach(e => {
        const key = `${e.target}:${e.field}`;
        reverseCardinalityMap.set(key, (reverseCardinalityMap.get(key) || 0) + 1);
      });
      
      // Also check if multiple different sources point to same target (indicating * on target side)
      const targetSourceMap = new Map();
      tempEdges.forEach(e => {
        if (!targetSourceMap.has(e.target)) {
          targetSourceMap.set(e.target, new Set());
        }
        targetSourceMap.get(e.target).add(e.source);
      });

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
          // Source side is * (many can have this ref), target is the cardinality from schema
          label: e.cardinality ? `[*] ${e.field} [${e.cardinality}]` : e.field,
          labelStyle: { fill: '#111827', fontSize: 12, fontWeight: 500 }
        };
      });
      console.log('Final edges with markers:', finalEdges);
      setEdges(finalEdges);
    }
    load();
  }, [elk, layoutStyle, groupByDomains, collapsedNodes]);

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
            View:
          </Typography>
          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value)}
            style={{
              padding: '4px 8px',
              fontSize: '13px',
              border: '1px solid #d1d5db',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              minWidth: '100px'
            }}
          >
            <option value="graph">Graph</option>
            <option value="table">Table</option>
          </select>
        </Box>
        
        {viewMode === 'graph' && (
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
        )}
        
        {viewMode === 'graph' && (
          <>
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
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <button
                onClick={handleGlobalToggle}
                style={{
                  padding: '4px 12px',
                  fontSize: '13px',
                  border: '1px solid #d1d5db',
                  borderRadius: '4px',
                  backgroundColor: 'white',
                  cursor: 'pointer',
                  fontWeight: 500
                }}
                title={allCollapsed ? "Expand all nodes" : "Collapse all nodes"}
              >
                {allCollapsed ? '▼ Expand All' : '▲ Collapse All'}
              </button>
            </Box>
          </>
        )}
      </Box>
      
      <Box sx={{ display: 'flex', flex: 1, minWidth: 0, minHeight: 0 }}>
        {viewMode === 'graph' ? (
          <Box sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
            <ReactFlow
        nodes={nodes.map(n => (
          selectedId === n.id ? { ...n, style: { outline: '2px solid #ef4444', borderRadius: 8 } } : n
        ))}
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
        ) : (
          <Box sx={{ flex: 1, overflowY: 'auto', p: 3 }}>
            {graphData && graphData.entities && (() => {
              // Group entities by domain
              const domainGroups = {};
              graphData.entities.forEach(entity => {
                if (!domainGroups[entity.domain]) {
                  domainGroups[entity.domain] = [];
                }
                domainGroups[entity.domain].push(entity);
              });

              return Object.entries(domainGroups).map(([domain, entities]) => (
                <Box 
                  key={domain} 
                  sx={{ 
                    mb: 6,
                    p: 3,
                    backgroundColor: '#f8fafc',
                    borderRadius: 2,
                    border: '2px solid #e2e8f0',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}
                >
                  <Typography 
                    variant="h6" 
                    sx={{ 
                      mb: 3, 
                      pb: 2, 
                      borderBottom: '3px solid #3b82f6',
                      fontWeight: 700,
                      color: '#1e40af',
                      fontSize: 18
                    }}
                  >
                    {domain}
                  </Typography>
                  <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f3f4f6', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Model</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Field</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Type</th>
                        <th style={{ padding: '12px', textAlign: 'left', fontWeight: 600, fontSize: 13 }}>References</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entities.map((entity, entityIdx) => {
                        const rowCount = Math.max(entity.attrs.length, 1);
                        const isLastEntity = entityIdx === entities.length - 1;
                        return entity.attrs.length > 0 ? (
                          entity.attrs.map((attr, idx) => {
                            const ref = entity.refs.find(r => r.field === attr.field);
                            const isLastAttr = idx === entity.attrs.length - 1;
                            return (
                              <tr 
                                key={`${entity.domain}:${entity.model}:${idx}`}
                                ref={idx === 0 ? (el) => { tableRowRefs.current[`${entity.domain}:${entity.model}`] = el; } : null}
                                style={{ 
                                  borderBottom: isLastAttr && !isLastEntity ? '3px solid #cbd5e1' : '1px solid #e5e7eb',
                                  cursor: 'pointer',
                                  backgroundColor: selectedId === `${entity.domain}:${entity.model}` ? '#fef3c7' : 'white'
                                }}
                                onClick={() => setSelectedId(`${entity.domain}:${entity.model}`)}
                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = selectedId === `${entity.domain}:${entity.model}` ? '#fef3c7' : '#f9fafb'}
                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedId === `${entity.domain}:${entity.model}` ? '#fef3c7' : 'white'}
                              >
                                {idx === 0 && (
                                  <td rowSpan={rowCount} style={{ padding: '12px', fontWeight: 600, fontSize: 13, verticalAlign: 'top', borderRight: '1px solid #f3f4f6' }}>{entity.title}</td>
                                )}
                                <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 12 }}>{attr.field}</td>
                                <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 12, color: '#059669' }}>{attr.type}</td>
                                <td style={{ padding: '12px', fontFamily: 'monospace', fontSize: 11, color: '#6b7280' }}>
                                  {ref ? `${ref.ref} [${ref.cardinality}]` : ''}
                                </td>
                              </tr>
                            );
                          })
                        ) : (
                          <tr 
                            key={`${entity.domain}:${entity.model}`}
                            ref={(el) => { tableRowRefs.current[`${entity.domain}:${entity.model}`] = el; }}
                            style={{ 
                              borderBottom: !isLastEntity ? '3px solid #cbd5e1' : '1px solid #e5e7eb',
                              cursor: 'pointer',
                              backgroundColor: selectedId === `${entity.domain}:${entity.model}` ? '#fef3c7' : 'white'
                            }}
                            onClick={() => setSelectedId(`${entity.domain}:${entity.model}`)}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = selectedId === `${entity.domain}:${entity.model}` ? '#fef3c7' : 'white'}
                          >
                            <td style={{ padding: '12px', fontWeight: 600, fontSize: 13 }}>{entity.title}</td>
                            <td style={{ padding: '12px', fontStyle: 'italic', color: '#9ca3af' }}>No fields</td>
                            <td style={{ padding: '12px' }}></td>
                            <td style={{ padding: '12px' }}></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </Box>
              ));
            })()}
          </Box>
        )}
      
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
                    onClick={() => setDetailsWidth(Math.min(800, detailsWidth + 100))}
                    title="Increase width"
                  >
                    ◀
                  </IconButton>
                  <IconButton
                    size="small"
                    onClick={() => setDetailsWidth(Math.max(300, detailsWidth - 100))}
                    title="Decrease width"
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
