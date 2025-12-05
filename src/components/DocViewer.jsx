// src/components/DocViewer.jsx
import React, { useEffect, useState, useMemo } from "react";
import { Box, CircularProgress, Typography, useTheme } from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import mermaid from "mermaid";
import ApiClient from "../lib/ApiClient";

const api = ApiClient;

// Mermaid code block component
function MermaidBlock({ children }) {
  const muiTheme = useTheme();
  const isDark = muiTheme.palette.mode === 'dark';
  const [svg, setSvg] = useState("");
  const id = useMemo(() => `mermaid-${Math.random().toString(36).substr(2, 9)}`, []);

  useEffect(() => {
    // Configure Mermaid with theme
    mermaid.initialize({
      startOnLoad: true,
      theme: isDark ? 'dark' : 'default',
      securityLevel: 'loose',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
      themeVariables: isDark ? {
        darkMode: true,
        background: '#121212',
        mainBkg: '#121212',
        primaryColor: '#1e3a5f',
        primaryTextColor: '#e0e0e0',
        primaryBorderColor: '#90caf9',
        lineColor: '#808080',
        secondaryColor: '#2a2a2a',
        tertiaryColor: '#3a3a3a',
      } : {
        background: '#ffffff',
        mainBkg: '#ffffff',
        primaryColor: '#e3f2fd',
        primaryTextColor: '#000000',
        primaryBorderColor: '#1976d2',
        lineColor: '#666666',
        secondaryColor: '#f5f5f5',
        tertiaryColor: '#fafafa',
      }
    });

    if (children) {
      mermaid.render(id, children).then(({ svg }) => {
        setSvg(svg);
      }).catch((err) => {
        console.error("Mermaid rendering error:", err);
        setSvg(`<pre>Error rendering diagram: ${err.message}</pre>`);
      });
    }
  }, [children, isDark, id]);

  return <div className="mermaid" dangerouslySetInnerHTML={{ __html: svg }} />;
}

export default function DocViewer({ selectedPath }) {
  const muiTheme = useTheme();
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
        console.error("Failed to load document:", err);
        setError(err.message || "Failed to load document");
        setLoading(false);
      });
  }, [selectedPath]);

  return (
    <Box
      sx={{
        flex: 1,
        overflow: "auto",
        bgcolor: "background.paper",
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
          Select a document from the list to view…
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
              borderBottom: 1,
              borderColor: 'divider',
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
              bgcolor: 'action.hover',
              px: 0.5,
              py: 0.25,
              borderRadius: 0.5,
              fontSize: "0.9em",
              fontFamily: "monospace",
            },
            "& pre": {
              bgcolor: 'background.paper',
              p: 2,
              borderRadius: 1,
              overflow: "auto",
              mb: 2,
            },
            "& pre code": {
              bgcolor: "transparent",
              p: 0,
            },
            "& table": {
              borderCollapse: "collapse",
              width: "100%",
              mb: 2,
            },
            "& th, & td": {
              border: 1,
              borderColor: 'divider',
              px: 1.5,
              py: 1,
              textAlign: "left",
            },
            "& th": {
              bgcolor: 'background.paper',
              fontWeight: 600,
            },
            "& blockquote": {
              borderLeft: 4,
              borderColor: 'divider',
              pl: 2,
              ml: 0,
              color: "text.secondary",
              fontStyle: "italic",
            },
            "& a": {
              color: 'primary.main',
              textDecoration: "none",
              "&:hover": {
                textDecoration: "underline",
              },
            },
          }}
        >
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ node, inline, className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const language = match ? match[1] : '';
                
                // Render Mermaid diagrams
                if (language === 'mermaid' && !inline) {
                  return <MermaidBlock>{String(children).replace(/\n$/, '')}</MermaidBlock>;
                }
                
                // Regular code blocks
                if (!inline) {
                  return (
                    <pre>
                      <code className={className} {...props}>
                        {children}
                      </code>
                    </pre>
                  );
                }
                
                // Inline code
                return <code className={className} {...props}>{children}</code>;
              },
            }}
          >
            {content}
          </ReactMarkdown>
        </Box>
      )}
    </Box>
  );
}
