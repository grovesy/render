// src/hooks/useGraphLayout.js
import { useState, useEffect } from "react";
import { 
  buildNodes, 
  buildEdges, 
  validateEdges, 
  applyDomainGrouping, 
  getElkLayoutOptions 
} from "../lib/layoutUtils";
import { formatEdges } from "../lib/edgeUtils";

export function useGraphLayout(elk, graphData, layoutStyle, groupByDomains, collapsedNodes, setCollapsedNodes) {
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  useEffect(() => {
    if (!elk || !graphData) return;
    
    async function layoutGraph() {
      // Initialize collapsed state on first load
      if (Object.keys(collapsedNodes).length === 0) {
        const initialCollapsed = {};
        (graphData.entities || []).forEach((e) => {
          initialCollapsed[`${e.domain}:${e.model}`] = true;
        });
        setCollapsedNodes(initialCollapsed);
      }

      // Build nodes and edges
      const tempNodes = buildNodes(graphData.entities, collapsedNodes, (nodeId) => {
        setCollapsedNodes(prev => ({
          ...prev,
          [nodeId]: !prev[nodeId]
        }));
      });

      const tempEdges = buildEdges(graphData.entities);
      const validEdges = validateEdges(tempEdges, tempNodes);

      // Configure ELK layout
      const layoutOptions = getElkLayoutOptions(layoutStyle);
      const elkGraph = {
        id: "root",
        layoutOptions,
        children: tempNodes.map(n => ({ 
          id: n.id, 
          width: n.width, 
          height: n.height 
        })),
        edges: validEdges.map(e => ({ 
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

      // Apply positions
      const positionedNodes = tempNodes.map(n => ({
        ...n,
        position: posMap[n.id] || { x: 0, y: 0 }
      }));

      // Apply domain grouping if enabled
      const domainBoxNodes = groupByDomains ? applyDomainGrouping(positionedNodes) : [];

      setNodes([...domainBoxNodes, ...positionedNodes]);
      
      // Format edges with styling and routing
      const finalEdges = formatEdges(validEdges, positionedNodes);
      setEdges(finalEdges);
    }
    
    layoutGraph();
  }, [elk, layoutStyle, groupByDomains, collapsedNodes, graphData, setCollapsedNodes]);

  return { nodes, edges };
}
