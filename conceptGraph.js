// conceptGraph.js
const fs = require("fs");

/**
 * Parse a simple DSL like:
 *   A DataDomain has many UseCases
 *   A UseCase has DataConsumerRequirements
 *   The execution of a Control produces DataQualityResults
 *
 * Returns:
 * {
 *   nodes: [{ id, label }],
 *   edges: [{ source, target, label }]
 * }
 */
function parseConceptDsl(text) {
  const nodesMap = new Map(); // id -> { id, label }
  const edges = [];

  function ensureNode(name) {
    const id = name.trim();
    if (!nodesMap.has(id)) {
      nodesMap.set(id, { id, label: id });
    }
    return id;
  }

  function addEdge(sourceName, targetName, label) {
    const source = ensureNode(sourceName);
    const target = ensureNode(targetName);
    edges.push({ source, target, label });
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("#"));

  for (const line of lines) {
    let m;

    // 1) A X has many Y
    m = /^A\s+(\w+)\s+has\s+many\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "has many");
      continue;
    }

    // 2) A X has Y
    m = /^A\s+(\w+)\s+has\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "has");
      continue;
    }

    // 3) An X has many Y
    m = /^An\s+(\w+)\s+has\s+many\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "has many");
      continue;
    }

    // 4) An X has Y
    m = /^An\s+(\w+)\s+has\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "has");
      continue;
    }

    // 5) A X is implemented by many Y
    m = /^A\s+(\w+)\s+is\s+implemented\s+by\s+many\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "implemented by many");
      continue;
    }

    // 6) A X is implemented by Y
    m = /^A\s+(\w+)\s+is\s+implemented\s+by\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "implemented by");
      continue;
    }

    // 7) The execution of a X produces many Y
    m = /^The\s+execution\s+of\s+a\s+(\w+)\s+produces\s+many\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "execution produces many");
      continue;
    }

    // 8) The execution of a X produces Y
    m = /^The\s+execution\s+of\s+a\s+(\w+)\s+produces\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "execution produces");
      continue;
    }

    // 9) A X produces many Y
    m = /^A\s+(\w+)\s+produces\s+many\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "produces many");
      continue;
    }

    // 10) A X produces Y
    m = /^A\s+(\w+)\s+produces\s+(\w+)/i.exec(line);
    if (m) {
      const [, x, y] = m;
      addEdge(x, y, "produces");
      continue;
    }

    // If nothing matched, just register any capitalized token as nodes
    // so typos don't kill the parser completely.
    console.warn("[conceptGraph] Unrecognized line:", line);
  }

  return {
    nodes: Array.from(nodesMap.values()),
    edges,
  };
}

/**
 * Load a .concept file and parse into graph.
 */
function buildConceptGraphFromFile(filePath) {
  const text = fs.readFileSync(filePath, "utf8");
  return parseConceptDsl(text);
}

module.exports = {
  parseConceptDsl,
  buildConceptGraphFromFile,
};
