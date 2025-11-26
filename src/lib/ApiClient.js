// src/lib/ApiClient.js
// Small ApiClient class to centralise fetching API endpoints used by the UI.

const RAW_BASE = import.meta.env.VITE_API_BASE_URL || "";
const DEFAULT_API_BASE = RAW_BASE.replace(/\/$/, "");

class ApiClient {
  constructor(base = DEFAULT_API_BASE) {
    this.base = base;
  }

  _url(path) {
    if (!this.base) return path.startsWith("/") ? path : `/${path}`;
    return `${this.base}${path.startsWith("/") ? path : "/" + path}`;
  }

  async fetchJson(path) {
    const url = this._url(path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.json();
  }

  async fetchText(path) {
    const url = this._url(path);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Failed to load ${url}: ${res.status}`);
    return res.text();
  }

  // Public helpers
  async fetchGraph() {
    return this.fetchJson("/graph");
  }

  async fetchFilesIndex() {
    return this.fetchJson("/files");
  }

  async fetchFileContent(path) {
    const url = `/file?path=${encodeURIComponent(path)}`;
    return this.fetchText(url);
  }

  async fetchConceptGraph(path) {
    const url = `/concept-graph?path=${encodeURIComponent(path)}`;
    return this.fetchJson(url);
  }

  async fetchADRs() {
    return this.fetchJson("/adrs");
  }
}

const defaultClient = new ApiClient();

export { ApiClient };
export default defaultClient;
