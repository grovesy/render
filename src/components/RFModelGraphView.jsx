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

export default function RFModelGraphView({ selectedKey }) {
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

      // Star schema layout with link tables in center
      const incomingEdgeCount = {};
      const outgoingEdgeCount = {};
      tempNodes.forEach(n => { 
        incomingEdgeCount[n.id] = 0; 
        outgoingEdgeCount[n.id] = 0;
      });
      tempEdges.forEach(e => { 
        incomingEdgeCount[e.target] = (incomingEdgeCount[e.target] || 0) + 1; 
        outgoingEdgeCount[e.source] = (outgoingEdgeCount[e.source] || 0) + 1;
      });

      // Find which domains each node references
      const nodeDomainRefs = {};
      tempNodes.forEach(n => {
        const refsSet = new Set();
        tempEdges.filter(e => e.source === n.id).forEach(e => {
          const targetNode = tempNodes.find(tn => tn.id === e.target);
          if (targetNode) refsSet.add(targetNode.data.domain);
        });
        nodeDomainRefs[n.id] = refsSet;
      });

      // Classify nodes
      const isolatedNodes = tempNodes.filter(n => 
        incomingEdgeCount[n.id] === 0 && outgoingEdgeCount[n.id] === 0
      );
      
      // Link tables: reference multiple domains AND have outgoing edges
      const linkTables = tempNodes.filter(n => 
        nodeDomainRefs[n.id] && nodeDomainRefs[n.id].size > 1
      );
      
      // Main fact tables: high incoming edges, not link tables
      const factTables = tempNodes.filter(n => 
        incomingEdgeCount[n.id] > 0 && 
        !linkTables.includes(n) && 
        !isolatedNodes.includes(n)
      ).sort((a, b) => incomingEdgeCount[b.id] - incomingEdgeCount[a.id]);
      
      // Dimension tables: have outgoing edges but reference single domain
      const dimensionTables = tempNodes.filter(n => 
        outgoingEdgeCount[n.id] > 0 &&
        !linkTables.includes(n) &&
        !factTables.includes(n) &&
        !isolatedNodes.includes(n)
      );

      const positionedNodes = [];
      
      // Position isolated nodes - we'll do this after connected nodes to place them at bottom
      const isolatedPositions = [];
      
      // Track domain boundaries for boxes
      const domainBounds = {};

      const canvasCenterX = 900;
      const canvasCenterY = 600;
      
      // Position link tables in the center - stack vertically if multiple with collision detection
      const linkSpacing = 300;
      const linkVerticalSpacing = 280;
      linkTables.forEach((n, idx) => {
        const row = Math.floor(idx / 2); // 2 per row
        const col = idx % 2;
        const offsetX = (col - 0.5) * linkSpacing;
        const offsetY = (row - (Math.ceil(linkTables.length / 2) - 1) / 2) * linkVerticalSpacing;
        
        const proposedPosition = { 
          x: canvasCenterX + offsetX, 
          y: canvasCenterY + offsetY 
        };
        
        // Check for collisions with already positioned nodes
        const adjustedPosition = adjustPositionForCollision(
          { ...n, position: proposedPosition },
          positionedNodes,
          50
        );
        
        positionedNodes.push({
          ...n,
          position: adjustedPosition
        });
      });

      // Group fact tables by domain and position in clusters
      const factsByDomain = {};
      factTables.forEach(n => {
        if (!factsByDomain[n.data.domain]) factsByDomain[n.data.domain] = [];
        factsByDomain[n.data.domain].push(n);
      });

      const domains = Object.keys(factsByDomain);
      const domainRadius = 600;

      // Calculate vertical space needed for link tables
      const linkTableRows = Math.ceil(linkTables.length / 2);
      const linkTableHeight = linkTableRows * 250;
      const domainVerticalOffset = Math.max(300, linkTableHeight / 2 + 150); // Ensure clearance from link tables

      domains.forEach((domain, domainIdx) => {
        const factsInDomain = factsByDomain[domain];
        
        // Position domain cluster left or right of center
        const isLeft = domainIdx % 2 === 0;
        const domainCenterX = isLeft ? canvasCenterX - domainRadius : canvasCenterX + domainRadius;
        // Spread domains vertically with enough space to avoid link tables
        const domainCenterY = canvasCenterY + (domainIdx - (domains.length - 1) / 2) * domainVerticalOffset;

        // Track bounds for this domain
        let minX = domainCenterX, maxX = domainCenterX, minY = domainCenterY, maxY = domainCenterY;

        // Main fact table(s) at domain center with collision detection
        const mainFact = factsInDomain[0];
        const mainFactProposed = { x: domainCenterX, y: domainCenterY };
        const mainFactAdjusted = adjustPositionForCollision(
          { ...mainFact, position: mainFactProposed },
          positionedNodes,
          60
        );
        
        positionedNodes.push({
          ...mainFact,
          position: mainFactAdjusted
        });
        minX = Math.min(minX, mainFactAdjusted.x);
        maxX = Math.max(maxX, mainFactAdjusted.x + (mainFact.width || 250));
        minY = Math.min(minY, mainFactAdjusted.y);
        maxY = Math.max(maxY, mainFactAdjusted.y + (mainFact.height || 200));

        // Dimension tables for this domain orbit around it (semi-circle on outer side)
        const dimsForDomain = dimensionTables.filter(d => d.data.domain === domain);
        const clusterRadius = 420;
        
        dimsForDomain.forEach((n, idx) => {
          // Arrange vertically on the outer side
          const totalHeight = (dimsForDomain.length - 1) * 280;
          const startY = mainFactAdjusted.y - totalHeight / 2;
          const y = startY + idx * 280;
          const x = isLeft ? domainCenterX - clusterRadius : domainCenterX + clusterRadius;
          
          const proposedPosition = { x, y };
          const adjustedPosition = adjustPositionForCollision(
            { ...n, position: proposedPosition },
            positionedNodes,
            50
          );
          
          positionedNodes.push({
            ...n,
            position: adjustedPosition
          });
          minX = Math.min(minX, adjustedPosition.x);
          maxX = Math.max(maxX, adjustedPosition.x + (n.width || 250));
          minY = Math.min(minY, adjustedPosition.y);
          maxY = Math.max(maxY, adjustedPosition.y + (n.height || 200));
        });
        
        // Store domain bounds with padding
        domainBounds[domain] = { minX: minX - 60, maxX: maxX + 60, minY: minY - 80, maxY: maxY + 40 };
      });

      // Calculate the maximum Y position from all connected nodes
      let maxY = 0;
      positionedNodes.forEach(n => {
        const nodeBottomY = n.position.y + (n.height || 200);
        if (nodeBottomY > maxY) maxY = nodeBottomY;
      });

      // Position isolated nodes at the bottom with clearance
      const bottomStartY = maxY + 300; // 300px clearance from bottom-most connected node
      isolatedNodes.forEach((n, idx) => {
        const row = Math.floor(idx / 4); // 4 columns
        const col = idx % 4;
        positionedNodes.push({
          ...n,
          position: { x: 200 + col * 320, y: bottomStartY + row * 250 }
        });
      });

      // Add domain box background nodes (z-index handled by insertion order)
      const domainBoxNodes = [];
      Object.entries(domainBounds).forEach(([domain, bounds]) => {
        domainBoxNodes.push({
          id: `domain-box-${domain}`,
          type: 'domainBox',
          position: { x: bounds.minX, y: bounds.minY },
          data: {
            label: domain,
            width: bounds.maxX - bounds.minX,
            height: bounds.maxY - bounds.minY
          },
          selectable: false,
          draggable: false,
          zIndex: -1
        });
      });

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
  }, [elk]);

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
            â—€
          </IconButton>
        </Box>
      )}
    </Box>
  );
}
