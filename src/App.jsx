// src/App.jsx
import React, { useEffect, useState, useCallback } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Tabs,
  Tab,
  Typography,
  Divider,
} from "@mui/material";
import LeftSidebar from "./components/LeftSidebar";
import GraphView from "./components/GraphView";
import ConceptGraphView from "./components/ConceptGraphView";

// API base from Vite env: VITE_API_BASE_URL=http://localhost:3000
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.replace(/\/$/, "");

const theme = createTheme({
  palette: {
    mode: "light",
    background: {
      default: "#f3f4f6",
      paper: "#ffffff",
    },
  },
  typography: {
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
  },
});

export default function App() {
  const [tab, setTab] = useState("model");
  const [fileIndex, setFileIndex] = useState({
    jsonModels: [],
    markdown: [],
    concepts: [],
  });

  const [selectedModelKey, setSelectedModelKey] = useState(null); // `${domain}:${model}`
  const [selectedConceptPath, setSelectedConceptPath] = useState(null);

  const [filesError, setFilesError] = useState("");

  // -------- Fetch /files once ----------
  useEffect(() => {
    async function loadFiles() {
      try {
        const res = await fetch(`${API_BASE}/files`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFileIndex(data);
        setFilesError("");
      } catch (err) {
        console.error("[App] Failed to load /files:", err);
        setFilesError(err.message || "Failed to load files index");
      }
    }
    loadFiles();
  }, []);

  // -------- Handle JSON file click (resolve to `${domain}:${model}`) ----------
  const handleJsonFileClick = useCallback(async (filePath) => {
    try {
      const url = `${API_BASE}/file?path=${encodeURIComponent(filePath)}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      let schema;
      try {
        schema = JSON.parse(text);
      } catch (e) {
        console.error("[App] File is not valid JSON:", e);
        return;
      }

      const idStr = schema.$id || schema.id;
      if (!idStr || !idStr.startsWith("data://")) {
        console.warn("[App] Schema has no $id/id or unexpected format:", idStr);
        return;
      }

      // parse: data://<domain>/model/<version>/<model-name>
      const without = idStr.slice("data://".length);
      const [domain, rest] = without.split("/model/");
      if (!domain || !rest) {
        console.warn("[App] Cannot parse schema id:", idStr);
        return;
      }
      const [, modelName] = rest.split("/");
      if (!modelName) {
        console.warn("[App] Cannot parse model name from:", idStr);
        return;
      }

      const key = `${domain}:${modelName}`;
      console.log("[App] Selecting model key from JSON file:", {
        filePath,
        idStr,
        domain,
        modelName,
        key,
      });

      setSelectedModelKey(key);
      setTab("model");
    } catch (err) {
      console.error("[App] handleJsonFileClick error:", err);
    }
  }, []);

  // -------- Handle concept file click ----------
  const handleConceptFileClick = useCallback((filePath) => {
    console.log("[App] Selecting concept file:", filePath);
    setSelectedConceptPath(filePath);
    setTab("concept");
  }, []);

  const handleTabChange = (event, value) => {
    setTab(value);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Top bar */}
        <AppBar position="static" elevation={1} color="default">
          <Toolbar sx={{ gap: 2 }}>
            <Typography variant="h6" sx={{ flexShrink: 0 }}>
              Schema & Concept Explorer
            </Typography>
            <Tabs
              value={tab}
              onChange={handleTabChange}
              textColor="primary"
              indicatorColor="primary"
              sx={{ ml: 4 }}
            >
              <Tab value="model" label="Model" />
              <Tab value="concept" label="Concept" />
            </Tabs>
          </Toolbar>
        </AppBar>

        {/* Main content: left sidebar + graph area */}
        <Box
          sx={{
            display: "flex",
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Left sidebar */}
          <Box
            sx={{
              width: 260,
              borderRight: 1,
              borderColor: "divider",
              bgcolor: "background.paper",
              display: "flex",
              flexDirection: "column",
              minHeight: 0,
            }}
          >
            <Box sx={{ p: 1 }}>
              <Typography
                variant="caption"
                sx={{ textTransform: "uppercase", color: "text.secondary" }}
              >
                Files
              </Typography>
            </Box>
            <Divider />
            {filesError ? (
              <Box sx={{ p: 1, color: "error.main", fontSize: 12 }}>
                {filesError}
              </Box>
            ) : (
              <LeftSidebar
                fileIndex={fileIndex}
                onJsonFileClick={handleJsonFileClick}
                onConceptFileClick={handleConceptFileClick}
              />
            )}
          </Box>

          {/* Main graph view */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              minHeight: 0,
              display: "flex",
              bgcolor: "#f9fafb",
            }}
          >
            {tab === "model" ? (
              <GraphView selectedKey={selectedModelKey} />
            ) : (
              <ConceptGraphView conceptPath={selectedConceptPath} />
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
