import { stage, appState } from "./state.js";
import { pageLabel, render, setViewBox } from "./editor.js";

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function buildExportSvgInlineStyles(svgEl) {
  let cssText = "";

  for (const sheet of document.styleSheets) {
    try {
      for (const rule of sheet.cssRules) {
        cssText += rule.cssText + "\n";
      }
    } catch (e) {
      console.warn("Cannot read stylesheet rules:", e);
    }
  }

  const styleEl = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "style",
  );
  styleEl.textContent = cssText;
  svgEl.insertBefore(styleEl, svgEl.firstChild);
}

function cloneCurrentStageForExport() {
  const clone = stage.cloneNode(true);
  const vb = stage.getAttribute("viewBox");

  if (vb) clone.setAttribute("viewBox", vb);

  const [x, y, w, h] = vb
    ? vb.split(" ").map(Number)
    : [0, 0, stage.clientWidth, stage.clientHeight];

  const bg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  bg.setAttribute("x", "0");
  bg.setAttribute("y", "0");
  bg.setAttribute("width", w || stage.clientWidth);
  bg.setAttribute("height", h || stage.clientHeight);
  bg.setAttribute("fill", "#ffffff");
  clone.insertBefore(bg, clone.firstChild);

  buildExportSvgInlineStyles(clone);

  clone.setAttribute("width", w || stage.clientWidth);
  clone.setAttribute("height", h || stage.clientHeight);

  return { clone, w: w || stage.clientWidth, h: h || stage.clientHeight };
}

async function svgToCanvas(scale = 2) {
  const { clone, w, h } = cloneCurrentStageForExport();
  const xml = new XMLSerializer().serializeToString(clone);
  const svgBlob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  const img = new Image();
  img.decoding = "async";
  img.src = url;

  await new Promise((res, rej) => {
    img.onload = () => res();
    img.onerror = (e) => rej(e);
  });

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(w * scale);
  canvas.height = Math.round(h * scale);

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  URL.revokeObjectURL(url);
  return canvas;
}

function safeName(s) {
  return String(s)
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "");
}

function getStageSize() {
  const vb = stage.getAttribute("viewBox");
  const [, , w, h] = vb
    ? vb.split(" ").map(Number)
    : [0, 0, stage.clientWidth, stage.clientHeight];

  return {
    width: w || stage.clientWidth,
    height: h || stage.clientHeight,
  };
}

function getPdfLib() {
  const jsPdfRoot = window.jspdf;
  if (!jsPdfRoot?.jsPDF) {
    throw new Error("jsPDF did not load.");
  }
  return jsPdfRoot.jsPDF;
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

async function addCanvasPageToPdf(pdf, width, height) {
  const canvas = await svgToCanvas(2);
  const imageData = canvas.toDataURL("image/png");
  pdf.addImage(imageData, "PNG", 0, 0, width, height, undefined, "FAST");
}

export async function savePNG() {
  const canvas = await svgToCanvas(2);
  const label = safeName(pageLabel(appState.currentPage));
  canvas.toBlob((blob) => {
    if (!blob) return;
    downloadBlob(blob, `erd-${label}.png`);
  }, "image/png");
}

export async function saveJPEG() {
  const canvas = await svgToCanvas(2);
  const label = safeName(pageLabel(appState.currentPage));
  canvas.toBlob(
    (blob) => {
      if (!blob) return;
      downloadBlob(blob, `erd-${label}.jpg`);
    },
    "image/jpeg",
    0.92,
  );
}

export async function savePDF() {
  const { width, height } = getStageSize();
  const jsPDF = getPdfLib();
  const orientation = width >= height ? "l" : "p";
  const pdf = new jsPDF({
    orientation,
    unit: "pt",
    format: [width, height],
  });

  if (typeof window.svg2pdf === "function") {
    const { clone } = cloneCurrentStageForExport();
    const xml = new XMLSerializer().serializeToString(clone);
    const svgEl = new DOMParser().parseFromString(
      xml,
      "image/svg+xml",
    ).documentElement;

    await window.svg2pdf(svgEl, pdf, { xOffset: 0, yOffset: 0, scale: 1 });
  } else {
    await addCanvasPageToPdf(pdf, width, height);
  }

  const label = safeName(pageLabel(appState.currentPage));
  pdf.save(`erd-${label}.pdf`);
}

export async function savePDFAll() {
  const oldIndex = appState.currentPage;
  let pdf = null;

  try {
    const jsPDF = getPdfLib();

    for (let i = 0; i < appState.pages.length; i++) {
      appState.currentPage = i;
      setViewBox();
      render();
      await waitForNextPaint();

      const { width, height } = getStageSize();
      const orientation = width >= height ? "l" : "p";

      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: "pt",
          format: [width, height],
        });
      } else {
        pdf.addPage([width, height], orientation);
        pdf.setPage(i + 1);
      }

      await addCanvasPageToPdf(pdf, width, height);
    }
  } finally {
    appState.currentPage = oldIndex;
    setViewBox();
    render();
  }

  if (pdf) pdf.save("erd-all-pages.pdf");
}
