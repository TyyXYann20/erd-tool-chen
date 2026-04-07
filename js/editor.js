import {
  stage,
  nodesLayer,
  edgesLayer,
  editPanel,
  panelBody,
  REL_MAPPINGS,
  appState,
  PAGE_LIMITS,
  createPage,
  getNodes,
  getEdges,
  getPage,
  setDragNode,
  setConnectSource,
  setMode,
} from "./state.js";

export function toRoman(num) {
  const map = [
    [1000, "M"],
    [900, "CM"],
    [500, "D"],
    [400, "CD"],
    [100, "C"],
    [90, "XC"],
    [50, "L"],
    [40, "XL"],
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let n = Math.max(1, Math.floor(num));
  let out = "";
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

export function pageLabel(idx) {
  return `Page ${toRoman(idx + 1)}`;
}

export function updatePageIndicator() {
  document.getElementById("pageIndicator").textContent = pageLabel(
    appState.currentPage,
  );
  const page = getPage();
  document.getElementById("pageSizeIndicator").textContent =
    `Canvas ${page.width} x ${page.height}`;
}

function clampDimension(value, fallback, min, max) {
  const nextValue = Number(value);
  if (!Number.isFinite(nextValue)) return fallback;
  return Math.max(min, Math.min(max, Math.round(nextValue)));
}

function getPageDimensions(page = getPage()) {
  return {
    width: clampDimension(
      page.width,
      1400,
      PAGE_LIMITS.minWidth,
      PAGE_LIMITS.maxWidth,
    ),
    height: clampDimension(
      page.height,
      900,
      PAGE_LIMITS.minHeight,
      PAGE_LIMITS.maxHeight,
    ),
  };
}

function getNodeCenter(node) {
  return {
    x: node.x + node.w / 2,
    y: node.y + node.h / 2,
  };
}

function setNodeCenter(node, x, y) {
  node.x = x - node.w / 2;
  node.y = y - node.h / 2;
}

function clampNodeToPage(node, page = getPage()) {
  const { width, height } = getPageDimensions(page);
  node.x = Math.max(0, Math.min(node.x, width - node.w));
  node.y = Math.max(0, Math.min(node.y, height - node.h));
}

function getConnectedNodes(nodeId) {
  const seen = new Set();
  return getEdges()
    .flatMap((edge) => {
      if (edge.from === nodeId) return [edge.to];
      if (edge.to === nodeId) return [edge.from];
      return [];
    })
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    })
    .map((id) => getNodes().find((node) => node.id === id))
    .filter(Boolean);
}

function inferRelationshipAxis(relNode, entities) {
  if (relNode.layoutAxis) return relNode.layoutAxis;
  if (entities.length < 2) return "horizontal";

  const [a, b] = entities.map(getNodeCenter);
  return Math.abs(a.x - b.x) >= Math.abs(a.y - b.y)
    ? "horizontal"
    : "vertical";
}

function recenterRelationship(relNode, entities, axis) {
  if (entities.length < 2) return;

  const [a, b] = entities.map(getNodeCenter);
  const midpointX = (a.x + b.x) / 2;
  const midpointY = (a.y + b.y) / 2;

  if (axis === "horizontal") {
    setNodeCenter(relNode, midpointX, midpointY);
  } else {
    setNodeCenter(relNode, midpointX, midpointY);
  }

  clampNodeToPage(relNode);
}

function smartAlignRelationshipGroup(node) {
  const relatedRelationships =
    node.type === "rel"
      ? [node]
      : getConnectedNodes(node.id).filter((connected) => connected.type === "rel");

  relatedRelationships.forEach((relNode) => {
    const entities = getConnectedNodes(relNode.id).filter(
      (connected) => connected.type === "entity",
    );

    if (entities.length < 2) return;

    const axis = inferRelationshipAxis(relNode, entities);
    relNode.layoutAxis = axis;

    if (node.type === "entity") {
      const otherEntity = entities.find((entity) => entity.id !== node.id);
      if (!otherEntity) return;

      const currentCenter = getNodeCenter(node);
      const otherCenter = getNodeCenter(otherEntity);

      if (axis === "horizontal") {
        if (Math.abs(currentCenter.y - otherCenter.y) <= 24) {
          setNodeCenter(node, currentCenter.x, otherCenter.y);
        }
      } else if (Math.abs(currentCenter.x - otherCenter.x) <= 24) {
        setNodeCenter(node, otherCenter.x, currentCenter.y);
      }

      clampNodeToPage(node);
      const [entityA, entityB] = entities;
      const centerA = getNodeCenter(entityA);
      const centerB = getNodeCenter(entityB);
      const relCenter = getNodeCenter(relNode);

      if (axis === "horizontal") {
        if (Math.abs(centerA.y - centerB.y) <= 24) {
          recenterRelationship(relNode, entities, axis);
        } else {
          setNodeCenter(relNode, (centerA.x + centerB.x) / 2, relCenter.y);
          clampNodeToPage(relNode);
        }
      } else if (Math.abs(centerA.x - centerB.x) <= 24) {
        recenterRelationship(relNode, entities, axis);
      } else {
        setNodeCenter(relNode, relCenter.x, (centerA.y + centerB.y) / 2);
        clampNodeToPage(relNode);
      }

      return;
    }

    if (node.type === "rel") {
      const [entityA, entityB] = entities;
      const centerA = getNodeCenter(entityA);
      const centerB = getNodeCenter(entityB);
      const relCenter = getNodeCenter(relNode);

      if (axis === "horizontal") {
        const closeEnough = Math.abs(centerA.y - centerB.y) <= 24;
        const targetY = closeEnough ? (centerA.y + centerB.y) / 2 : relCenter.y;

        if (Math.abs(relCenter.y - targetY) <= 32 || closeEnough) {
          setNodeCenter(relNode, (centerA.x + centerB.x) / 2, targetY);
        } else {
          setNodeCenter(relNode, (centerA.x + centerB.x) / 2, relCenter.y);
        }
      } else {
        const closeEnough = Math.abs(centerA.x - centerB.x) <= 24;
        const targetX = closeEnough ? (centerA.x + centerB.x) / 2 : relCenter.x;

        if (Math.abs(relCenter.x - targetX) <= 32 || closeEnough) {
          setNodeCenter(relNode, targetX, (centerA.y + centerB.y) / 2);
        } else {
          setNodeCenter(relNode, relCenter.x, (centerA.y + centerB.y) / 2);
        }
      }

      clampNodeToPage(relNode);
      return;
    }
  });
}

function keepNodesInsidePage() {
  getNodes().forEach((node) => clampNodeToPage(node));
}

function syncPageSizeInputs() {
  const page = getPage();
  const widthInput = document.getElementById("pageWidthInput");
  const heightInput = document.getElementById("pageHeightInput");

  if (widthInput) widthInput.value = String(page.width);
  if (heightInput) heightInput.value = String(page.height);
}

export function setCurrentPageSize(width, height) {
  const page = getPage();
  const nextWidth = clampDimension(
    width,
    page.width,
    PAGE_LIMITS.minWidth,
    PAGE_LIMITS.maxWidth,
  );
  const nextHeight = clampDimension(
    height,
    page.height,
    PAGE_LIMITS.minHeight,
    PAGE_LIMITS.maxHeight,
  );

  page.width = nextWidth;
  page.height = nextHeight;

  keepNodesInsidePage();
  setViewBox();
  render();
}

export function growCurrentPage() {
  const page = getPage();
  setCurrentPageSize(page.width * 1.2, page.height * 1.2);
}

export function setViewBox() {
  const { width, height } = getPageDimensions();
  stage.setAttribute("viewBox", `0 0 ${width} ${height}`);
  stage.setAttribute("width", String(width));
  stage.setAttribute("height", String(height));
  stage.style.width = `${width}px`;
  stage.style.height = `${height}px`;
}

export function escapeHtml(str) {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function addPage() {
  const currentPage = getPage();
  appState.pages.push(createPage(currentPage.width, currentPage.height));
  appState.currentPage = appState.pages.length - 1;
  setViewBox();
  render();
}

export function prevPage() {
  if (appState.currentPage <= 0) return;
  appState.currentPage--;
  setViewBox();
  render();
}

export function nextPage() {
  if (appState.currentPage >= appState.pages.length - 1) return;
  appState.currentPage++;
  setViewBox();
  render();
}

export function addNode(
  type,
  x = 100,
  y = 100,
  label = "",
  variant = "strong",
) {
  const node = {
    id: Date.now() + Math.random(),
    type,
    variant,
    x,
    y,
    w: type === "entity" ? 140 : type === "text" ? 70 : 100,
    h: type === "entity" ? 60 : type === "text" ? 46 : 70,
    label:
      label || (type === "entity" ? "Entity" : type === "text" ? "1" : "Has"),
    mapping: "1:1",
    rotation: 0,
    color:
      type === "entity"
        ? variant === "weak"
          ? "#fff7ed"
          : variant === "associative"
            ? "#ecfeff"
            : "#eff6ff"
        : "#ffffff",
    textColor: type === "text" ? "#ea580c" : "#0f172a",
    boxBg: type === "text" ? "#ffffff" : "transparent",
    boxBorder: type === "text" ? "#cbd5e1" : "transparent",
    boxBorderWidth: type === "text" ? 2 : 0,
  };

  getNodes().push(node);
  render();
  return node;
}

function getCircleCenter(node, targetPoint) {
  const cx = node.x + node.w / 2;
  const cy = node.y + node.h / 2;
  const r = 6;

  const dx = targetPoint.x - cx;
  const dy = targetPoint.y - cy;

  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: cx + Math.sign(dx) * (node.w / 2 + r), y: cy };
  }
  return { x: cx, y: cy + Math.sign(dy) * (node.h / 2 + r) };
}

export function setEditorMode(mode) {
  setMode(mode);
  document
    .getElementById("modeMove")
    .classList.toggle("active", mode === "move");
  document
    .getElementById("modeConnect")
    .classList.toggle("active", mode === "connect");
  setConnectSource(null);
  render();
}

export function render() {
  nodesLayer.innerHTML = "";
  edgesLayer.innerHTML = "";

  getEdges().forEach((edge) => {
    const n1 = getNodes().find((n) => n.id === edge.from);
    const n2 = getNodes().find((n) => n.id === edge.to);
    if (!n1 || !n2) return;

    const p1 = { x: n1.x + n1.w / 2, y: n1.y + n1.h / 2 };
    const p2 = { x: n2.x + n2.w / 2, y: n2.y + n2.h / 2 };

    const midX = p1.x + (p2.x - p1.x) / 2;
    const pathData = `M ${p1.x} ${p1.y} L ${midX} ${p1.y} L ${midX} ${p2.y} L ${p2.x} ${p2.y}`;

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", pathData);
    path.setAttribute("class", "edge-line");
    path.onclick = (e) => {
      e.stopPropagation();
      showEdgeEdit(edge);
    };
    edgesLayer.appendChild(path);

    const target1 = { x: midX, y: p1.y };
    if (Math.abs(midX - p1.x) < 0.1) target1.y = p2.y;

    const target2 = { x: midX, y: p2.y };
    if (Math.abs(midX - p2.x) < 0.1) target2.y = p1.y;

    if (edge.styleStart === "optional") {
      const c1 = getCircleCenter(n1, target1);
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      circle.setAttribute("cx", c1.x);
      circle.setAttribute("cy", c1.y);
      circle.setAttribute("r", 6);
      circle.setAttribute("fill", "#fff");
      circle.setAttribute("stroke", "var(--erd-line)");
      circle.setAttribute("stroke-width", "2");
      edgesLayer.appendChild(circle);
    }

    if (edge.styleEnd === "optional") {
      const c2 = getCircleCenter(n2, target2);
      const circle = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "circle",
      );
      circle.setAttribute("cx", c2.x);
      circle.setAttribute("cy", c2.y);
      circle.setAttribute("r", 6);
      circle.setAttribute("fill", "#fff");
      circle.setAttribute("stroke", "var(--erd-line)");
      circle.setAttribute("stroke-width", "2");
      edgesLayer.appendChild(circle);
    }
  });

  getNodes().forEach((node) => {
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const cx = node.w / 2;
    const cy = node.h / 2;

    g.setAttribute(
      "transform",
      `translate(${node.x},${node.y}) rotate(${node.rotation || 0} ${cx} ${cy})`,
    );
    g.setAttribute(
      "class",
      `node ${appState.connectSource === node.id ? "selected" : ""}`,
    );

    if (node.type === "entity") {
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("width", node.w);
      rect.setAttribute("height", node.h);
      rect.setAttribute("rx", "4");
      rect.setAttribute("fill", node.color || "#ffffff");
      rect.setAttribute("stroke", "#0f172a");
      rect.setAttribute("stroke-width", "2");
      rect.setAttribute("class", "entity-rect");
      g.appendChild(rect);

      if (node.variant === "weak") {
        const inner = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "rect",
        );
        inner.setAttribute("x", 4);
        inner.setAttribute("y", 4);
        inner.setAttribute("width", node.w - 8);
        inner.setAttribute("height", node.h - 8);
        inner.setAttribute("class", "entity-inner");
        g.appendChild(inner);
      } else if (node.variant === "associative") {
        const diamond = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "polygon",
        );
        const dpts = `${node.w / 2},2 ${node.w - 2},${node.h / 2} ${node.w / 2},${node.h - 2} 2,${node.h / 2}`;
        diamond.setAttribute("points", dpts);
        diamond.setAttribute("class", "entity-inner");
        g.appendChild(diamond);
      }
    } else if (node.type === "text") {
      const rect = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "rect",
      );
      rect.setAttribute("width", node.w);
      rect.setAttribute("height", node.h);
      rect.setAttribute("class", "text-rect");
      rect.setAttribute("fill", node.boxBg || "#ffffff");
      rect.setAttribute("stroke", node.boxBorder || "#cbd5e1");
      rect.setAttribute("stroke-width", String(node.boxBorderWidth ?? 2));
      g.appendChild(rect);
    } else {
      const poly = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "polygon",
      );
      const pts = `${node.w / 2},0 ${node.w},${node.h / 2} ${node.w / 2},${node.h} 0,${node.h / 2}`;
      poly.setAttribute("points", pts);
      poly.setAttribute("class", "rel-diamond");
      g.appendChild(poly);
    }

    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.textContent = node.label;
    text.setAttribute("x", node.w / 2);
    text.setAttribute("y", node.h / 2 + 6);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute(
      "class",
      node.type === "text" ? "node-text text-box-label" : "node-text",
    );
    text.setAttribute(
      "fill",
      node.type === "text" ? node.textColor || "#ea580c" : "#0f172a",
    );
    g.appendChild(text);

    g.onmousedown = (e) => {
      if (appState.mode === "move") {
        setDragNode({ node, ox: e.offsetX - node.x, oy: e.offsetY - node.y });
      } else {
        handleConnect(node.id);
      }
    };

    g.onclick = (e) => {
      e.stopPropagation();
      showNodeEdit(node);
    };

    nodesLayer.appendChild(g);
  });

  updatePageIndicator();
  syncPageSizeInputs();
}

export function handleConnect(id) {
  if (!appState.connectSource) {
    setConnectSource(id);
    render();
    return;
  }

  if (appState.connectSource !== id) {
    const n1 = getNodes().find((n) => n.id === appState.connectSource);
    const n2 = getNodes().find((n) => n.id === id);

    if (n1.type === "text" || n2.type === "text") {
      setConnectSource(null);
      render();
      return;
    }

    if (n1.type === "entity" && n2.type === "entity") {
      const c1 = getNodeCenter(n1);
      const c2 = getNodeCenter(n2);
      const axis =
        Math.abs(c1.x - c2.x) >= Math.abs(c1.y - c2.y)
          ? "horizontal"
          : "vertical";

      if (axis === "horizontal") {
        setNodeCenter(n2, c2.x, c1.y);
      } else {
        setNodeCenter(n2, c1.x, c2.y);
      }

      clampNodeToPage(n2);

      const nextCenter1 = getNodeCenter(n1);
      const nextCenter2 = getNodeCenter(n2);
      const rel = addNode(
        "rel",
        (nextCenter1.x + nextCenter2.x) / 2 - 50,
        (nextCenter1.y + nextCenter2.y) / 2 - 35,
        "Has",
      );
      rel.layoutAxis = axis;
      recenterRelationship(rel, [n1, n2], axis);

      getEdges().push({
        from: n1.id,
        to: rel.id,
        styleStart: "mandatory",
        styleEnd: "mandatory",
      });
      getEdges().push({
        from: rel.id,
        to: n2.id,
        styleStart: "mandatory",
        styleEnd: "mandatory",
      });
    } else {
      getEdges().push({
        from: appState.connectSource,
        to: id,
        styleStart: "mandatory",
        styleEnd: "mandatory",
      });
    }

    setConnectSource(null);
    render();
  }
}

export function showEdgeEdit(edge) {
  panelBody.innerHTML = `
    <label>Start Line Style</label>
    <select id="edgeStyleStart">
      <option value="mandatory" ${edge.styleStart === "mandatory" ? "selected" : ""}>Standard Line</option>
      <option value="optional" ${edge.styleStart === "optional" ? "selected" : ""}>Optional Line (Circle)</option>
    </select>

    <label>End Line Style</label>
    <select id="edgeStyleEnd">
      <option value="mandatory" ${edge.styleEnd === "mandatory" ? "selected" : ""}>Standard Line</option>
      <option value="optional" ${edge.styleEnd === "optional" ? "selected" : ""}>Optional Line (Circle)</option>
    </select>

    <button class="btn danger" style="width:100%; margin-top:10px" id="deleteEdgeBtn">Delete Link</button>
  `;

  document.getElementById("edgeStyleStart").onchange = (e) => {
    edge.styleStart = e.target.value;
    render();
  };

  document.getElementById("edgeStyleEnd").onchange = (e) => {
    edge.styleEnd = e.target.value;
    render();
  };

  document.getElementById("deleteEdgeBtn").onclick = () => {
    getPage().edges = getEdges().filter((e) => e !== edge);
    editPanel.style.display = "none";
    render();
  };

  editPanel.style.display = "block";
}

export function showNodeEdit(node) {
  let html = `
    <label>${node.type === "text" ? "Annotation Text" : "Display Name"}</label>
    <input type="text" id="nodeLabelInput" value="${escapeHtml(node.label)}">
  `;

  if (node.type === "text") {
    html += `
      <div class="row2">
        <div>
          <label>Text Color</label>
          <input type="color" id="nodeTextColor" value="${node.textColor || "#ea580c"}">
        </div>
        <div>
          <label>Box Background</label>
          <input type="color" id="nodeBoxBg" value="${node.boxBg || "#ffffff"}">
        </div>
      </div>

      <div class="row2">
        <div>
          <label>Border Color</label>
          <input type="color" id="nodeBoxBorder" value="${node.boxBorder || "#cbd5e1"}">
        </div>
        <div>
          <label>Border Width</label>
          <input type="number" min="0" max="10" id="nodeBorderWidth" value="${node.boxBorderWidth ?? 2}">
        </div>
      </div>

      <label>Text Box Size Preset</label>
      <select id="textSizePreset">
        <option value="">Custom</option>
        <option value="S">Small</option>
        <option value="M" selected>Medium</option>
        <option value="L">Large</option>
      </select>

      <div class="row2">
        <div>
          <label>Width</label>
          <input type="number" min="30" max="600" id="nodeWidth" value="${node.w}">
        </div>
        <div>
          <label>Height</label>
          <input type="number" min="20" max="300" id="nodeHeight" value="${node.h}">
        </div>
      </div>
    `;
  }

  if (node.type === "entity") {
    html += `
      <button class="btn" style="width:100%; margin:-6px 0 12px" id="renameEntityBtn">Rename to "Entity"</button>
      <label>Entity Background Color</label>
      <input type="color" id="entityColor" value="${node.color || "#ffffff"}">
    `;
  }

  if (node.type === "entity" || node.type === "rel") {
    const rot = Number(node.rotation || 0);
    html += `
      <label>Rotation (0–360)</label>
      <input type="range" min="0" max="360" id="nodeRotationRange" value="${rot}">
      <input type="number" min="0" max="360" id="nodeRotationNumber" value="${rot}">
    `;
  }

  if (node.type === "entity") {
    html += `
      <label>Entity Type</label>
      <select id="entityVariant">
        <option value="strong" ${node.variant === "strong" ? "selected" : ""}>Strong</option>
        <option value="weak" ${node.variant === "weak" ? "selected" : ""}>Weak</option>
        <option value="associative" ${node.variant === "associative" ? "selected" : ""}>Associative</option>
      </select>
    `;
  } else if (node.type === "rel") {
    html += `
      <label>Relationship Type</label>
      <select id="relMapping">
        ${REL_MAPPINGS.map((m) => `<option value="${m}" ${node.mapping === m ? "selected" : ""}>${m}</option>`).join("")}
      </select>
    `;
  }

  html += `<button class="btn danger" style="width:100%; margin-top:10px" id="deleteNodeBtn">Delete Shape</button>`;

  panelBody.innerHTML = html;

  document.getElementById("nodeLabelInput").oninput = (e) => {
    node.label = e.target.value;
    render();
  };

  if (node.type === "text") {
    document.getElementById("nodeTextColor").oninput = (e) => {
      node.textColor = e.target.value;
      render();
    };
    document.getElementById("nodeBoxBg").oninput = (e) => {
      node.boxBg = e.target.value;
      render();
    };
    document.getElementById("nodeBoxBorder").oninput = (e) => {
      node.boxBorder = e.target.value;
      render();
    };
    document.getElementById("nodeBorderWidth").oninput = (e) => {
      node.boxBorderWidth = Number(e.target.value);
      render();
    };
    document.getElementById("nodeWidth").oninput = (e) => {
      node.w = Number(e.target.value);
      render();
    };
    document.getElementById("nodeHeight").oninput = (e) => {
      node.h = Number(e.target.value);
      render();
    };

    document.getElementById("textSizePreset").onchange = (e) => {
      const v = e.target.value;
      if (v === "S") {
        node.w = 50;
        node.h = 36;
      }
      if (v === "M") {
        node.w = 70;
        node.h = 46;
      }
      if (v === "L") {
        node.w = 110;
        node.h = 56;
      }
      render();
    };
  }

  if (node.type === "entity") {
    document.getElementById("renameEntityBtn").onclick = () => {
      node.label = "Entity";
      render();
    };

    document.getElementById("entityColor").oninput = (e) => {
      node.color = e.target.value;
      render();
    };

    document.getElementById("entityVariant").onchange = (e) => {
      node.variant = e.target.value;
      render();
    };
  }

  if (node.type === "entity" || node.type === "rel") {
    const range = document.getElementById("nodeRotationRange");
    const number = document.getElementById("nodeRotationNumber");

    range.oninput = (e) => {
      node.rotation = Number(e.target.value);
      number.value = e.target.value;
      render();
    };

    number.oninput = (e) => {
      node.rotation = Number(e.target.value);
      range.value = e.target.value;
      render();
    };
  }

  if (node.type === "rel") {
    document.getElementById("relMapping").onchange = (e) => {
      node.mapping = e.target.value;
      render();
    };
  }

  document.getElementById("deleteNodeBtn").onclick = () => {
    getPage().nodes = getNodes().filter((n) => n !== node);
    getPage().edges = getEdges().filter(
      (e) => e.from !== node.id && e.to !== node.id,
    );
    editPanel.style.display = "none";
    render();
  };

  editPanel.style.display = "block";
}

export function quickExamples() {
  clearAll();

  const e1 = addNode("entity", 120, 120, "User", "strong");
  const r1 = addNode("rel", 360, 115, "Has");
  const e2 = addNode("entity", 560, 120, "Profile", "weak");

  getEdges().push({
    from: e1.id,
    to: r1.id,
    styleStart: "mandatory",
    styleEnd: "mandatory",
  });
  getEdges().push({
    from: r1.id,
    to: e2.id,
    styleStart: "mandatory",
    styleEnd: "optional",
  });

  const t1 = addNode("text", 260, 95, "1");
  const t2 = addNode("text", 440, 95, "1");
  t1.boxBg = "#fff7ed";
  t2.boxBg = "#fff7ed";

  render();
}

export function clearAll() {
  getPage().nodes = [];
  getPage().edges = [];
  render();
  editPanel.style.display = "none";
}

export function exportData() {
  const payload = {
    pages: appState.pages.map((p, i) => ({
      page: pageLabel(i),
      width: p.width,
      height: p.height,
      nodes: p.nodes,
      edges: p.edges,
    })),
  };

  console.log(JSON.stringify(payload, null, 2));
  alert("JSON (all pages) logged to console.");
}

export function bindStageEvents() {
  stage.onmousemove = (e) => {
    if (appState.dragNode) {
      appState.dragNode.node.x = e.offsetX - appState.dragNode.ox;
      appState.dragNode.node.y = e.offsetY - appState.dragNode.oy;
      clampNodeToPage(appState.dragNode.node);
      smartAlignRelationshipGroup(appState.dragNode.node);
      render();
    }
  };

  stage.onmouseup = () => {
    if (appState.dragNode) {
      smartAlignRelationshipGroup(appState.dragNode.node);
      render();
    }
    setDragNode(null);
  };

  window.onclick = (e) => {
    if (e.target === stage) {
      editPanel.style.display = "none";
    }
  };

  window.addEventListener("resize", () => {
    setViewBox();
    render();
  });
}
