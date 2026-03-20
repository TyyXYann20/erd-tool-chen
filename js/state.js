export const stage = document.getElementById("stage");
export const nodesLayer = document.getElementById("nodes-layer");
export const edgesLayer = document.getElementById("edges-layer");
export const editPanel = document.getElementById("editPanel");
export const panelBody = document.getElementById("panelBody");

export const REL_MAPPINGS = ["1:1", "1:M", "M:N", "M:1"];

export const FOOTER_CONFIG = {
  version: "1.1.2",
  creator: "Coding 12PM",
  github: "https://github.com/YOUR-USERNAME/YOUR-REPO",
};

export const appState = {
  mode: "move",
  dragNode: null,
  connectSource: null,
  pages: [{ nodes: [], edges: [] }],
  currentPage: 0,
};

export function getPage() {
  return appState.pages[appState.currentPage];
}

export function getNodes() {
  return getPage().nodes;
}

export function getEdges() {
  return getPage().edges;
}

export function setMode(mode) {
  appState.mode = mode;
}

export function setDragNode(value) {
  appState.dragNode = value;
}

export function setConnectSource(value) {
  appState.connectSource = value;
}
