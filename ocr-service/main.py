"""
OCR service for Laudo Echo - extracts patient data from images (scanned forms, etc.).
Returns the same shape as DICOM metadata for auto-filling the patient form.
"""
import re
import base64
import io
from typing import Optional

from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

# Lazy load EasyOCR on first request to speed up startup
_reader = None

def get_reader():
    global _reader
    if _reader is None:
        # Monkey patch PIL.Image.ANTIALIAS for Pillow 10+ compatibility (ANTIALIAS was removed)
        from PIL import Image
        if not hasattr(Image, "ANTIALIAS"):
            Image.ANTIALIAS = Image.LANCZOS  # LANCZOS is the modern replacement
        
        import easyocr
        _reader = easyocr.Reader(["pt", "en"], gpu=False)
    return _reader


app = FastAPI(title="Laudo Echo OCR", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Ensure all unhandled errors return JSON (no HTML traceback) for the Edge Function."""
    if isinstance(exc, HTTPException):
        return JSONResponse(status_code=exc.status_code, content={"error": str(exc.detail), "detail": str(exc.detail)})
    return JSONResponse(
        status_code=500,
        content={"error": "OCR failed", "detail": str(exc)},
    )


class OcrResponse(BaseModel):
    nome: str = ""
    responsavel: str = ""
    responsavelTelefone: str = ""
    responsavelEmail: str = ""
    especie: str = ""
    raca: str = ""
    sexo: str = ""
    idade: str = ""
    peso: str = ""


class OcrJsonRequest(BaseModel):
    image_base64: Optional[str] = None
    image: Optional[str] = None  # alias for image_base64


def parse_patient_data(text: str) -> dict:
    """Extract patient information from OCR text (Portuguese veterinary forms)."""
    if not text or not text.strip():
        return {}
    text_lower = text.lower().strip()
    result = {}

    # Nome do paciente / animal
    for pattern in [
        r"(?:nome\s+do\s+paciente|paciente|animal|nome)[\s:]+([a-záàâãéêíóôõúç\s]+?)(?=\n|$|responsável|telefone|espécie)",
        r"(?:paciente|animal)[\s:]+([a-záàâãéêíóôõúç\s]+?)(?=\n|$)",
    ]:
        m = re.search(pattern, text_lower, re.IGNORECASE)
        if m and m.group(1).strip():
            result["nome"] = m.group(1).strip().title()
            break

    # Responsável / tutor
    for pattern in [
        r"(?:responsável|tutor|proprietário|dono|nome\s+do\s+responsável)[\s:]+([a-záàâãéêíóôõúç\s]+?)(?=\n|$|telefone|e-?mail)",
        r"(?:responsável|tutor)[\s:]+([a-záàâãéêíóôõúç\s]+?)(?=\n|$)",
    ]:
        m = re.search(pattern, text_lower, re.IGNORECASE)
        if m and m.group(1).strip():
            result["responsavel"] = m.group(1).strip().title()
            break

    # Telefone
    for pattern in [
        r"(?:telefone|whatsapp|celular|tel\.?|fone)[\s:]*([\d\s\(\)\-\.]+)",
        r"(?:\(?\d{2}\)?\s*[\s\-\.]?\d{4,5}[\s\-\.]?\d{4})",
    ]:
        m = re.search(pattern, text_lower, re.IGNORECASE)
        if m:
            raw = re.sub(r"\D", "", m.group(1) if m.lastindex else m.group(0))[:11]
            if len(raw) >= 10:
                result["responsavelTelefone"] = f"({raw[:2]}) {raw[2:7]}-{raw[7:]}"
            break

    # E-mail
    m = re.search(
        r"(?:email|e-?mail)[\s:]*([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})",
        text_lower,
        re.IGNORECASE,
    )
    if m:
        result["responsavelEmail"] = m.group(1).strip()

    # Espécie
    for pattern in [
        r"(?:espécie|tipo)[\s:]*([a-záàâãéêíóôõúç]+)",
        r"\b(canino|cão|cachorro|felino|gato)\b",
    ]:
        m = re.search(pattern, text_lower, re.IGNORECASE)
        if m and m.group(1).strip():
            v = m.group(1).strip()
            if "canino" in v or "cão" in v or "cachorro" in v:
                result["especie"] = "canino"
            elif "felino" in v or "gato" in v:
                result["especie"] = "felino"
            else:
                result["especie"] = v
            break

    # Raça
    m = re.search(
        r"(?:raça|breed)[\s:]*([a-záàâãéêíóôõúç\s]+?)(?=\n|$|sexo|idade|peso)",
        text_lower,
        re.IGNORECASE,
    )
    if m and m.group(1).strip():
        result["raca"] = m.group(1).strip().title()

    # Sexo
    for pattern in [
        r"(?:sexo|gênero)[\s:]*([a-záàâãéêíóôõúç]+)",
        r"\b(macho|fêmea|femea|macho\s+castrado|fêmea\s+castrada|femea\s+castrada)\b",
    ]:
        m = re.search(pattern, text_lower, re.IGNORECASE)
        if m and m.group(1).strip():
            v = m.group(1).strip()
            if "macho" in v:
                result["sexo"] = "macho-castrado" if "castrado" in v else "macho"
            elif "fêmea" in v or "femea" in v:
                result["sexo"] = "femea-castrada" if "castrada" in v else "femea"
            break

    # Idade
    m = re.search(
        r"(?:idade|age)[\s:]*([\d\s]+(?:ano|mes|mês|year|month)s?)",
        text_lower,
        re.IGNORECASE,
    )
    if m:
        result["idade"] = m.group(1).strip()
    else:
        m = re.search(r"(\d+)\s*(?:ano|mes|mês|year|month)s?", text_lower, re.IGNORECASE)
        if m:
            result["idade"] = m.group(0).strip()

    # Peso
    m = re.search(
        r"(?:peso|weight)[\s:]*([\d,\.]+)\s*(?:kg|kilograma)?",
        text_lower,
        re.IGNORECASE,
    )
    if m:
        result["peso"] = m.group(1).replace(",", ".").strip()
    else:
        m = re.search(r"(\d+[,\.]\d+)\s*kg", text_lower, re.IGNORECASE)
        if m:
            result["peso"] = m.group(1).replace(",", ".")

    return result


def run_ocr(image_bytes: bytes) -> str:
    """Run EasyOCR on image bytes; return combined text."""
    reader = get_reader()
    import numpy as np
    from PIL import Image
    img = Image.open(io.BytesIO(image_bytes))
    img_array = np.array(img)
    if len(img_array.shape) == 2:
        pass
    elif img_array.shape[2] == 4:
        img_array = img_array[:, :, :3]
    results = reader.readtext(img_array)
    return " ".join([r[1] for r in results]).strip()


@app.post("/ocr/extract", response_model=OcrResponse)
async def extract_ocr(file: Optional[UploadFile] = File(None), image_base64: Optional[str] = None):
    """
    Extract patient data from an image.
    Accepts either multipart file upload or JSON body with image_base64.
    """
    image_bytes: Optional[bytes] = None

    if file and file.filename:
        image_bytes = await file.read()
    elif image_base64:
        try:
            image_bytes = base64.b64decode(image_base64)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 image: {e}")
    else:
        raise HTTPException(status_code=400, detail="Provide 'file' (multipart) or 'image_base64' (JSON)")

    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image")

    try:
        full_text = run_ocr(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")

    data = parse_patient_data(full_text)
    return OcrResponse(
        nome=data.get("nome", ""),
        responsavel=data.get("responsavel", ""),
        responsavelTelefone=data.get("responsavelTelefone", ""),
        responsavelEmail=data.get("responsavelEmail", ""),
        especie=data.get("especie", ""),
        raca=data.get("raca", ""),
        sexo=data.get("sexo", ""),
        idade=data.get("idade", ""),
        peso=data.get("peso", ""),
    )


@app.post("/ocr/extract-json", response_model=OcrResponse)
async def extract_ocr_json(body: OcrJsonRequest):
    """Accept JSON body with base64 image (for Supabase Edge Function)."""
    image_base64 = body.image_base64 or body.image
    if not image_base64:
        raise HTTPException(status_code=400, detail="Missing image_base64 or image in body")
    return await extract_ocr(file=None, image_base64=image_base64)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ocr"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
