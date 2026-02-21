import { serve } from "https://deno.land/std@0.190.0/http/server.ts";


const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function corsResponse(body: string | null, status: number, init?: ResponseInit): Response {
  return new Response(body, {
    ...init,
    status,
    headers: { ...corsHeaders, ...init?.headers },
  });
}

interface ExtractExamRequest {
  image_base64: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return corsResponse(null, 204);
  }

  try {
    if (req.method !== "POST") {
      return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405, {
        headers: { "Content-Type": "application/json" },
      });
    }

    const ocrServiceUrl = Deno.env.get("OCR_SERVICE_URL") ?? "http://localhost:8000";
    const isLocalhost = /^https?:\/\/localhost(\:|$)/.test(ocrServiceUrl) || ocrServiceUrl.startsWith("http://127.0.0.1");
    if (isLocalhost) {
      console.error("OCR_SERVICE_URL is localhost; set Supabase secret OCR_SERVICE_URL.");
      return corsResponse(
        JSON.stringify({
          error: "OCR service not configured",
          detail: "Set the OCR_SERVICE_URL secret in Supabase to your deployed Python OCR service URL.",
        }),
        503,
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let body: ExtractExamRequest;
    try {
      body = (await req.json()) as ExtractExamRequest;
    } catch {
      return corsResponse(
        JSON.stringify({ error: "Invalid request body", detail: "Request body must be valid JSON." }),
        400,
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const image_base64 = body?.image_base64;
    if (!image_base64 || typeof image_base64 !== "string") {
      return corsResponse(JSON.stringify({ error: "Missing image_base64 in request body" }), 400, {
        headers: { "Content-Type": "application/json" },
      });
    }

    const approxBytes = (image_base64.length * 3) / 4;
    if (approxBytes > 10 * 1024 * 1024) {
      return corsResponse(
        JSON.stringify({ error: "Image too large", detail: "Use an image under ~10MB." }),
        413,
        { headers: { "Content-Type": "application/json" } }
      );
    }

    let pythonResponse: Response;
    try {
      pythonResponse = await fetch(`${ocrServiceUrl}/ocr/extract-exam`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64 }),
      });
    } catch (networkError: unknown) {
      console.error("extract-exam: OCR service fetch failed:", networkError);
      return corsResponse(
        JSON.stringify({
          error: "OCR service unreachable",
          detail: networkError instanceof Error ? networkError.message : "Check OCR_SERVICE_URL.",
        }),
        503,
        { headers: { "Content-Type": "application/json" } }
      );
    }

    const text = await pythonResponse.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      return corsResponse(
        JSON.stringify({ error: "OCR service returned invalid response" }),
        502,
        { headers: { "Content-Type": "application/json" } }
      );
    }

    if (!pythonResponse.ok) {
      return corsResponse(
        JSON.stringify(typeof data === "object" && data !== null ? data : { error: "OCR error" }),
        pythonResponse.status,
        { headers: { "Content-Type": "application/json" } }
      );
    }

    return corsResponse(JSON.stringify(data), 200, {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error in extract-exam:", error);
    return corsResponse(
      JSON.stringify({
        error: "extract-exam failed",
        detail: error instanceof Error ? error.message : String(error),
      }),
      500,
      { headers: { "Content-Type": "application/json" } }
    );
  }
};

serve(handler);
