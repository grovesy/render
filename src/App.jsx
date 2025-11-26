// src/App.jsx
import React, { useEffect, useState } from "react";
import GraphView from "./components/GraphView";

// Same API base convention as GraphView
const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const API_BASE = RAW_BASE.replace(/\/$/, "");

// Fetch graph once just to build the navigator tree
async function fetchGraphMeta() {
  const res = await fetch(`${API_BASE}/graph`);
  if (!res.ok) throw new Error("Failed to load graph metadata: " + res.status);
  return res.json();
}

export default function App() {
  const [domains, setDomains] = useState([]);
  const [error, setError] = useState("");
  const [selectedKey, setSelectedKey] = useState(null);

  useEffect(() => {
    fetchGraphMeta()
      .then((data) => {
        const byDomain = new Map();

        (data.entities || []).forEach((e) => {
          if (!byDomain.has(e.domain)) byDomain.set(e.domain, []);
          byDomain.get(e.domain).push(e);
        });

        const domainList = Array.from(byDomain.entries()).map(
          ([domain, entities]) => ({
            domain,
            entities: entities.sort((a, b) =>
              (a.title || a.model).localeCompare(b.title || b.model)
            ),
          })
        );

        domainList.sort((a, b) => a.domain.localeCompare(b.domain));
        setDomains(domainList);
        setError("");
      })
      .catch((err) => {
        console.error("Failed to load navigator data:", err);
        setError(err.message || "Failed to load models list");
      });
  }, []);

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        fontFamily:
          "system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
      }}
    >
      {/* LEFT SIDEBAR: domain → models tree */}
      <aside
        style={{
          width: 260,
          backgroundColor: "#020617",
          color: "#e5e7eb",
          borderRight: "2px solid #111827",
          display: "flex",
          flexDirection: "row",
          boxSizing: "border-box",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            padding: "12px 10px",
            boxSizing: "border-box",
          }}
        >
          <div
            style={{
              fontSize: 11,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "#9ca3af",
              marginBottom: 8,
            }}
          >
            Navigator
          </div>

          <div
            style={{
              fontSize: 10,
              textTransform: "uppercase",
              letterSpacing: "0.12em",
              color: "#6b7280",
              marginBottom: 6,
            }}
          >
            JSON Models
          </div>

          <div
            style={{
              flex: 1,
              overflowY: "auto",
              paddingRight: 4,
            }}
          >
            {error && (
              <div
                style={{
                  fontSize: 11,
                  color: "#fca5a5",
                  marginBottom: 8,
                }}
              >
                {error}
              </div>
            )}

            {!error && domains.length === 0 && (
              <div style={{ fontSize: 11, color: "#6b7280" }}>
                Loading models…
              </div>
            )}

            {/* Tree structure: domain → list of models */}
            {domains.map(({ domain, entities }) => (
              <div key={domain} style={{ marginBottom: 10 }}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 600,
                    textTransform: "uppercase",
                    color: "#e5e7eb",
                    marginBottom: 2,
                  }}
                >
                  {domain}
                </div>

                <ul
                  style={{
                    listStyle: "none",
                    margin: 0,
                    paddingLeft: 12,
                    borderLeft: "1px solid #1f2937",
                  }}
                >
                  {entities.map((e) => {
                    const key = `${domain}:${e.model}`;
                    const isSelected = key === selectedKey;
                    return (
                      <li
                        key={key}
                        onClick={() => setSelectedKey(key)}
                        style={{
                          fontSize: 12,
                          padding: "3px 0 3px 4px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          textOverflow: "ellipsis",
                          overflow: "hidden",
                          borderRadius: 4,
                          marginBottom: 2,
                          backgroundColor: isSelected
                            ? "#1f2937"
                            : "transparent",
                          color: isSelected ? "#e5e7eb" : "#cbd5f5",
                        }}
                        title={`${e.title || e.model} (${e.model}.json)`}
                      >
                        <span style={{ opacity: 0.9 }}>
                          {e.title || e.model}.json
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* MAIN AREA: header + graph */}
      <main
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          backgroundColor: "#f3f4f6",
        }}
      >
        <header
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid #e5e7eb",
            backgroundColor: "#ffffff",
          }}
        >
          <div
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: "#111827",
            }}
          >
            Schema Graph
          </div>
        </header>

        <section
          style={{
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* GraphView gets the currently selected domain:model key */}
          <GraphView selectedKey={selectedKey} />
        </section>
      </main>
    </div>
  );
}
