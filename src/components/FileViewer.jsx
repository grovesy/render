// src/components/FileViewer.jsx
import React, { useMemo } from "react";
import { Box, CircularProgress } from "@mui/material";
import { marked } from "marked";

function guessKind(path, defaultKind) {
  if (!path) return defaultKind || "text";
  const lower = path.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".md") || lower.endsWith(".markdown")) return "markdown";
  if (lower.endsWith(".concept")) return "concept";
  return defaultKind || "text";
}

export default function FileViewer({ selectedFile, content, loading }) {
  const rendered = useMemo(() => {
    if (!selectedFile || !content) return null;

    const kind = guessKind(selectedFile.path, selectedFile.kind);
    if (kind === "json") {
      try {
        const obj = JSON.parse(content);
        return JSON.stringify(obj, null, 2);
      } catch {
        return content;
      }
    }
    if (kind === "markdown") {
      return marked.parse(content);
    }
    return content;
  }, [selectedFile, content]);

  return (
    <Box
      sx={{
        flex: 1,
        overflow: "auto",
        bgcolor: 'background.paper',
        p: 1.5,
        fontFamily:
          'SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 12
      }}
    >
      {loading && (
        <Box sx={{ display: "flex", justifyContent: "center", mt: 2 }}>
          <CircularProgress size={20} />
        </Box>
      )}
      {!loading && !selectedFile && (
        <Box sx={{ color: 'text.secondary' }}>Select a file from the navigator…</Box>
      )}
      {!loading && selectedFile && (
        <>
          {guessKind(selectedFile.path, selectedFile.kind) === "markdown" ? (
            <div
              dangerouslySetInnerHTML={{ __html: rendered || "" }}
              style={{ fontFamily: "system-ui" }}
            />
          ) : (
            <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>
              {rendered}
            </pre>
          )}
        </>
      )}
    </Box>
  );
}
