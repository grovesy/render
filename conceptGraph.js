// conceptGraph.js
const fs = require("fs");

/**
 * Parse a simple DSL with generic pattern:
 *   A <Entity> <statement> <Entity>
 *   AN <Entity> <statement> <Entity>
 * 
 * Where:
 *   - Entities start with a capital letter (e.g., DataDomain, UseCase)
 *   - Statements are lowercase with spaces (e.g., has many, is implemented by)
 *
 * Examples:
 *   A DataDomain has many UseCases
 *   A UseCase has DataConsumerRequirements
 *   An Assessment produces many ScoreCards
 *   A LogicalRule is implemented by many TechnicalRules
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
    // Generic pattern: A|AN <Entity> <statement> <Entity>
    // Entity: starts with capital letter, followed by alphanumeric characters
    // Statement: lowercase words with spaces between entities
    const pattern = /^(?:A|An)\s+([A-Z]\w+)\s+(.+?)\s+([A-Z]\w+)$/;
    const match = pattern.exec(line);
    
    if (match) {
      const [, sourceEntity, statement, targetEntity] = match;
      
      // Normalize the statement (trim and convert to lowercase)
      const normalizedStatement = statement.trim().toLowerCase();
      
      addEdge(sourceEntity, targetEntity, normalizedStatement);
    } else {
      // If pattern doesn't match, warn but don't fail
      console.warn("[conceptGraph] Unrecognized line:", line);
    }
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
