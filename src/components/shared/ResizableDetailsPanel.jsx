// src/components/shared/ResizableDetailsPanel.jsx
import React, { useState, useEffect } from "react";
import { Box, Typography, IconButton } from "@mui/material";

export default function ResizableDetailsPanel({ 
  isOpen, 
  title, 
  content, 
  onClose,
  initialWidth = 400 
}) {
  const [detailsExpanded, setDetailsExpanded] = useState(true);
  const [detailsWidth, setDetailsWidth] = useState(initialWidth);
  const [isResizing, setIsResizing] = useState(false);

  // Handle mouse resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const newWidth = window.innerWidth - e.clientX;
      setDetailsWidth(Math.min(800, Math.max(300, newWidth)));
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
  }, [isResizing]);

  if (!isOpen) return null;

  return (
    <>
      {/* Resize handle */}
      {detailsExpanded && (
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
      
      {/* Panel */}
      <Box
        sx={{
          width: detailsExpanded ? detailsWidth : 0,
          bgcolor: 'background.default',
          display: 'flex',
          flexDirection: 'column',
          transition: isResizing ? 'none' : 'width 0.2s ease-in-out',
          overflow: 'hidden',
        }}
      >
        {detailsExpanded && (
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
                  onClick={() => setDetailsWidth(Math.min(800, detailsWidth + 100))}
                  title="Increase width"
                >
                  ◀
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setDetailsWidth(Math.max(300, detailsWidth - 100))}
                  title="Decrease width"
                >
                  ▶
                </IconButton>
                <IconButton
                  size="small"
                  onClick={() => setDetailsExpanded(false)}
                  title="Close panel"
                >
                  ✕
                </IconButton>
              </Box>
            </Box>
            <Box
              sx={{
                flex: 1,
                overflowY: 'auto',
                p: 2,
                fontFamily: 'monospace',
                fontSize: 12,
                bgcolor: 'background.default',
              }}
            >
              {content}
            </Box>
          </>
        )}
      </Box>

      {/* Collapsed panel toggle */}
      {!detailsExpanded && (
        <Box
          sx={{
            width: 32,
            bgcolor: 'background.default',
            borderLeft: 1,
            borderColor: 'divider',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          onClick={() => setDetailsExpanded(true)}
        >
          <IconButton size="small" title="Open details panel">
            ◀
          </IconButton>
        </Box>
      )}
    </>
  );
}
