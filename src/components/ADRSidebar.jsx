// src/components/ADRSidebar.jsx
import React, { useMemo } from "react";
import { Box } from "@mui/material";
import TreeView from "./shared/TreeView";

function groupByDir(files) {
  const groups = {};
  files.forEach((f) => {
    // Extract parent directory name from path
    const parts = f.path.split(/[/\\]+/);
    const dir = parts.length > 1 ? parts[parts.length - 2] : "(root)";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(f);
  });
  return groups;
}

function buildADRTree(adrGroups) {
  const tree = {};
  
  Object.entries(adrGroups).forEach(([dir, files]) => {
    tree[dir] = {
      children: {},
      items: files,
      fullPath: dir
    };
  });
  
  return tree;
}

export default function ADRSidebar({ adrs, selectedPath, onADRClick }) {
  const adrTree = useMemo(() => {
    const groups = groupByDir(adrs);
    return buildADRTree(groups);
  }, [adrs]);

  return (
    <Box sx={{ flex: 1, overflowY: "auto" }}>
      <TreeView
        tree={adrTree}
        selectedItemId={selectedPath}
        onItemClick={(item) => onADRClick(item.path)}
        getItemId={(item) => item.path}
        renderItem={(item) => item.name}
        emptyMessage="No ADR files found"
      />
    </Box>
  );
}
