// src/components/ADRSidebar.jsx
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
    // Extract parent directory name from path
    const parts = f.path.split(/[/\\]+/);
    const dir = parts.length > 1 ? parts[parts.length - 2] : "(root)";
    if (!groups[dir]) groups[dir] = [];
    groups[dir].push(f);
  });
  return groups;
}

export default function ADRSidebar({ adrs, selectedPath, onADRClick }) {
  const adrGroups = groupByDir(adrs);

  return (
    <Box sx={{ flex: 1, overflowY: "auto" }}>
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
            Architecture Decision Records
          </ListSubheader>
        }
      >
        {Object.keys(adrGroups).length === 0 && (
          <Typography
            variant="caption"
            sx={{ px: 2, py: 1, color: "text.disabled" }}
          >
            No ADR files found
          </Typography>
        )}
        {Object.entries(adrGroups).map(([dir, files]) => (
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
                selected={selectedPath === f.path}
                sx={{ pl: 3 }}
                onClick={() => onADRClick(f.path)}
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
