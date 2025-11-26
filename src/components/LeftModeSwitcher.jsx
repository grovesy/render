// src/components/LeftModeSwitcher.jsx
import React from "react";
import { Box, IconButton, Tooltip } from "@mui/material";

function ModelIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M3 7c0 1.657 4.03 3 9 3s9-1.343 9-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 12c0 1.657 4.03 3 9 3s9-1.343 9-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 17c0 1.657 4.03 3 9 3s9-1.343 9-3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ConceptIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M9 18h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 3v1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 7a4.5 4.5 0 0 1 9 0c0 2.5-2 3.5-2.5 4a1 1 0 0 0-.5.866V14h-3v-2.134A1 1 0 0 0 10 11c-.5-.5-2.5-1.5-2.5-4z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ADRIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 2v6h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 13h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 17h8" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function LeftModeSwitcher({ mode, onChange }) {
  return (
    <Box
      sx={{
        width: 72,
        borderColor: "divider",
        bgcolor: "background.paper",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 1,
        py: 2,
      }}
    >
      <Tooltip title="Models" placement="right" arrow>
        <IconButton
          size="small"
          color={mode === "models" ? "primary" : "default"}
          onClick={() => onChange("models")}
          aria-label="Models"
        >
          <ModelIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="Concepts" placement="right" arrow>
        <IconButton
          size="small"
          color={mode === "concepts" ? "primary" : "default"}
          onClick={() => onChange("concepts")}
          aria-label="Concepts"
        >
          <ConceptIcon />
        </IconButton>
      </Tooltip>

      <Tooltip title="ADRs" placement="right" arrow>
        <IconButton
          size="small"
          color={mode === "adrs" ? "primary" : "default"}
          onClick={() => onChange("adrs")}
          aria-label="ADRs"
        >
          <ADRIcon />
        </IconButton>
      </Tooltip>
    </Box>
  );
}
