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
    """Extract patient information from OCR text (Portuguese forms or ultrasound header)."""
    if not text or not text.strip():
        return {}
    text_lower = text.lower().strip()
    result = {}

    # Nome do paciente / animal (form labels)
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

    # Fallback: ultrasound machine header "PDA, BLESS, CAN, F, N... 11738", "GOLDFEDER"
    if not result.get("especie"):
        if re.search(r"\bCAN\b", text, re.IGNORECASE):
            result["especie"] = "canino"
        elif re.search(r"\bFEL|FELINE|GATO\b", text, re.IGNORECASE):
            result["especie"] = "felino"
    if not result.get("sexo"):
        if re.search(r",\s*F\s*,|\bF\s+[MN]|Female\b", text, re.IGNORECASE):
            result["sexo"] = "femea"
        elif re.search(r",\s*M\s*,|\bM\s+[FN]|Male\b", text, re.IGNORECASE):
            result["sexo"] = "macho"
    if not result.get("nome"):
        m = re.search(r"\b([A-Z][A-Za-z]{2,})\b", text)
        skip = ("PDA", "BLESS", "GTG", "LA", "IVS", "LV", "EDV", "ESV", "FS", "EF", "PV", "MV", "TV", "AV", "TAPSE", "FAC", "RAP", "DIST", "IND", "MM", "TEICH", "SIMPSON", "AORTIC", "LEFT", "RIGHT", "AFFINITI", "PHILIPS", "HGEN")
        if m and m.group(1).upper() not in skip:
            result["nome"] = m.group(1).strip().title()

    return result


def _normalize_number(s: str) -> str:
    """Normalize number string: space or comma as decimal separator -> dot."""
    if not s:
        return ""
    return s.replace(",", ".").replace(" ", ".").strip()


def _extract_number_after_labels(
    text: str, labels: list[str], units: Optional[str] = None
) -> str:
    """Find first label and return the following number (with comma/dot/space as decimal).
    units: optional regex suffix for allowed units (e.g. r'(?:cm|mm|%|ml|cm/s|mmHg|m/s)?').
    Tries: digit.digit then digit,digit then digit digit (OCR often drops decimal point).
    """
    if not text or not text.strip():
        return ""
    text_norm = text.replace("\n", " ")
    suffix = units or r"(?:cm|mm|%|ml|cm²|cm/s|mmHg|m/s|g)?"
    for label in labels:
        # Pattern: label then optional spaces/:= then number (allow space as decimal separator)
        base = re.escape(label) + r"[\s:=\-]*"
        for num_pattern in [
            r"(\d+[,\.]\d*)",           # 0.409, 2,01
            r"(\d+[\s,\.]\d+)",       # 0 409, 1 . 31
            r"(\d+[,\.]?\d*)",        # 38, 38.8
        ]:
            pattern = base + num_pattern + r"\s*" + suffix
            m = re.search(pattern, text_norm, re.IGNORECASE)
            if m and m.group(1):
                return _normalize_number(m.group(1))
    return ""


def parse_echo_measurements(text: str) -> dict:
    """
    Extract echocardiography measurements and findings from OCR text.
    Returns dicts matching frontend state: measurementsData, funcaoDiastolica, etc.
    Supports both Portuguese report labels and ultrasound machine labels (IVSd, LVIDd, etc.).
    """
    if not text or not text.strip():
        return {}
    out = {}

    # Measurements (VE, AE, Ao, FS, FE) — include machine-style labels from Philips/GE etc.
    labels_dved_d = [
        "LVIDd", "LVID d", "VED", "VEd", "DVED", "ventrículo esquerdo diástole", "LVEDd", "VEDd",
        "Left Ventricular Internal Dimension in diastole",
    ]
    labels_dved_s = [
        "LVIDs", "LVID s", "VES", "VEs", "DVES", "ventrículo esquerdo sístole", "LVEDs", "VEDs",
        "Left Ventricular Internal Dimension in systole",
    ]
    labels_sivd = ["IVSd", "IVS d", "IVS d", "SIVd", "septo interventricular diástole", "I VSd"]
    labels_sivs = ["IVSs", "IVS s", "SIVs", "septo interventricular sístole", "I VSs"]
    labels_plvd = [
        "LVPWd", "PLVEd", "PLVED", "parede livre diástole", "LVFWd", "PWVd",
        "Left Ventricular Posterior Wall thickness in diastole",
    ]
    labels_plvs = [
        "LVPWs", "PLVEs", "PLVES", "parede livre sístole", "LVFWs", "PWVs",
        "Left Ventricular Posterior Wall thickness in systole",
    ]
    labels_ae = [
        "Atrial Area", "Atrial Length", "Atrial Volume", "atrio esquerdo", "AE",
        "átrio esquerdo", "LA", "left atrium", "LA A4Cs",
    ]
    labels_ao = ["Ao", "aorta", "aortic", "AO"]
    labels_fs = [
        "FS (MM-Teich)", "FS(MM-Teich)", "FS", "fração encurtamento",
        "fração de encurtamento", "shortening fraction", "Fractional Shortening",
    ]
    labels_fe = [
        "EF (MM-Teich)", "EF(MM-Teich)", "FE", "fração de ejeção", "fração ejection",
        "ejection fraction", "FE Teicholz", "FET", "Ejection Fraction",
    ]
    measurements = {
        "dvedDiastole": _extract_number_after_labels(text, labels_dved_d),
        "dvedSistole": _extract_number_after_labels(text, labels_dved_s),
        "septoIVd": _extract_number_after_labels(text, labels_sivd),
        "septoIVs": _extract_number_after_labels(text, labels_sivs),
        "paredeLVd": _extract_number_after_labels(text, labels_plvd),
        "paredeLVs": _extract_number_after_labels(text, labels_plvs),
        "atrioEsquerdo": _extract_number_after_labels(text, labels_ae),
        "aorta": _extract_number_after_labels(text, labels_ao),
        "fracaoEncurtamento": _extract_number_after_labels(text, labels_fs),
        "fracaoEjecaoTeicholz": _extract_number_after_labels(text, labels_fe),
    }
    out["measurementsData"] = {k: v for k, v in measurements.items() if v}

    # Função diastólica: E, A, E/A, TRIV, etc.
    labels_e = ["onda E", "E wave", "E:", "E =", "velocidade E"]
    labels_a = ["onda A", "A wave", "A:", "A =", "velocidade A"]
    labels_triv = ["TRIV", "TRI V", "tempo relaxamento"]
    labels_dt = ["DT", "tempo desaceleração", "deceleration time"]
    funcao_d = {
        "ondaE": _extract_number_after_labels(text, labels_e),
        "ondaA": _extract_number_after_labels(text, labels_a),
        "triv": _extract_number_after_labels(text, labels_triv),
        "tempoDesaceleracao": _extract_number_after_labels(text, labels_dt),
    }
    out["funcaoDiastolica"] = {k: v for k, v in funcao_d.items() if v}

    # Função sistólica: EPSS, MAPSE, Simpson
    labels_epss = ["EPSS", "epss", "E-point septal separation"]
    labels_mapse = ["MAPSE", "mapse", "mitral annular plane"]
    labels_simpson = ["EF (Simpson)", "EF(Simpson)", "Simpson", "FE Simpson", "fração de ejeção Simpson"]
    funcao_s = {
        "epss": _extract_number_after_labels(text, labels_epss),
        "mapse": _extract_number_after_labels(text, labels_mapse),
        "simpson": _extract_number_after_labels(text, labels_simpson),
    }
    out["funcaoSistolica"] = {k: v for k, v in funcao_s.items() if v}

    # Ventrículo direito: TAPSE, FAC, TDI S', RAP (atrio direito)
    labels_tapse = ["TAPSE", "tapse"]
    labels_fac = ["FAC", "fractional area change"]
    labels_tdis = ["TDI S'", "TDI S", "S'", "s prime"]
    labels_rap_max = ["RAP M max", "Dist. RAP M max", "RAP max", "Dist RAP M max"]
    labels_rap_min = ["RAP M min", "Dist. RAP M min", "RAP min"]
    vd = {
        "tapse": _extract_number_after_labels(text, labels_tapse),
        "fac": _extract_number_after_labels(text, labels_fac),
        "tdiS": _extract_number_after_labels(text, labels_tdis),
        "atrioDireito": _extract_number_after_labels(text, labels_rap_max)
        or _extract_number_after_labels(text, ["atrio direito", "atrium right", "AD"]),
    }
    out["ventriculoDireito"] = {k: v for k, v in vd.items() if v}

    # TDI septal/livre: e', a', S
    labels_eprime = ["e'", "e prime", "e’", "Em"]
    labels_aprime = ["a'", "a prime", "a’", "Am"]
    tdi_s = {
        "e": _extract_number_after_labels(text, ["septal " + l for l in labels_eprime] + ["septal e'"]),
        "a": _extract_number_after_labels(text, ["septal " + l for l in labels_aprime]),
        "s": _extract_number_after_labels(text, ["septal S'", "septal S"]),
    }
    tdi_l = {
        "e": _extract_number_after_labels(text, ["livre " + l for l in labels_eprime] + ["free wall e'", "parede livre e'"]),
        "a": _extract_number_after_labels(text, ["livre " + l for l in labels_aprime]),
        "s": _extract_number_after_labels(text, ["livre S'", "free wall S'"]),
    }
    if any(tdi_s.values()):
        out["tdiSeptal"] = tdi_s
    if any(tdi_l.values()):
        out["tdiLivre"] = tdi_l

    # Doppler valvas: velocidades (cm/s) e gradientes (mmHg) - machine labels
    valv_vel = {
        "mitralVelocidade": _extract_number_after_labels(
            text, ["* Vel", "MV Vmax", "mitral Vmax", "mitral", "MV", "valva mitral", "+ Vel"]
        ),
        "tricuspideVelocidade": _extract_number_after_labels(
            text, ["TV Vmax", "tricúspide", "tricuspide", "TV", "valva tricúspide"]
        ),
        "pulmonarVelocidade": _extract_number_after_labels(
            text, ["+ PV Vmax", "PV Vmax", "Vmax", "pulmonar", "PV", "valva pulmonar"]
        ),
        "aorticaVelocidade": _extract_number_after_labels(
            text, ["x2 + Vel", "+ Vel", "AV Vmax", "aórtica", "aortica", "AV", "valva aórtica"]
        ),
    }
    valv_grad = {
        "pulmonarGradiente": _extract_number_after_labels(text, ["Max PG", "PV Vmax", "PV"], r"(?:mmHg)?"),
    }
    combined_valv = {**valv_vel, **valv_grad}
    out["valvasDoppler"] = {k: v for k, v in combined_valv.items() if v}

    # Achados / Conclusões: try to find sections
    for section, patterns in [
        ("achados", ["achados", "findings", "observações", "observacoes"]),
        ("conclusoes", ["conclusão", "conclusoes", "conclusion", "diagnóstico", "diagnóstico"]),
    ]:
        for pat in patterns:
            m = re.search(re.escape(pat) + r"\s*[:\-]?\s*(.+?)(?=\n\n|conclusão|conclusoes|achados|$)", text, re.IGNORECASE | re.DOTALL)
            if m and m.group(1).strip():
                snippet = m.group(1).strip()[:2000]
                if section not in out:
                    out[section] = snippet
                break

    return out


def parse_exam_info(text: str) -> dict:
    """Extract exam metadata from ultrasound image text: date, time, heart rate (bpm)."""
    if not text or not text.strip():
        return {}
    info = {}
    # Date dd/mm/yyyy or dd-mm-yyyy
    m = re.search(r"(\d{1,2})[/\-](\d{1,2})[/\-](\d{4})", text)
    if m:
        d, mo, y = m.group(1), m.group(2), m.group(3)
        info["data"] = f"{y}-{mo.zfill(2)}-{d.zfill(2)}"  # ISO for input type=date
    # Heart rate: 155 bpm, 143bpm, 157bpm
    m = re.search(r"(\d{2,3})\s*bpm", text, re.IGNORECASE)
    if m and m.group(1):
        info["frequenciaCardiaca"] = m.group(1).strip()
    return info


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


@app.post("/ocr/extract-exam")
async def extract_exam(body: OcrJsonRequest):
    """
    Extract full exam data from an ultrasound/echocardiogram image.
    Returns measurementsData, funcaoDiastolica, ventriculoDireito, tdiSeptal, tdiLivre,
    valvasDoppler, achados, conclusoes, plus optional examInfo (data, frequenciaCardiaca)
    and patientData for one-shot form fill. Used by Supabase Edge Function 'extract-exam'.
    """
    image_base64 = body.image_base64 or body.image
    if not image_base64:
        raise HTTPException(status_code=400, detail="Missing image_base64 or image in body")
    try:
        image_bytes = base64.b64decode(image_base64)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid base64 image: {e}")
    if not image_bytes or len(image_bytes) == 0:
        raise HTTPException(status_code=400, detail="Empty image")
    try:
        full_text = run_ocr(image_bytes)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OCR failed: {str(e)}")
    exam_content = parse_echo_measurements(full_text)
    exam_info = parse_exam_info(full_text)
    patient_data = parse_patient_data(full_text)
    response = {**exam_content}
    if exam_info:
        response["examInfo"] = exam_info
    if patient_data and any(patient_data.values()):
        response["patientData"] = {
            "nome": patient_data.get("nome", ""),
            "responsavel": patient_data.get("responsavel", ""),
            "responsavelTelefone": patient_data.get("responsavelTelefone", ""),
            "responsavelEmail": patient_data.get("responsavelEmail", ""),
            "especie": patient_data.get("especie", ""),
            "raca": patient_data.get("raca", ""),
            "sexo": patient_data.get("sexo", ""),
            "idade": patient_data.get("idade", ""),
            "peso": patient_data.get("peso", ""),
        }
    return response


@app.get("/health")
async def health():
    return {"status": "ok", "service": "ocr"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
