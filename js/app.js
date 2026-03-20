import { FOOTER_CONFIG } from "./state.js";
import {
  addPage,
  prevPage,
  nextPage,
  addNode,
  setEditorMode,
  quickExamples,
  clearAll,
  exportData,
  bindStageEvents,
  render,
  setViewBox,
} from "./editor.js";
import { savePNG, saveJPEG, savePDF, savePDFAll } from "./export.js";

document.getElementById("btnAddPage").onclick = addPage;
document.getElementById("btnPrevPage").onclick = prevPage;
document.getElementById("btnNextPage").onclick = nextPage;

document.getElementById("btnAddStrong").onclick = () =>
  addNode("entity", 100, 100, "Strong", "strong");
document.getElementById("btnAddWeak").onclick = () =>
  addNode("entity", 100, 100, "Weak", "weak");
document.getElementById("btnAddAssoc").onclick = () =>
  addNode("entity", 100, 100, "Assoc", "associative");
document.getElementById("btnAddRel").onclick = () =>
  addNode("rel", 100, 100, "Has");
document.getElementById("btnAddText").onclick = () =>
  addNode("text", 120, 120, "1");

document.getElementById("modeMove").onclick = () => setEditorMode("move");
document.getElementById("modeConnect").onclick = () => setEditorMode("connect");

document.getElementById("btnQuickExamples").onclick = quickExamples;
document.getElementById("btnClear").onclick = clearAll;

document.getElementById("btnExportJson").onclick = exportData;
document.getElementById("btnSavePng").onclick = savePNG;
document.getElementById("btnSaveJpeg").onclick = saveJPEG;
document.getElementById("btnSavePdf").onclick = savePDF;
document.getElementById("btnSavePdfAll").onclick = savePDFAll;

document.getElementById("appVersion").textContent = FOOTER_CONFIG.version;
document.getElementById("creatorName").textContent = FOOTER_CONFIG.creator;
document.getElementById("githubLink").href = FOOTER_CONFIG.github;

bindStageEvents();
setViewBox();
render();
