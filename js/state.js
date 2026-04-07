export const stage = document.getElementById("stage");
export const nodesLayer = document.getElementById("nodes-layer");
export const edgesLayer = document.getElementById("edges-layer");
export const editPanel = document.getElementById("editPanel");
export const panelBody = document.getElementById("panelBody");

export const REL_MAPPINGS = ["1:1", "1:M", "M:N", "M:1"];
export const PAGE_LIMITS = {
  minWidth: 800,
  minHeight: 600,
  maxWidth: 6000,
  maxHeight: 6000,
};

export const FOOTER_CONFIG = {
  version: "1.1.2",
  creator: "Coding 12PM",
  github: "https://github.com/YOUR-USERNAME/YOUR-REPO",
};

function clampDimension(value, fallback, min, max) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return fallback;
  return Math.max(min, Math.min(max, Math.round(nextValue)));
}

export function getDefaultPageSize() {
  const isCompactLayout = window.innerWidth <= 900;
  const reservedWidth = isCompactLayout ? 96 : 420;
  const reservedHeight = isCompactLayout ? 300 : 190;

  return {
    width: clampDimension(
      window.innerWidth - reservedWidth,
      1400,
      PAGE_LIMITS.minWidth,
      PAGE_LIMITS.maxWidth,
    ),
    height: clampDimension(
      window.innerHeight - reservedHeight,
      900,
      PAGE_LIMITS.minHeight,
      PAGE_LIMITS.maxHeight,
    ),
  };
}

export function createPage(width, height) {
  const defaults = getDefaultPageSize();
  return {
    nodes: [],
    edges: [],
    width: clampDimension(
      width,
      defaults.width,
      PAGE_LIMITS.minWidth,
      PAGE_LIMITS.maxWidth,
    ),
    height: clampDimension(
      height,
      defaults.height,
      PAGE_LIMITS.minHeight,
      PAGE_LIMITS.maxHeight,
    ),
  };
}

export const appState = {
  mode: "move",
  dragNode: null,
  connectSource: null,
  pages: [createPage()],
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
