from fastapi import FastAPI, UploadFile, File, Request, Body
from fastapi.responses import FileResponse, HTMLResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

import os
import io
import base64
from PIL import Image
from pdf2docx import Converter

app = FastAPI()

# ------------------ CORS ------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------ FOLDERS ------------------
UPLOAD_DIR = "uploads"
OUTPUT_DIR = "outputs"

os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ------------------ STATIC & TEMPLATES ------------------
templates = Jinja2Templates(directory="templates")
app.mount("/static", StaticFiles(directory="static"), name="static")

# =========================================================
# UI ROUTES (FIXED)
# =========================================================

@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/pdf_editor", response_class=HTMLResponse)
async def pdf_editor(request: Request):
    return templates.TemplateResponse("pdf_editor.html", {"request": request})


@app.get("/pdf_merge", response_class=HTMLResponse)
async def pdf_merge(request: Request):
    return templates.TemplateResponse("pdf_merge.html", {"request": request})


@app.get("/pdf_compress", response_class=HTMLResponse)
async def pdf_compress(request: Request):
    return templates.TemplateResponse("pdf_compress.html", {"request": request})


@app.get("/pdf-to-word", response_class=HTMLResponse)
async def pdf_to_word_page(request: Request):
    return templates.TemplateResponse("pdf_to_word.html", {"request": request})


@app.get("/pdf-to-ppt", response_class=HTMLResponse)
async def pdf_to_ppt_page(request: Request):
    return templates.TemplateResponse("pdf_to_ppt.html", {"request": request})


@app.get("/word-to-pdf", response_class=HTMLResponse)
async def word_to_pdf_page(request: Request):
    return templates.TemplateResponse("word_to_pdf.html", {"request": request})


# =========================================================
# API ROUTES
# =========================================================

# ---------- PDF EDITOR SAVE ----------
@app.post("/save-pdf")
async def save_pdf(data: dict = Body(...)):
    images = []

    for img_data in data["images"]:
        img_bytes = base64.b64decode(img_data.split(",")[1])
        img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
        images.append(img)

    pdf_bytes = io.BytesIO()
    images[0].save(
        pdf_bytes,
        format="PDF",
        save_all=True,
        append_images=images[1:]
    )
    pdf_bytes.seek(0)

    return StreamingResponse(
        pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=edited.pdf"}
    )


# ---------- PDF → WORD ----------
@app.post("/convert/pdf-to-word")
async def pdf_to_word(file: UploadFile = File(...)):
    input_path = os.path.join(UPLOAD_DIR, file.filename)
    output_path = os.path.join(OUTPUT_DIR, file.filename.replace(".pdf", ".docx"))

    with open(input_path, "wb") as f:
        f.write(await file.read())

    cv = Converter(input_path)
    cv.convert(output_path)
    cv.close()

    return FileResponse(output_path, filename="converted.docx")


# ---------- WORD → PDF (DISABLED FOR DEPLOY) ----------
@app.post("/convert/word-to-pdf")
async def word_to_pdf():
    return {"message": "This feature works only in local environment"}


# ---------- PDF → PPT (DISABLED FOR DEPLOY) ----------
@app.post("/convert/pdf-to-ppt")
async def pdf_to_ppt():
    return {"message": "This feature works only in local environment"}
