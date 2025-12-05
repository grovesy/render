// Theme definitions for the application
export const themes = {
  light: {
    name: 'Light',
    palette: {
      mode: 'light',
      primary: { main: '#1976d2' },
      secondary: { main: '#dc004e' },
      background: { default: '#ffffff', paper: '#f5f5f5' },
      text: { primary: '#000000', secondary: '#666666' },
    },
    graph: {
      background: '#ffffff',
      node: '#e3f2fd',
      nodeText: '#000000',
      nodeBorder: '#1976d2',
      edge: '#666666',
      edgeLabel: '#333333',
      selected: '#1976d2',
    },
  },
  paper: {
    name: 'Paper',
    palette: {
      mode: 'light',
      primary: { main: '#795548' },
      secondary: { main: '#ff9800' },
      background: { default: '#fafaf8', paper: '#f5f5f0' },
      text: { primary: '#3e2723', secondary: '#6d4c41' },
    },
    graph: {
      background: '#fafaf8',
      node: '#fff8e1',
      nodeText: '#3e2723',
      nodeBorder: '#795548',
      edge: '#8d6e63',
      edgeLabel: '#5d4037',
      selected: '#ff9800',
    },
  },
  dark: {
    name: 'Dark',
    palette: {
      mode: 'dark',
      primary: { main: '#90caf9' },
      secondary: { main: '#f48fb1' },
      background: { default: '#121212', paper: '#1e1e1e' },
      text: { primary: '#ffffff', secondary: '#b0b0b0' },
    },
    graph: {
      background: '#121212',
      node: '#1e3a5f',
      nodeText: '#e0e0e0',
      nodeBorder: '#90caf9',
      edge: '#808080',
      edgeLabel: '#b0b0b0',
      selected: '#90caf9',
    },
  },
  solarized: {
    name: 'Solarized',
    palette: {
      mode: 'dark',
      primary: { main: '#268bd2' },
      secondary: { main: '#2aa198' },
      background: { default: '#002b36', paper: '#073642' },
      text: { primary: '#839496', secondary: '#586e75' },
    },
    graph: {
      background: '#002b36',
      node: '#073642',
      nodeText: '#93a1a1',
      nodeBorder: '#268bd2',
      edge: '#586e75',
      edgeLabel: '#657b83',
      selected: '#b58900',
    },
  },
  blue: {
    name: 'Blue',
    palette: {
      mode: 'dark',
      primary: { main: '#42a5f5' },
      secondary: { main: '#26c6da' },
      background: { default: '#0d1b2a', paper: '#1b263b' },
      text: { primary: '#e0e1dd', secondary: '#8b95a5' },
    },
    graph: {
      background: '#0d1b2a',
      node: '#1b263b',
      nodeText: '#e0e1dd',
      nodeBorder: '#42a5f5',
      edge: '#415a77',
      edgeLabel: '#8b95a5',
      selected: '#26c6da',
    },
  },
  emacs: {
    name: 'Emacs',
    palette: {
      mode: 'dark',
      primary: { main: '#7c7c7c' },
      secondary: { main: '#8b4513' },
      background: { default: '#2e3436', paper: '#3c3f41' },
      text: { primary: '#d3d7cf', secondary: '#babdb6' },
    },
    graph: {
      background: '#2e3436',
      node: '#3c3f41',
      nodeText: '#d3d7cf',
      nodeBorder: '#729fcf',
      edge: '#888a85',
      edgeLabel: '#babdb6',
      selected: '#ad7fa8',
    },
  },
};

export const getTheme = (themeName) => themes[themeName] || themes.light;

export const applyGraphTheme = (theme) => ({
  '.react-flow': {
    backgroundColor: theme.graph.background,
    '--graph-node-bg': theme.graph.node,
    '--graph-node-text': theme.graph.nodeText,
    '--graph-node-border': theme.graph.nodeBorder,
    '--graph-edge': theme.graph.edge,
    '--graph-edge-label': theme.graph.edgeLabel,
    '--graph-selected': theme.graph.selected,
  },
  '.react-flow__node': {
    backgroundColor: theme.graph.node,
    color: theme.graph.nodeText,
    border: `2px solid ${theme.graph.nodeBorder}`,
  },
  '.react-flow__node.selected': {
    borderColor: theme.graph.selected,
    boxShadow: `0 0 0 2px ${theme.graph.selected}40`,
  },
  '.react-flow__edge-path': {
    stroke: theme.graph.edge,
  },
  '.react-flow__edge-text': {
    fill: theme.graph.edgeLabel,
  },
  '.react-flow__edge.selected .react-flow__edge-path': {
    stroke: theme.graph.selected,
  },
});
