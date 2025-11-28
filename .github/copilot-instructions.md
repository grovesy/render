# Copilot / AI agent guidance — render

This repo is a small Node + Vite React app that builds and displays UML-style graphs from JSON Schema files and a tiny .concept DSL.

Frontend: React + Vite in `src/` (components: `RFModelGraphView.jsx`, `ConceptGraphView.jsx`, `FileViewer.jsx`, `LeftSidebar.jsx`). `public/app.js` contains the original non-React example.
- Graph format: `schemaGraph.buildGraphFromSchemas()` returns `{ entities: [{ domain, model, title, attrs, refs }] }` — frontend expects this shape and makes keys `${domain}:${model}`.
- Concept DSL: `examples/model.concept` demonstrates the text grammar parsed by `conceptGraph.js`. Use `/concept-graph?path=/absolute/path` to build graph JSON.
- File scanning roots: configured through env var `SCHEMA_DIRS` (comma-separated directories). Default is `examples`.

Developer workflows & commands
- Frontend development: `npm run dev` (Vite). To connect frontend to the backend set `VITE_API_BASE_URL` (e.g. `VITE_API_BASE_URL=http://localhost:3000`).
- Backend server: `npm run server` → runs `node server.js`. Server prints `Schema dirs:` at startup and serves static files from `public/`.
- Static build/preview: `npm run build` (Vite) and `npm run preview` — note: `server.js` statically serves `public/` (not `dist`). For a production preview using the server, either copy `dist` files into `public` or use `vite preview`.

Debugging & checks agents can do
- Use `/files` to enumerate available JSON, markdown and .concept files for test inputs.
- `/file?path=...` returns raw file text (server enforces path to lie under configured `SCHEMA_DIRS`). The server checks resolved path begins with each root + path.sep.
- Check `examples/` to locate canonical test cases used by the project (account.org.biz, contact.org.biz examples are good test inputs).

Where to make changes safely
- Prefer editing `src/*` over `public/*` during active development — `public/app.js` is a legacy example and duplicates logic in `src/`.
- When changing parsing or ID handling update `schemaGraph.js` and verify `RFModelGraphView.jsx` and `public/app.js` remain compatible.

Small PR guidelines for agents
- Keep changes focused and testable: add a small example under `examples/` if updating parsing logic, and use `/graph` and `/files` to verify runtime output.
- Mention required env vars in PR description (`SCHEMA_DIRS`, `VITE_API_BASE_URL`) and how you validated (commands used and example outputs).

Files to read first
- `server.js`, `schemaGraph.js`, `conceptGraph.js`, `src/App.jsx`, `src/components/RFModelGraphView.jsx`, `src/components/ConceptGraphView.jsx` and `examples/*`.

If anything in this doc is unclear or you'd like this file to include more examples (HTTP request examples, expected JSON shapes, or a short local run script), tell me and I’ll iterate. ✅
