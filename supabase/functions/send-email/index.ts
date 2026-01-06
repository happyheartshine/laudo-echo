import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface SendEmailRequest {
  email: string;
  patientName: string;
  pdfBase64: string;
  senderName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, patientName, pdfBase64, senderName }: SendEmailRequest = await req.json();

    console.log("=== SEND EMAIL REQUEST ===");
    console.log("To:", email);
    console.log("Patient:", patientName);
    console.log("PDF Base64 length:", pdfBase64?.length || 0);
    console.log("Sender:", senderName);

    if (!email || !patientName || !pdfBase64) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, patientName, pdfBase64" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Sanitize patient name for filename
    const safePatientName = patientName
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9]/g, "_")
      .toLowerCase();

    // Convert base64 to Buffer for attachment
    const pdfBuffer = Uint8Array.from(atob(pdfBase64), c => c.charCodeAt(0));

    const emailResponse = await resend.emails.send({
      from: "VitaeCor <onboarding@resend.dev>",
      to: [email],
      subject: `Laudo Veterinário - ${patientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">Laudo Ecocardiográfico</h2>
          <p>Olá,</p>
          <p>Segue em anexo o laudo ecocardiográfico do paciente <strong>${patientName}</strong>.</p>
          <p>Atenciosamente,<br><strong>${senderName || "Equipe Veterinária"}</strong></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #999;">
            Este email foi enviado automaticamente pelo sistema VitaeCor.
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `laudo_${safePatientName}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    console.log("Email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error in send-email function:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
