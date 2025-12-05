// src/lib/layoutUtils.js

/**
 * Collision detection and adjustment for nodes
 */
export function adjustPositionForCollision(newNode, existingNodes, minPadding = 40) {
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
      
      const overlapsX = x < existing.position.x + exW + minPadding && 
                        x + width + minPadding > existing.position.x;
      const overlapsY = y < existing.position.y + exH + minPadding && 
                        y + height + minPadding > existing.position.y;
      
      if (overlapsX && overlapsY) {
        hasCollision = true;
        y = existing.position.y + exH + minPadding;
        break;
      }
    }
    attempts++;
  }
  
  return { x, y };
}

/**
 * Get ELK layout options based on layout style
 */
export function getElkLayoutOptions(layoutStyle) {
  if (layoutStyle === 'hierarchical') {
    return {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "120",
      "elk.spacing.nodeNode": "80",
      "elk.layered.nodePlacement.strategy": "NETWORK_SIMPLEX",
    };
  } else if (layoutStyle === 'force') {
    return {
      "elk.algorithm": "force",
      "elk.force.repulsion": "1000",
      "elk.spacing.nodeNode": "100",
    };
  } else if (layoutStyle === 'star') {
    return {
      "elk.algorithm": "layered",
      "elk.direction": "DOWN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "150",
      "elk.spacing.nodeNode": "100",
    };
  }
  return {};
}

/**
 * Calculate node dimensions based on collapse state
 */
export function calculateNodeDimensions(entity, isCollapsed) {
  const rowH = 24;
  const headerH = 44;
  const padding = 12;
  const maxField = Math.max(...(entity.attrs || []).map(a => (a.field || "").length), 0);
  const charW = 8;
  const sepX = padding + maxField * charW + 12;
  const width = Math.max(240, sepX + 120 + padding);
  const expandedHeight = headerH + padding + (entity.attrs || []).length * rowH + padding;
  const height = isCollapsed ? headerH : expandedHeight;
  
  return { width, height };
}

/**
 * Build nodes from graph entities
 */
export function buildNodes(entities, collapsedNodes, onToggleCollapse) {
  return (entities || []).map((e) => {
    const nodeId = `${e.domain}:${e.model}`;
    const isCollapsed = collapsedNodes[nodeId] !== undefined ? collapsedNodes[nodeId] : true;
    const { width, height } = calculateNodeDimensions(e, isCollapsed);
    
    return {
      id: nodeId,
      type: "uml",
      data: { 
        title: e.title, 
        attrs: e.attrs,
        domain: e.domain,
        model: e.model,
        collapsed: isCollapsed,
        onToggleCollapse: () => onToggleCollapse(nodeId)
      },
      position: { x: 0, y: 0 },
      width,
      height,
    };
  });
}

/**
 * Build edges from graph entities
 */
export function buildEdges(entities) {
  const tempEdges = [];
  
  (entities || []).forEach((e) => {
    (e.refs || []).forEach((r) => {
      const clean = r.ref.split("#")[0].replace("data://", "");
      const [refDomain, rest] = clean.split("/model/");
      if (!refDomain || !rest) return;
      const refModel = rest.split("/")[1];
      const edgeId = `${e.domain}:${e.model}-${r.field}`;
      const sourceId = `${e.domain}:${e.model}`;
      const targetId = `${refDomain}:${refModel}`;
      
      tempEdges.push({ 
        id: edgeId, 
        source: sourceId, 
        target: targetId,
        field: r.field,
        cardinality: r.cardinality || "1"
      });
    });
  });
  
  return tempEdges;
}

/**
 * Validate edges against node IDs and filter out invalid ones
 */
export function validateEdges(edges, nodes) {
  const validNodeIds = new Set(nodes.map(n => n.id));
  
  return edges.filter(edge => {
    if (!validNodeIds.has(edge.target)) {
      console.warn(`Skipping edge ${edge.id}: target node "${edge.target}" not found`);
      return false;
    }
    return true;
  });
}

/**
 * Apply domain grouping boxes to nodes
 */
export function applyDomainGrouping(positionedNodes) {
  const nodesByDomain = {};
  positionedNodes.forEach(n => {
    const domain = n.data.domain;
    if (!nodesByDomain[domain]) nodesByDomain[domain] = [];
    nodesByDomain[domain].push(n);
  });

  const placedDomainBoxes = [];
  const domainOffsets = {};
  const domainBoxNodes = [];
  
  Object.keys(nodesByDomain).forEach(domain => {
    const nodesInDomain = nodesByDomain[domain];
    if (nodesInDomain.length === 0) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    nodesInDomain.forEach(n => {
      minX = Math.min(minX, n.position.x);
      maxX = Math.max(maxX, n.position.x + (n.width || 250));
      minY = Math.min(minY, n.position.y);
      maxY = Math.max(maxY, n.position.y + (n.height || 200));
    });
    
    const padding = { left: 60, right: 60, top: 80, bottom: 40 };
    let boxX = minX - padding.left;
    let boxY = minY - padding.top;
    const originalBoxY = boxY;
    const boxWidth = (maxX - minX) + padding.left + padding.right;
    const boxHeight = (maxY - minY) + padding.top + padding.bottom;
    
    // Check for collision with other domain boxes
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
          boxY = placedBox.position.y + placedBox.data.height + 30;
          break;
        }
      }
      attempts++;
    }
    
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

  // Apply domain offsets to nodes
  positionedNodes.forEach(node => {
    const domain = node.data?.domain;
    if (domain && domainOffsets[domain]) {
      const offset = domainOffsets[domain];
      node.position.x += offset.x;
      node.position.y += offset.y;
    }
  });

  return domainBoxNodes;
}
