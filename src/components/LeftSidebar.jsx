// src/components/LeftSidebar.jsx
import React, { useState } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListSubheader,
  Typography,
  Collapse,
} from "@mui/material";

function groupByDir(files) {
  const groups = {};
  files.forEach((f) => {
    // crude grouping: parent directory name
    const parts = f.path.split(/[/\\]+/);
    const dir = parts.length > 1 ? parts[parts.length - 2] : "(root)";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(f);
  });
  return groups;
}

function buildDomainTree(jsonGroups) {
  const tree = {};
  
  Object.entries(jsonGroups).forEach(([domain, files]) => {
    // Split domain by dots and reverse for DNS-style hierarchy
    // e.g., "account.org.biz" -> ["biz", "org", "account"]
    const parts = domain.split('.').reverse();
    
    let current = tree;
    parts.forEach((part, idx) => {
      if (!current[part]) {
        current[part] = { children: {}, files: [], fullPath: parts.slice(0, idx + 1).reverse().join('.') };
      }
      current = current[part].children;
    });
    
    // Store files at the leaf level
    const leafKey = parts[parts.length - 1];
    let leaf = tree;
    parts.forEach(part => {
      leaf = leaf[part].children;
    });
    
    // Navigate back to set files
    let target = tree;
    for (let i = 0; i < parts.length - 1; i++) {
      target = target[parts[i]].children;
    }
    target[parts[parts.length - 1]].files = files;
  });
  
  return tree;
}

function DomainTreeNode({ name, node, level, onJsonFileClick, expanded, onToggle }) {
  const hasChildren = Object.keys(node.children).length > 0;
  const hasFiles = node.files && node.files.length > 0;
  const isExpanded = expanded[node.fullPath] !== false; // default true

  return (
    <Box>
      {hasChildren || hasFiles ? (
        <>
          <ListItemButton
            dense
            sx={{ 
              pl: 2 + level * 1.5,
              py: 0.5,
              backgroundColor: hasFiles ? 'rgba(59, 130, 246, 0.05)' : 'transparent'
            }}
            onClick={() => onToggle(node.fullPath)}
          >
            <Typography 
              variant="caption" 
              sx={{ 
                fontWeight: hasFiles ? 700 : 600, 
                fontSize: 12,
                color: hasFiles ? '#1e40af' : 'text.primary'
              }}
            >
              {isExpanded ? '▼' : '▶'} {name}
            </Typography>
          </ListItemButton>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            {hasChildren && Object.entries(node.children).map(([childName, childNode]) => (
              <DomainTreeNode
                key={childName}
                name={childName}
                node={childNode}
                level={level + 1}
                onJsonFileClick={onJsonFileClick}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
            {hasFiles && node.files.map((f) => (
              <ListItemButton
                key={f.path}
                dense
                sx={{ pl: 3 + (level + 1) * 1.5, py: 0.3 }}
                onClick={() => onJsonFileClick(f.path)}
              >
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {f.name}
                </Typography>
              </ListItemButton>
            ))}
          </Collapse>
        </>
      ) : null}
    </Box>
  );
}

export default function LeftSidebar({
  fileIndex,
  onJsonFileClick,
  onConceptFileClick,
  viewMode = "all", // 'models' | 'concepts' | 'all'
}) {
  const { jsonModels = [], concepts = [] } = fileIndex;
  const [expanded, setExpanded] = useState({});

  const jsonGroups = groupByDir(jsonModels);
  const conceptGroups = groupByDir(concepts);
  
  const domainTree = buildDomainTree(jsonGroups);

  const handleToggle = (path) => {
    setExpanded(prev => ({
      ...prev,
      [path]: prev[path] === false ? true : false
    }));
  };

  const modelsSection = (
    <List
      dense
        subheader={
          <ListSubheader
            component="div"
            sx={{
              bgcolor: "background.paper",
              textTransform: "uppercase",
              fontSize: 11,
              letterSpacing: "0.08em",
              color: "text.secondary",
            }}
          >
            JSON Models
          </ListSubheader>
        }
      >
        {Object.keys(jsonGroups).length === 0 && (
          <Typography
            variant="caption"
            sx={{ px: 2, py: 1, color: "text.disabled" }}
          >
            No JSON models found
          </Typography>
        )}
        {Object.entries(domainTree).map(([rootName, rootNode]) => (
          <DomainTreeNode
            key={rootName}
            name={rootName}
            node={rootNode}
            level={0}
            onJsonFileClick={onJsonFileClick}
            expanded={expanded}
            onToggle={handleToggle}
          />
        ))}
    </List>
  );

  const conceptsSection = (
    <List dense>
        {Object.keys(conceptGroups).length === 0 && (
          <Typography
            variant="caption"
            sx={{ px: 2, py: 1, color: "text.disabled" }}
          >
            No .concept files found
          </Typography>
        )}
        {Object.entries(conceptGroups).map(([dir, files]) => (
          <Box key={dir}>
            <Typography
              variant="caption"
              sx={{ px: 2, pt: 1, pb: 0.5, color: "text.primary", fontWeight: 700, fontSize: 12 }}
            >
              {dir}
            </Typography>
            {files.map((f) => (
              <ListItemButton
                key={f.path}
                dense
                sx={{ pl: 3 }}
                onClick={() => onConceptFileClick(f.path)}
              >
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {f.name}
                </Typography>
              </ListItemButton>
            ))}
          </Box>
        ))}
    </List>
  );

  return (
    <Box sx={{ flex: 1, overflowY: "auto" }}>
      {viewMode !== "concepts" && modelsSection}
      {viewMode !== "models" && conceptsSection}
    </Box>
  );
}
