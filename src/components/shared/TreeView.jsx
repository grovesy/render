// src/components/shared/TreeView.jsx
import React, { useState } from "react";
import {
  Box,
  List,
  ListItemButton,
  Typography,
  Collapse,
} from "@mui/material";

/**
 * Generic TreeView component
 * 
 * @param {Object} tree - Tree structure: { nodeName: { children: {}, items: [], fullPath: '' } }
 * @param {Function} onItemClick - Callback when an item is clicked (path)
 * @param {string} selectedItemId - Currently selected item identifier
 * @param {Function} getItemId - Function to generate item ID from item object
 * @param {Function} renderItem - Function to render item display (item) => ReactNode
 */
function TreeNode({ name, node, level, selectedItemId, onItemClick, getItemId, renderItem, expanded, onToggle }) {
  const hasChildren = Object.keys(node.children || {}).length > 0;
  const hasItems = node.items && node.items.length > 0;
  const isExpanded = expanded[node.fullPath] !== false; // default true

  return (
    <Box>
      {hasChildren || hasItems ? (
        <>
          <ListItemButton
            dense
            className={`tree-folder-button ${hasItems ? 'has-items' : ''}`}
            sx={{ pl: 2 + level * 1.5 }}
            onClick={() => onToggle(node.fullPath)}
          >
            <Typography 
              variant="caption" 
              className={`tree-folder-label ${hasItems ? 'has-items' : ''}`}
            >
              {isExpanded ? '▼' : '▶'} {name}
            </Typography>
          </ListItemButton>
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            {hasItems && node.items.map((item) => {
              const itemId = getItemId(item, node);
              const isSelected = selectedItemId && itemId === selectedItemId;
              
              return (
                <ListItemButton
                  key={item.path || itemId}
                  dense
                  className={`tree-item-button ${isSelected ? 'selected' : ''}`}
                  sx={{ pl: 3 + (level + 1) * 1.5 }}
                  onClick={() => onItemClick(item)}
                >
                  <Typography 
                    variant="body2" 
                    className={`tree-item-label ${isSelected ? 'selected' : ''}`}
                  >
                    {renderItem(item)}
                  </Typography>
                </ListItemButton>
              );
            })}
            {hasChildren && Object.entries(node.children).map(([childName, childNode]) => (
              <TreeNode
                key={childName}
                name={childName}
                node={childNode}
                level={level + 1}
                selectedItemId={selectedItemId}
                onItemClick={onItemClick}
                getItemId={getItemId}
                renderItem={renderItem}
                expanded={expanded}
                onToggle={onToggle}
              />
            ))}
          </Collapse>
        </>
      ) : null}
    </Box>
  );
}

export default function TreeView({ 
  tree, 
  onItemClick, 
  selectedItemId,
  getItemId = (item) => item.path,
  renderItem = (item) => item.name,
  emptyMessage = "No items found"
}) {
  const [expanded, setExpanded] = useState({});

  const handleToggle = (path) => {
    setExpanded(prev => ({
      ...prev,
      [path]: prev[path] === false ? true : false
    }));
  };

  return (
    <List dense>
      {Object.keys(tree).length === 0 && (
        <Typography
          variant="caption"
          sx={{ px: 2, py: 1, color: "text.disabled" }}
        >
          {emptyMessage}
        </Typography>
      )}
      {Object.entries(tree).map(([rootName, rootNode]) => (
        <TreeNode
          key={rootName}
          name={rootName}
          node={rootNode}
          level={0}
          selectedItemId={selectedItemId}
          onItemClick={onItemClick}
          getItemId={getItemId}
          renderItem={renderItem}
          expanded={expanded}
          onToggle={handleToggle}
        />
      ))}
    </List>
  );
}
