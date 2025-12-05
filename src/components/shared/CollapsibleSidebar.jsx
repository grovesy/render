// src/components/shared/CollapsibleSidebar.jsx
import React, { useState, useEffect } from "react";
import { Box, IconButton, Typography } from "@mui/material";

export default function CollapsibleSidebar({ 
  children,
  defaultExpanded = true,
  minWidth = 260,
  maxWidth = 600,
  defaultWidth = 260,
  title = ""
}) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [width, setWidth] = useState(defaultWidth);
  const [isResizing, setIsResizing] = useState(false);

  // Handle mouse resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = e.clientX;
      setWidth(Math.min(maxWidth, Math.max(minWidth, newWidth)));
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isResizing, minWidth, maxWidth]);

  return (
    <>
      <Box
        sx={{
          width: isExpanded ? width : 0,
          minWidth: isExpanded ? minWidth : 0,
          maxWidth: isExpanded ? maxWidth : 0,
          bgcolor: "background.default",
          display: "flex",
          flexDirection: "column",
          minHeight: 0,
          borderRight: 1,
          borderColor: 'divider',
          transition: isResizing ? 'none' : 'width 0.2s ease-in-out',
          overflow: 'hidden',
        }}
      >
        {isExpanded && (
          <>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                p: 1.5,
                borderBottom: 1,
                borderColor: 'divider',
              }}
            >
              <Typography variant="subtitle1" sx={{ fontWeight: 600, fontSize: 14 }}>
                {title}
              </Typography>
              <Box sx={{ display: 'flex', gap: 0.5 }}>
                <IconButton
                  size="small"
                  onClick={() => setWidth(Math.max(minWidth, width - 100))}
                  title="Decrease width"
                >
                  ◀
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setWidth(Math.min(maxWidth, width + 100))}
                  title="Increase width"
                >
                  ▶
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setIsExpanded(false)}
                  title="Close sidebar"
                >
                  ✕
                </IconButton>
              </Box>
            </Box>
            <Box sx={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
              {children}
            </Box>
          </>
        )}
      </Box>

      {/* Resize handle */}
      {isExpanded && (
        <Box
          onMouseDown={() => setIsResizing(true)}
          sx={{
            width: 4,
            bgcolor: isResizing ? 'primary.main' : 'transparent',
            cursor: 'col-resize',
            transition: 'background-color 0.15s',
            '&:hover': {
              bgcolor: 'primary.light',
            },
            userSelect: 'none',
          }}
        />
      )}

      {/* Collapsed toggle button */}
      {!isExpanded && (
        <Box
          sx={{
            width: 32,
            bgcolor: 'background.default',
            borderRight: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setIsExpanded(true)}
        >
          <IconButton size="small" title="Open sidebar">
            ▶
          </IconButton>
        </Box>
      )}
    </>
  );
}
