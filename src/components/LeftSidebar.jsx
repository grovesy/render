// src/components/LeftSidebar.jsx
import React from "react";
import {
  Box,
  List,
  ListItemButton,
  ListSubheader,
  Typography,
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

export default function LeftSidebar({
  fileIndex,
  onJsonFileClick,
  onConceptFileClick,
}) {
  const { jsonModels = [], concepts = [] } = fileIndex;

  const jsonGroups = groupByDir(jsonModels);
  const conceptGroups = groupByDir(concepts);

  return (
    <Box sx={{ flex: 1, overflowY: "auto" }}>
      {/* JSON Models */}
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
        {Object.entries(jsonGroups).map(([dir, files]) => (
          <Box key={dir}>
            <Typography
              variant="caption"
              sx={{ px: 2, pt: 1, pb: 0.5, color: "text.secondary" }}
            >
              {dir}
            </Typography>
            {files.map((f) => (
              <ListItemButton
                key={f.path}
                dense
                sx={{ pl: 3 }}
                onClick={() => onJsonFileClick(f.path)}
              >
                <Typography variant="body2" sx={{ fontSize: 13 }}>
                  {f.name}
                </Typography>
              </ListItemButton>
            ))}
          </Box>
        ))}
      </List>

      {/* Concept Files */}
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
            Concept Files
          </ListSubheader>
        }
      >
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
              sx={{ px: 2, pt: 1, pb: 0.5, color: "text.secondary" }}
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
    </Box>
  );
}
