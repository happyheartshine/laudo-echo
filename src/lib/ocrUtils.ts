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
    if (res.status === 401) {
      return "Acesso não autorizado (401). Faça login novamente ou, se o erro continuar, o administrador precisa implantar a função com verificação JWT desativada.";
    }
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
    const parsed: OcrPatientInfo = {
      nome: (d.nome as string) ?? "",
      responsavel: (d.responsavel as string) ?? "",
      responsavelTelefone: (d.responsavelTelefone as string) ?? "",
      responsavelEmail: (d.responsavelEmail as string) ?? "",
      especie: (d.especie as string) ?? "",
      raca: (d.raca as string) ?? "",
      sexo: (d.sexo as string) ?? "",
      idade: (d.idade as string) ?? "",
      peso: (d.peso as string) ?? "",
    };

    // Output OCR analysis results for verification (browser DevTools → Console)
    console.log("[OCR] Raw API response:", data);
    console.log("[OCR] Parsed patient data (used to fill form):", parsed);
    console.table(
      Object.entries(parsed).map(([key, value]) => ({ field: key, value: value || "(vazio)" }))
    );

    return { ok: true, data: parsed };
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

/** Exam metadata extracted from image (date, heart rate). */
export interface ExtractedExamInfo {
  data?: string;
  frequenciaCardiaca?: string;
}

/** Content shape returned by extract-exam (matches DadosExame content for merge). */
export interface ExtractedExamContent {
  measurementsData?: Record<string, string>;
  funcaoDiastolica?: Record<string, string>;
  funcaoSistolica?: Record<string, string>;
  ventriculoDireito?: Record<string, string>;
  tdiLivre?: Record<string, string>;
  tdiSeptal?: Record<string, string>;
  valvasDoppler?: Record<string, string>;
  valvesData?: Record<string, string>;
  achados?: string;
  conclusoes?: string;
  /** Optional: fill exam date and heart rate from image. */
  examInfo?: ExtractedExamInfo;
  /** Optional: fill patient fields from same image (one-shot fill). */
  patientData?: OcrPatientInfo;
}

export type ExtractExamResult =
  | { ok: true; data: ExtractedExamContent }
  | { ok: false; error: string };

/** Merge two extracted exam contents (later fills missing keys; first non-empty for strings). */
export function mergeExtractedExamContent(
  a: ExtractedExamContent,
  b: ExtractedExamContent
): ExtractedExamContent {
  const mergeRecord = (
    x?: Record<string, string> | null,
    y?: Record<string, string> | null
  ): Record<string, string> | undefined => {
    const out = { ...(x || {}), ...(y || {}) };
    const filtered = Object.fromEntries(
      Object.entries(out).filter(([, v]) => v != null && String(v).trim() !== "")
    );
    return Object.keys(filtered).length ? filtered : undefined;
  };
  const mergeExamInfo = (
    x?: ExtractedExamInfo | null,
    y?: ExtractedExamInfo | null
  ): ExtractedExamInfo | undefined => {
    if (!x && !y) return undefined;
    const data = (x?.data?.trim() || y?.data?.trim()) || undefined;
    const frequenciaCardiaca =
      (x?.frequenciaCardiaca?.trim() || y?.frequenciaCardiaca?.trim()) || undefined;
    return data || frequenciaCardiaca ? { data, frequenciaCardiaca } : undefined;
  };
  const mergePatient = (
    x?: OcrPatientInfo | null,
    y?: OcrPatientInfo | null
  ): OcrPatientInfo | undefined => {
    if (!x && !y) return undefined;
    const p = { ...(x || {}), ...(y || {}) } as OcrPatientInfo;
    const hasAny = Object.values(p).some((v) => v != null && String(v).trim() !== "");
    return hasAny ? p : undefined;
  };
  return {
    measurementsData: mergeRecord(a.measurementsData, b.measurementsData),
    funcaoDiastolica: mergeRecord(a.funcaoDiastolica, b.funcaoDiastolica),
    funcaoSistolica: mergeRecord(a.funcaoSistolica, b.funcaoSistolica),
    ventriculoDireito: mergeRecord(a.ventriculoDireito, b.ventriculoDireito),
    tdiLivre: mergeRecord(a.tdiLivre, b.tdiLivre),
    tdiSeptal: mergeRecord(a.tdiSeptal, b.tdiSeptal),
    valvasDoppler: mergeRecord(a.valvasDoppler, b.valvasDoppler),
    valvesData: mergeRecord(a.valvesData, b.valvesData),
    achados: (a.achados?.trim() || b.achados?.trim()) || undefined,
    conclusoes: (a.conclusoes?.trim() || b.conclusoes?.trim()) || undefined,
    examInfo: mergeExamInfo(a.examInfo, b.examInfo),
    patientData: mergePatient(a.patientData, b.patientData),
  };
}

/**
 * Extract full exam data (measurements, valves, achados, conclusoes) from a report image.
 * Send image as base64. Use for "Preencher a partir da imagem" on DadosExame.
 */
export async function extractExamFromImage(imageBase64: string): Promise<ExtractExamResult> {
  try {
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return { ok: false, error: "Imagem inválida." };
    }

    const { data, error } = await supabase.functions.invoke("extract-exam", {
      body: { image_base64: imageBase64 },
    });

    if (error) {
      const message = await getOcrErrorDetail(error);
      console.error("extract-exam error:", message, error);
      return { ok: false, error: message };
    }

    if (!data || typeof data !== "object") {
      return { ok: false, error: "Resposta inválida do serviço." };
    }

    console.log("[OCR] Extract exam result:", data);
    return { ok: true, data: data as ExtractedExamContent };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Não foi possível extrair dados do exame.";
    console.error("extractExamFromImage failed:", err);
    return { ok: false, error: message };
  }
}
