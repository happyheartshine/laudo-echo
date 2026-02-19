# OCR Service (Laudo Echo)

Python service that extracts patient data from images (scanned forms, photos) using EasyOCR. Used to auto-fill the patient form when users upload JPG/PNG instead of DICOM.

## Setup

### 1. Create virtual environment and install dependencies

```bash
cd ocr-service
python -m venv venv
# Windows:
venv\Scripts\activate
# macOS/Linux:
source venv/bin/activate

pip install -r requirements.txt
```

### 2. Run the service

```bash
python main.py
```

Service runs at **http://localhost:8000**.

- Health: `GET http://localhost:8000/health`
- Extract from image: `POST http://localhost:8000/ocr/extract-json` with body `{ "image_base64": "<base64 string>" }`

## Supabase Edge Function

The frontend calls the **Supabase Edge Function** `extract-ocr`, which proxies to this Python service. Set the Python service URL in Supabase:

```bash
supabase secrets set OCR_SERVICE_URL=http://localhost:8000
```

**Deploy the Edge Function with JWT verification disabled** (required so image uploads can call OCR without 401):

```bash
supabase functions deploy extract-ocr --no-verify-jwt
```

If you already deployed the function and get **401 Unauthorized** when uploading images, redeploy with the flag above. (Config in `supabase/config.toml` can be ignored on updates; the CLI flag ensures the setting is applied.)

For production, deploy this Python service (e.g. Railway, Render, or a VM) and set the secret in your Supabase project:

```bash
supabase secrets set OCR_SERVICE_URL=https://your-ocr-service.example.com
```

**If you get 500 from the Edge Function:** The function runs on Supabase’s servers and cannot reach `localhost`. Set `OCR_SERVICE_URL` to a publicly reachable URL where this Python service is running (e.g. a deployed instance). Until then, the app will show a clear “OCR service not configured” message when uploading images.

## Flow

1. User uploads JPG/PNG on **Novo Exame** (e.g. scanned form).
2. Frontend sends image as base64 to Supabase Edge Function `extract-ocr`.
3. Edge Function forwards to this Python service `/ocr/extract-json`.
4. Python runs EasyOCR, parses text for patient fields, returns JSON.
5. Frontend receives result and auto-fills the patient form (same as DICOM).

## Response shape

Same as DICOM metadata for compatibility:

- `nome`, `responsavel`, `responsavelTelefone`, `responsavelEmail`
- `especie`, `raca`, `sexo`, `idade`, `peso`
