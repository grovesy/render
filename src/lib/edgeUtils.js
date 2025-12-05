// src/lib/edgeUtils.js
import { MarkerType } from "@xyflow/react";

/**
 * Determine edge handles based on node positions
 */
export function determineEdgeHandles(sourceNode, targetNode) {
  let sourceHandle = 'right';
  let targetHandle = 'left';
  
  if (sourceNode && targetNode) {
    if (sourceNode.position.x > targetNode.position.x) {
      sourceHandle = 'left';
      targetHandle = 'right';
    }
  }
  
  return { sourceHandle, targetHandle };
}

/**
 * Format edges with visual styling and routing
 */
export function formatEdges(edges, positionedNodes) {
  return edges.map(e => {
    const sourceNode = positionedNodes.find(n => n.id === e.source);
    const targetNode = positionedNodes.find(n => n.id === e.target);
    const { sourceHandle, targetHandle } = determineEdgeHandles(sourceNode, targetNode);
    
    return {
      ...e,
      type: 'default',
      sourceHandle,
      targetHandle,
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 20,
        height: 20
      },
      label: e.cardinality ? `[*] ${e.field} [${e.cardinality}]` : e.field
    };
  });
}
