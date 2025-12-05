// src/components/LeftSidebar.jsx
import React, { useState, useEffect } from "react";
import {
  Box,
  List,
  ListItemButton,
  ListSubheader,
  Typography,
} from "@mui/material";
import ApiClient from "../lib/ApiClient";
import TreeView from "./shared/TreeView";

const api = ApiClient;

// Helper to extract model key from file
async function getModelKeyFromFile(filePath) {
  try {
    const content = await api.fetchFileContent(filePath);
    const schema = JSON.parse(content);
    const idStr = schema.$id || schema.id;
    
    if (idStr && idStr.startsWith("data://")) {
      const without = idStr.slice("data://".length);
      const [domain, rest] = without.split("/model/");
      if (domain && rest) {
        const [, modelName] = rest.split("/");
        if (modelName) {
          return `${domain}:${modelName}`;
        }
      }
    }
  } catch (err) {
    // Ignore errors
  }
  return null;
}

async function groupByDomain(files) {
  const groups = {};
  
  for (const f of files) {
    try {
      const content = await api.fetchFileContent(f.path);
      const schema = JSON.parse(content);
      const idStr = schema.$id || schema.id;
      
      if (idStr && idStr.startsWith("data://")) {
        // Extract domain from data://<domain>/model/...
        const without = idStr.slice("data://".length);
        const [domain] = without.split("/model/");
        
        if (domain) {
          if (!groups[domain]) groups[domain] = [];
          groups[domain].push(f);
        }
      }
    } catch (err) {
      console.warn(`Failed to parse ${f.path}:`, err);
    }
  }
  
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
        current[part] = { 
          children: {}, 
          items: [], 
          fullPath: parts.slice(0, idx + 1).reverse().join('.') 
        };
      }
      current = current[part];
      
      // Move to children for next iteration
      if (idx < parts.length - 1) {
        current = current.children;
      }
    });
    
    // Store files at the current (leaf) level
    current.items = files;
  });
  
  return tree;
}

function buildConceptTree(conceptGroups) {
  const tree = {};
  
  Object.entries(conceptGroups).forEach(([dir, files]) => {
    tree[dir] = {
      children: {},
      items: files,
      fullPath: dir
    };
  });
  
  return tree;
}

function groupByDir(files) {
  const groups = {};
  files.forEach((f) => {
    const parts = f.path.split(/[/\\]+/);
    const dir = parts.length > 1 ? parts[parts.length - 2] : "(root)";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(f);
  });
  return groups;
}

export default function LeftSidebar({
  fileIndex,
  selectedModelKey,
  onJsonFileClick,
  onConceptFileClick,
  viewMode = "all", // 'models' | 'concepts' | 'all'
}) {
  const { jsonModels = [], concepts = [] } = fileIndex;
  const [jsonGroups, setJsonGroups] = useState({});
  const [domainTree, setDomainTree] = useState({});
  const [conceptTree, setConceptTree] = useState({});

  // Load and group JSON models by domain from $id
  useEffect(() => {
    async function loadGroups() {
      const groups = await groupByDomain(jsonModels);
      setJsonGroups(groups);
      setDomainTree(buildDomainTree(groups));
    }
    if (jsonModels.length > 0) {
      loadGroups();
    }
  }, [jsonModels]);

  // Build concept tree
  useEffect(() => {
    const groups = groupByDir(concepts);
    setConceptTree(buildConceptTree(groups));
  }, [concepts]);

  const modelsSection = (
    <Box>
      <Box sx={{ px: 2, pt: 1, pb: 0.5 }}>
        <Typography
          variant="caption"
          sx={{
            textTransform: "uppercase",
            fontSize: 11,
            letterSpacing: "0.08em",
            color: "text.secondary",
          }}
        >
          JSON Models
        </Typography>
      </Box>
      <TreeView
        tree={domainTree}
        selectedItemId={selectedModelKey}
        onItemClick={(item) => onJsonFileClick(item.path)}
        getItemId={(item, node) => `${node.fullPath}:${item.name.replace('.json', '')}`}
        renderItem={(item) => item.name.replace('.json', '')}
        emptyMessage="No JSON models found"
      />
    </Box>
  );

  const conceptsSection = (
    <Box>
      <TreeView
        tree={conceptTree}
        selectedItemId={null}
        onItemClick={(item) => onConceptFileClick(item.path)}
        getItemId={(item) => item.path}
        renderItem={(item) => item.name}
        emptyMessage="No .concept files found"
      />
    </Box>
  );

  return (
    <Box sx={{ flex: 1, overflowY: "auto" }}>
      {viewMode !== "concepts" && modelsSection}
      {viewMode !== "models" && conceptsSection}
    </Box>
  );
}
