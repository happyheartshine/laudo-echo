import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const OCR_SERVICE_URL = Deno.env.get("OCR_SERVICE_URL") ?? "http://localhost:8000";
const isLocalhost = /^https?:\/\/localhost(\:|$)/.test(OCR_SERVICE_URL) || OCR_SERVICE_URL.startsWith("http://127.0.0.1");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ExtractOcrRequest {
  image_base64: string;
}

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

const safeJsonResponse = (body: Record<string, unknown>, status: number): Response => {
  try {
    return jsonResponse(body, status);
  } catch (e) {
    return new Response(
      `{"error":"OCR request failed","detail":"${String(e).replace(/"/g, '\\"')}"}`,
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return safeJsonResponse({ error: "Method not allowed" }, 405);
    }

    if (isLocalhost) {
      console.error("OCR_SERVICE_URL is localhost; set Supabase secret OCR_SERVICE_URL.");
      return safeJsonResponse({
        error: "OCR service not configured",
        detail: "Set the OCR_SERVICE_URL secret in Supabase to your deployed Python OCR service URL.",
      }, 503);
    }

    let body: ExtractOcrRequest;
    try {
      body = (await req.json()) as ExtractOcrRequest;
    } catch (parseErr) {
      console.error("Request body parse failed:", parseErr);
      return safeJsonResponse({
        error: "Invalid request body",
        detail: parseErr instanceof Error ? parseErr.message : "Request body must be valid JSON.",
      }, 400);
    }

    const image_base64 = body?.image_base64;
    if (!image_base64 || typeof image_base64 !== "string") {
      return safeJsonResponse({ error: "Missing image_base64 in request body" }, 400);
    }

    // Avoid forwarding huge payloads that can cause timeouts/OOM (e.g. > 10MB base64)
    const approxBytes = (image_base64.length * 3) / 4;
    if (approxBytes > 10 * 1024 * 1024) {
      return safeJsonResponse({
        error: "Image too large",
        detail: "Use an image under ~10MB for OCR.",
      }, 413);
    }

    let pythonResponse: Response;
    try {
      pythonResponse = await fetch(`${OCR_SERVICE_URL}/ocr/extract-json`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image_base64 }),
      });
    } catch (networkError: unknown) {
      console.error("OCR service fetch failed:", networkError);
      return safeJsonResponse({
        error: "OCR service unreachable",
        detail: networkError instanceof Error ? networkError.message : "Check OCR_SERVICE_URL and that the service is running.",
      }, 503);
    }

    let data: unknown;
    try {
      const text = await pythonResponse.text();
      data = text ? (JSON.parse(text) as unknown) : {};
    } catch {
      console.error("OCR service returned non-JSON");
      return safeJsonResponse({
        error: "OCR service returned invalid response",
        detail: "The OCR service did not return valid JSON.",
      }, 502);
    }

    if (!pythonResponse.ok) {
      return safeJsonResponse(
        typeof data === "object" && data !== null && "error" in (data as object)
          ? (data as { error: string })
          : { error: "OCR service error", detail: data },
        pythonResponse.status
      );
    }

    return safeJsonResponse(data as Record<string, unknown>, 200);
  } catch (error: unknown) {
    console.error("Error in extract-ocr function:", error);
    return safeJsonResponse({
      error: "OCR request failed",
      detail: error instanceof Error ? error.message : String(error),
    }, 500);
  }
};

serve((req) => handler(req).catch((err) => {
  console.error("Unhandled error in extract-ocr:", err);
  return safeJsonResponse({
    error: "OCR request failed",
    detail: err instanceof Error ? err.message : String(err),
  }, 500);
}));
