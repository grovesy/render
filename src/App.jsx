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
import ADRViewer from "./components/ADRViewer";
import ApiClient from "./lib/ApiClient";

const api = ApiClient; // shared API client

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
  // Read initial state from URL params
  const params = new URLSearchParams(window.location.search);
  const initialMode = params.get('mode') || 'concepts';
  const initialModel = params.get('model');
  const initialConcept = params.get('concept');
  const initialAdr = params.get('adr');
  const initialLayout = params.get('layout') || 'hierarchical';
  const initialGroupDomains = params.get('groupDomains') !== 'false'; // default true
  const initialViewMode = params.get('viewMode') || 'graph'; // 'graph' or 'table'

  const [leftMode, setLeftMode] = useState(initialMode); // 'models' | 'concepts' | 'adrs'
  // main view is controlled by the left-mode switcher now
  const [fileIndex, setFileIndex] = useState({
    jsonModels: [],
    markdown: [],
    concepts: [],
  });

  const [adrs, setAdrs] = useState([]);

  const [selectedModelKey, setSelectedModelKey] = useState(initialModel); // `${domain}:${model}`
  const [selectedConceptPath, setSelectedConceptPath] = useState(initialConcept);
  const [selectedADRPath, setSelectedADRPath] = useState(initialAdr);
  
  // Model graph options
  const [layoutStyle, setLayoutStyle] = useState(initialLayout); // 'star' | 'force' | 'hierarchical'
  const [groupByDomains, setGroupByDomains] = useState(initialGroupDomains);
  const [viewMode, setViewMode] = useState(initialViewMode); // 'graph' | 'table'

  const [filesError, setFilesError] = useState("");
  
  // WebSocket for live reload
  const wsRef = useRef(null);

  // Sync URL with state changes
  useEffect(() => {
    const params = new URLSearchParams();
    params.set('mode', leftMode);
    
    if (leftMode === 'models' && selectedModelKey) {
      params.set('model', selectedModelKey);
      params.set('layout', layoutStyle);
      params.set('groupDomains', groupByDomains.toString());
      params.set('viewMode', viewMode);
    } else if (leftMode === 'concepts' && selectedConceptPath) {
      params.set('concept', selectedConceptPath);
    } else if (leftMode === 'adrs' && selectedADRPath) {
      params.set('adr', selectedADRPath);
    }
    
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState({}, '', newUrl);
  }, [leftMode, selectedModelKey, selectedConceptPath, selectedADRPath, layoutStyle, groupByDomains, viewMode]);

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
    async function loadADRs() {
      try {
        const data = await api.fetchADRs();
        setAdrs(data.adrs || []);
      } catch (err) {
        console.error("[App] Failed to load /adrs:", err);
      }
    }
    loadADRs();
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

      setSelectedModelKey(key);
      setLeftMode("models");
    } catch (err) {
      console.error("[App] handleJsonFileClick error:", err);
    }
  }, []);

  // -------- Handle concept file click ----------
  const handleConceptFileClick = useCallback((filePath) => {
    console.log("[App] Selecting concept file:", filePath);
    setSelectedConceptPath(filePath);
    setLeftMode("concepts");
  }, []);

  // -------- Handle ADR click ----------
  const handleADRClick = useCallback((filePath) => {
    console.log("[App] Selecting ADR:", filePath);
    setSelectedADRPath(filePath);
  }, []);

  // tabs removed — left-mode controls the main view
  
  // -------- WebSocket connection for live reload ----------
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = API_BASE ? `${protocol}//${new URL(API_BASE).host}` : `${protocol}//${window.location.host}`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;
    
    ws.onopen = () => {
      console.log('[WebSocket] Connected for live reload');
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === 'reload') {
          console.log('[WebSocket] File change detected, reloading data...');
          loadFiles();
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing message:', err);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
    };
    
    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [loadFiles, API_BASE]);

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
            {/* The model/concept selector moved to the left sidebar */}
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
              }}
            />

            <Box
              sx={{
                width: leftMode === "adrs" ? "auto" : 260,
                minWidth: 260,
                maxWidth: leftMode === "adrs" ? 600 : 260,
                bgcolor: "background.paper",
                display: "flex",
                flexDirection: "column",
                minHeight: 0,
                borderLeft: "1px solid #4a4a4a",
              }}
            >
            <Box sx={{ p: 1 }}>
              <Typography
                variant="caption"
                sx={{ textTransform: "uppercase", color: "text.secondary" }}
              >
                {leftMode === "models" ? "Models" : leftMode === "concepts" ? "Concepts" : "ADRs"}
              </Typography>
            </Box>
            <Divider />
            {filesError ? (
              <Box sx={{ p: 1, color: "error.main", fontSize: 12 }}>
                {filesError}
              </Box>
            ) : leftMode === "adrs" ? (
              <ADRSidebar
                adrs={adrs}
                selectedPath={selectedADRPath}
                onADRClick={handleADRClick}
              />
            ) : (
              <LeftSidebar
                fileIndex={fileIndex}
                onJsonFileClick={handleJsonFileClick}
                onConceptFileClick={handleConceptFileClick}
                viewMode={leftMode === "models" ? "models" : leftMode === "concepts" ? "concepts" : "all"}
              />
            )}
            </Box>
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
                onLayoutChange={setLayoutStyle}
                onGroupDomainsChange={setGroupByDomains}
                onViewModeChange={setViewMode}
              />
            ) : leftMode === "concepts" ? (
              <ConceptGraphView conceptPath={selectedConceptPath} />
            ) : (
              <ADRViewer selectedPath={selectedADRPath} />
            )}
          </Box>
        </Box>
      </Box>
    </ThemeProvider>
  );
}
