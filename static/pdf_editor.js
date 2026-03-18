// ---------- GLOBAL STATE ----------
let pdfDoc = null;
let canvases = [];
let history = [];
let redoStack = [];

let scale = 1.5;
const MIN_ZOOM = 0.8;
const MAX_ZOOM = 3;

const pdfContainer = document.getElementById("pdf-container");

// ---------- LOAD PDF FROM FILE INPUT ----------
const fileInput = document.getElementById("fileInput");

fileInput.addEventListener("change", async () => {
  pdfContainer.innerHTML = "";
  canvases = [];
  history = [];
  redoStack = [];

  const file = fileInput.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.readAsArrayBuffer(file);

  reader.onload = async () => {
    pdfDoc = await pdfjsLib.getDocument({ data: reader.result }).promise;

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      renderPage(i);
    }
  };
});

// ---------- RENDER PDF PAGE ----------
async function renderPage(pageNum) {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });

  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.className = "pdf-canvas";

  pdfContainer.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  await page.render({ canvasContext: ctx, viewport }).promise;

  enableDrawing(canvas);
}

// ---------- FABRIC DRAWING ----------
function enableDrawing(canvasEl) {
  const fabricCanvas = new fabric.Canvas(canvasEl, {
    isDrawingMode: true
  });

  fabricCanvas.freeDrawingBrush.width = 2;
  fabricCanvas.freeDrawingBrush.color = "red";

  saveState(fabricCanvas);

  fabricCanvas.on("object:added", () => saveState(fabricCanvas));
  fabricCanvas.on("object:modified", () => saveState(fabricCanvas));
  fabricCanvas.on("object:removed", () => saveState(fabricCanvas));

  canvases.push(fabricCanvas);
}

// ---------- TOOLBAR ----------
function setDraw() {
  canvases.forEach(c => {
    c.isDrawingMode = true;
    c.globalCompositeOperation = "source-over";
  });
}

function setColor(color) {
  canvases.forEach(c => {
    c.freeDrawingBrush.color = color;

    const obj = c.getActiveObject();
    if (obj && obj.type === "i-text") {
      obj.set("fill", color);
      c.renderAll();
    }
  });
}

function clearAll() {
  canvases.forEach(c => c.clear());
}

// ---------- TEXT ----------
function addText() {
  canvases.forEach(c => {
    c.isDrawingMode = false;

    const text = new fabric.IText("Type here", {
      left: 50,
      top: 50,
      fill: "red",
      fontSize: 18
    });

    c.add(text);
    c.setActiveObject(text);
  });
}

// ---------- UNDO / REDO ----------
function saveState(canvas) {
  history.push(JSON.stringify(canvas.toJSON()));
  redoStack = [];
}

function undo() {
  if (history.length <= 1) return;

  redoStack.push(history.pop());
  const last = history[history.length - 1];

  canvases.forEach(c => {
    c.loadFromJSON(last, () => c.renderAll());
  });
}

function redo() {
  if (!redoStack.length) return;

  const state = redoStack.pop();
  history.push(state);

  canvases.forEach(c => {
    c.loadFromJSON(state, () => c.renderAll());
  });
}

// ---------- ERASER ----------
function setEraser() {
  canvases.forEach(c => {
    c.isDrawingMode = true;
    c.freeDrawingBrush = new fabric.PencilBrush(c);
    c.freeDrawingBrush.width = 20;
    c.freeDrawingBrush.color = "rgba(0,0,0,1)";
    c.globalCompositeOperation = "destination-out";
  });
}

// ---------- ZOOM ----------
function zoomIn() {
  if (scale >= MAX_ZOOM) return;
  scale += 0.2;
  rerenderPDF();
}

function zoomOut() {
  if (scale <= MIN_ZOOM) return;
  scale -= 0.2;
  rerenderPDF();
}

function rerenderPDF() {
  pdfContainer.innerHTML = "";
  canvases = [];

  for (let i = 1; i <= pdfDoc.numPages; i++) {
    renderPage(i);
  }
}

// ---------- SAVE PDF ----------
async function savePDF() {
  const images = canvases.map(c => c.toDataURL("image/png"));

  const response = await fetch("/save-pdf", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ images })
  });

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "edited.pdf";
  a.click();
}