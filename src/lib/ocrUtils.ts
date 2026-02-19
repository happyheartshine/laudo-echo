import { supabase } from "@/integrations/supabase/client";
import { FunctionsFetchError, FunctionsHttpError } from "@supabase/supabase-js";
import type { DicomPatientInfo } from "./dicomUtils";

/** Result of OCR extraction: success with data, or failure with a message for the UI. */
export type OcrResult =
  | { ok: true; data: OcrPatientInfo }
  | { ok: false; error: string };

async function getOcrErrorDetail(error: unknown): Promise<string> {
  if (error instanceof FunctionsFetchError) {
    return "Erro de conexão com o servidor. Verifique sua internet, desative VPN/proxy se estiver usando, e tente novamente.";
  }
  if (error instanceof FunctionsHttpError && error.context) {
    const res = error.context as Response;
    try {
      const text = await res.text();
      const trimmed = text.trimStart();
      if (trimmed.startsWith("{")) {
        const body = JSON.parse(text) as { error?: string; detail?: string };
        if (body?.detail) return body.detail;
        if (body?.error) return body.error;
      }
      if (text && !trimmed.startsWith("<")) return text.slice(0, 200);
    } catch {
      // Body may be HTML or invalid; avoid "Unexpected token '<'" by not parsing
    }
  }
  let msg = error instanceof Error ? error.message : "OCR indisponível.";
  if (/Unexpected token|is not valid JSON|<!DOCTYPE/i.test(msg) || msg.includes("<!DOCTYPE")) {
    msg = "Servidor retornou erro. Tente novamente.";
  }
  return msg;
}

/**
 * Patient info returned by OCR (same shape as form + optional phone/email).
 * Compatible with DicomPatientInfo for auto-fill callback.
 */
export interface OcrPatientInfo extends DicomPatientInfo {
  responsavelTelefone?: string;
  responsavelEmail?: string;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(",")[1];
      if (base64) resolve(base64);
      else reject(new Error("Failed to read file as base64"));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

/**
 * Extract patient data from an image using the Python OCR service via Supabase Edge Function.
 * Use for JPG/PNG (e.g. scanned forms). Returns same shape as DICOM metadata for auto-fill.
 * On failure returns { ok: false, error } with a message (e.g. "OCR service not configured").
 */
export async function extractOcrFromImage(file: File): Promise<OcrResult> {
  try {
    const image_base64 = await fileToBase64(file);

    const { data, error } = await supabase.functions.invoke("extract-ocr", {
      body: { image_base64 },
    });

    if (error) {
      const message = await getOcrErrorDetail(error);
      console.error("OCR Edge Function error:", message, error);
      return { ok: false, error: message };
    }

    if (!data || typeof data !== "object") {
      console.error("OCR returned invalid data:", data);
      return { ok: false, error: "Resposta inválida do serviço de OCR." };
    }

    const d = data as Record<string, unknown>;
    return {
      ok: true,
      data: {
        nome: (d.nome as string) ?? "",
        responsavel: (d.responsavel as string) ?? "",
        responsavelTelefone: (d.responsavelTelefone as string) ?? "",
        responsavelEmail: (d.responsavelEmail as string) ?? "",
        especie: (d.especie as string) ?? "",
        raca: (d.raca as string) ?? "",
        sexo: (d.sexo as string) ?? "",
        idade: (d.idade as string) ?? "",
        peso: (d.peso as string) ?? "",
      },
    };
  } catch (err) {
    let message = err instanceof Error ? err.message : "OCR indisponível.";
    if (
      /Unexpected token|is not valid JSON|<!DOCTYPE/i.test(message) ||
      message.includes("<!DOCTYPE")
    ) {
      message = "Servidor retornou erro. Tente novamente em alguns instantes.";
    }
    console.error("OCR extraction failed:", err);
    return { ok: false, error: message };
  }
}
