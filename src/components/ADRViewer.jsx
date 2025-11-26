// src/components/ADRViewer.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Box, CircularProgress, Typography } from "@mui/material";
import { marked } from "marked";
import ApiClient from "../lib/ApiClient";

const api = ApiClient;

export default function ADRViewer({ selectedPath }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!selectedPath) {
      setContent("");
      setError("");
      return;
    }

    setLoading(true);
    setError("");

    api
      .fetchFileContent(selectedPath)
      .then((text) => {
        setContent(text);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load ADR:", err);
        setError(err.message || "Failed to load ADR");
        setLoading(false);
      });
  }, [selectedPath]);

  const renderedHtml = useMemo(() => {
    if (!content) return "";
    try {
      return marked.parse(content);
    } catch (err) {
      console.error("Failed to parse markdown:", err);
      return `<pre>${content}</pre>`;
    }
  }, [content]);

  return (
    <Box
      sx={{
        flex: 1,
        overflow: "auto",
        bgcolor: "#ffffff",
        p: 3,
      }}
    >
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 4 }}>
          <CircularProgress />
        </Box>
      )}
      {!loading && !selectedPath && (
        <Typography variant="body2" sx={{ color: "text.secondary" }}>
          Select an ADR from the list to view…
        </Typography>
      )}
      {!loading && error && (
        <Typography variant="body2" sx={{ color: "error.main" }}>
          Error: {error}
        </Typography>
      )}
      {!loading && selectedPath && !error && (
        <Box
          sx={{
            fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
            fontSize: 14,
            lineHeight: 1.6,
            color: "text.primary",
            "& h1": {
              fontSize: "1.8em",
              fontWeight: 600,
              mb: 2,
              mt: 1,
            },
            "& h2": {
              fontSize: "1.4em",
              fontWeight: 600,
              mb: 1.5,
              mt: 3,
              borderBottom: "1px solid #e5e7eb",
              pb: 0.5,
            },
            "& h3": {
              fontSize: "1.2em",
              fontWeight: 600,
              mb: 1,
              mt: 2,
            },
            "& p": {
              mb: 1.5,
            },
            "& ul, & ol": {
              pl: 3,
              mb: 1.5,
            },
            "& code": {
              bgcolor: "#f3f4f6",
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontSize: "0.9em",
              fontFamily: "monospace",
            },
            "& pre": {
              bgcolor: "#f9fafb",
              p: 2,
              borderRadius: 1,
              overflow: "auto",
              mb: 2,
            },
            "& pre code": {
              bgcolor: "transparent",
              p: 0,
            },
          }}
          dangerouslySetInnerHTML={{ __html: renderedHtml }}
        />
      )}
    </Box>
  );
}
