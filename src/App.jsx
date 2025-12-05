// src/App.jsx
import React, { useEffect, useState, useCallback, useRef } from "react";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Divider,
} from "@mui/material";
import LeftModeSwitcher from "./components/LeftModeSwitcher";
import LeftSidebar from "./components/LeftSidebar";
import ADRSidebar from "./components/ADRSidebar";
import RFModelGraphView from "./components/RFModelGraphView";
import ConceptGraphView from "./components/ConceptGraphView";
import DocViewer from "./components/DocViewer";
import CollapsibleSidebar from "./components/shared/CollapsibleSidebar";
import ThemeSwitcher from "./components/ThemeSwitcher";
import ApiClient from "./lib/ApiClient";
import { readUrlState, useUrlState } from "./hooks/useUrlState";
import { useWebSocket } from "./hooks/useWebSocket";

const api = ApiClient;

export default function App() {
  const [currentTheme, setCurrentTheme] = useState(() => {
    const saved = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved);
    return saved;
  });

  const theme = createTheme({
    palette: {
      mode: (currentTheme === 'light' || currentTheme === 'paper') ? 'light' : 'dark',
      background: 
        currentTheme === 'light' ? { default: "#f3f4f6", paper: "#ffffff" } :
        currentTheme === 'paper' ? { default: "#fafaf8", paper: "#f5f5f0" } :
        currentTheme === 'dark' ? { default: "#121212", paper: "#1e1e1e" } :
        currentTheme === 'purple' ? { default: "#1a0933", paper: "#240046" } :
        currentTheme === 'dracula' ? { default: "#282a36", paper: "#383a59" } :
        currentTheme === 'onedark' ? { default: "#282c34", paper: "#21252b" } :
        currentTheme === 'monokai' ? { default: "#272822", paper: "#1e1f1c" } :
        currentTheme === 'solarized' ? { default: "#002b36", paper: "#073642" } :
        currentTheme === 'nord' ? { default: "#2e3440", paper: "#3b4252" } :
        currentTheme === 'github' ? { default: "#0d1117", paper: "#161b22" } :
        currentTheme === 'dos' ? { default: "#0000aa", paper: "#000088" } :
        currentTheme === 'green' ? { default: "#001100", paper: "#002200" } :
        currentTheme === 'emacs' ? { default: "#2e3436", paper: "#3c3f41" } :
        currentTheme === 'vim' ? { default: "#1c1c1c", paper: "#262626" } :
        currentTheme === 'amber' ? { default: "#0d0d0d", paper: "#1a1a1a" } :
        currentTheme === 'matrix' ? { default: "#000000", paper: "#0a0a0a" } :
        { default: "#121212", paper: "#1e1e1e" },
      divider: 
        currentTheme === 'light' ? '#e5e7eb' :
        currentTheme === 'paper' ? '#e0ddd5' :
        currentTheme === 'dark' ? '#333333' :
        currentTheme === 'purple' ? '#5a189a' :
        currentTheme === 'dracula' ? '#44475a' :
        currentTheme === 'onedark' ? '#3e4451' :
        currentTheme === 'monokai' ? '#49483e' :
        currentTheme === 'solarized' ? '#073642' :
        currentTheme === 'nord' ? '#4c566a' :
        currentTheme === 'github' ? '#30363d' :
        currentTheme === 'dos' ? '#0000ff' :
        currentTheme === 'green' ? '#003300' :
        currentTheme === 'emacs' ? '#555753' :
        currentTheme === 'vim' ? '#3a3a3a' :
        currentTheme === 'amber' ? '#ff9900' :
        currentTheme === 'matrix' ? '#003300' :
        '#333333',
      ...(currentTheme === 'paper' && {
        text: { 
          primary: '#3e2723', 
          secondary: '#6d4c41' 
        },
        primary: { 
          main: '#795548', 
          light: '#a1887f', 
          dark: '#5d4037' 
        },
      }),
    },
    typography: {
      fontFamily: (currentTheme === 'dos' || currentTheme === 'amber' || currentTheme === 'matrix' || currentTheme === 'green' || currentTheme === 'emacs' || currentTheme === 'vim')
        ? '"Courier New", "Courier", monospace'
        : "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    },
  });

  const handleThemeChange = (newTheme) => {
    setCurrentTheme(newTheme);
    localStorage.setItem('theme', newTheme);
  };
  // Read initial state from URL params
  const {
    initialMode,
    initialModel,
    initialConcept,
    initialDoc,
    initialLayout,
    initialGroupDomains,
    initialViewMode
  } = readUrlState();

  const [leftMode, setLeftMode] = useState(initialMode);
  const [fileIndex, setFileIndex] = useState({
    jsonModels: [],
    markdown: [],
    concepts: [],
  });

  const [docs, setDocs] = useState([]);

  const [selectedModelKey, setSelectedModelKey] = useState(initialModel);
  const [selectedConceptPath, setSelectedConceptPath] = useState(initialConcept);
  const [selectedDocPath, setSelectedDocPath] = useState(initialDoc);
  
  const [layoutStyle, setLayoutStyle] = useState(initialLayout);
  const [groupByDomains, setGroupByDomains] = useState(initialGroupDomains);
  const [viewMode, setViewMode] = useState(initialViewMode);

  const [filesError, setFilesError] = useState("");

  // Sync URL with state changes
  useUrlState(leftMode, selectedModelKey, selectedConceptPath, selectedDocPath, layoutStyle, groupByDomains, viewMode);

  // -------- Fetch /files once ----------
  const loadFiles = useCallback(async () => {
    try {
      const data = await api.fetchFilesIndex();
      setFileIndex(data);
      setFilesError("");
      
      // Auto-select first concept if on concepts mode and none selected
      if (leftMode === 'concepts' && !selectedConceptPath && data.concepts && data.concepts.length > 0) {
        setSelectedConceptPath(data.concepts[0].path);
      }
    } catch (err) {
      console.error("[App] Failed to load /files:", err);
      setFilesError(err.message || "Failed to load files index");
    }
  }, [leftMode, selectedConceptPath]);
  
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // -------- Fetch /adrs once ----------
  useEffect(() => {
    async function loadDocs() {
      try {
        const data = await api.fetchADRs();
        setDocs(data.adrs || []);
      } catch (err) {
        console.error("[App] Failed to load /adrs:", err);
      }
    }
    loadDocs();
  }, []);

  // -------- Handle JSON file click (resolve to `${domain}:${model}`) ----------
  const handleJsonFileClick = useCallback(async (filePath) => {
    try {
      const text = await api.fetchFileContent(filePath);
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

      // Toggle selection if clicking the same model
      if (selectedModelKey === key) {
        setSelectedModelKey(null);
      } else {
        setSelectedModelKey(key);
        setLeftMode("models");
      }
    } catch (err) {
      console.error("[App] handleJsonFileClick error:", err);
    }
  }, [selectedModelKey]);

  // -------- Handle concept file click ----------
  const handleConceptFileClick = useCallback((filePath) => {
    console.log("[App] Selecting concept file:", filePath);
    setSelectedConceptPath(filePath);
    setLeftMode("concepts");
  }, []);

  // -------- Handle doc click ----------
  const handleDocClick = useCallback((filePath) => {
    console.log("[App] Selecting doc:", filePath);
    setSelectedDocPath(filePath);
  }, []);

  // WebSocket connection for live reload
  useWebSocket(loadFiles);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ display: "flex", flexDirection: "column", height: "100vh" }}>
        {/* Top bar */}
        <AppBar position="static" elevation={1} color="default">
          <Toolbar sx={{ gap: 2 }}>
            <Typography variant="h6" sx={{ flexShrink: 0, flexGrow: 1 }}>
              Schema & Concept Explorer
            </Typography>
            <ThemeSwitcher currentTheme={currentTheme} onThemeChange={handleThemeChange} />
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
          <Box sx={{ display: "flex", borderRight: 1, borderColor: "divider", minHeight: 0 }}>
            <LeftModeSwitcher
              mode={leftMode}
              onChange={(mode) => {
                setLeftMode(mode);
                // Clear selections when switching modes
                setSelectedModelKey(null);
                setSelectedConceptPath(null);
                setSelectedDocPath(null);
              }}
            />

            <CollapsibleSidebar
              defaultExpanded={true}
              minWidth={260}
              maxWidth={leftMode === "docs" ? 600 : 600}
              defaultWidth={leftMode === "docs" ? 400 : 260}
              title={leftMode === "models" ? "Models" : leftMode === "concepts" ? "Concepts" : "Docs"}
            >
              {filesError ? (
                <Box sx={{ p: 1, color: "error.main", fontSize: 12 }}>
                  {filesError}
                </Box>
              ) : leftMode === "docs" ? (
                <ADRSidebar
                  adrs={docs}
                  selectedPath={selectedDocPath}
                  onADRClick={handleDocClick}
                />
              ) : (
                <LeftSidebar
                  fileIndex={fileIndex}
                  selectedModelKey={selectedModelKey}
                  onJsonFileClick={handleJsonFileClick}
                  onConceptFileClick={handleConceptFileClick}
                  viewMode={leftMode === "models" ? "models" : leftMode === "concepts" ? "concepts" : "all"}
                />
              )}
            </CollapsibleSidebar>
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
            {leftMode === "models" ? (
              <RFModelGraphView 
                selectedKey={selectedModelKey}
                layoutStyle={layoutStyle}
                groupByDomains={groupByDomains}
                viewMode={viewMode}
                onLayoutChange={(newLayout) => {
                  setSelectedModelKey(null);
                  setLayoutStyle(newLayout);
                }}
                onGroupDomainsChange={(newGroup) => {
                  setSelectedModelKey(null);
                  setGroupByDomains(newGroup);
                }}
                onViewModeChange={(newViewMode) => {
                  setViewMode(newViewMode);
                  setSelectedModelKey(null);
                }}
              />
            ) : leftMode === "concepts" ? (
              <ConceptGraphView conceptPath={selectedConceptPath} />
            ) : (
              <DocViewer selectedPath={selectedDocPath} />
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
