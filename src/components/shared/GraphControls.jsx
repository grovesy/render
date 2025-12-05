// src/components/shared/GraphControls.jsx
import React from "react";
import { Box, Typography } from "@mui/material";

export default function GraphControls({
  viewMode,
  layoutStyle,
  groupByDomains,
  allCollapsed,
  onViewModeChange,
  onLayoutChange,
  onGroupDomainsChange,
  onGlobalToggle
}) {
  return (
    <Box sx={{ 
      display: 'flex', 
      gap: 2, 
      p: 1.5, 
      borderBottom: 1,
      borderColor: 'divider',
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
          className="theme-select"
        >
          <option value="graph">Graph</option>
          <option value="table">Table</option>
          <option value="json">JSON</option>
        </select>
      </Box>
      
      {viewMode === 'graph' && (
        <>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: 500, fontSize: 13, minWidth: 80 }}>
              Layout:
            </Typography>
            <select
              value={layoutStyle}
              onChange={(e) => onLayoutChange(e.target.value)}
              className="theme-select"
              style={{ minWidth: '140px' }}
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
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <button
              onClick={onGlobalToggle}
              className="theme-button"
              title={allCollapsed ? "Expand all nodes" : "Collapse all nodes"}
            >
              {allCollapsed ? '▼ Expand All' : '▲ Collapse All'}
            </button>
          </Box>
        </>
      )}
    </Box>
  );
}
