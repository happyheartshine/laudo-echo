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
  pdfUrl: string; // Changed from pdfBase64 to pdfUrl
  senderName?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, patientName, pdfUrl, senderName }: SendEmailRequest = await req.json();

    console.log("=== SEND EMAIL REQUEST ===");
    console.log("To:", email);
    console.log("Patient:", patientName);
    console.log("PDF URL:", pdfUrl);
    console.log("Sender:", senderName);

    if (!email || !patientName || !pdfUrl) {
      console.error("Missing required fields");
      return new Response(
        JSON.stringify({ error: "Missing required fields: email, patientName, pdfUrl" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const emailResponse = await resend.emails.send({
      from: "VitaeCor <onboarding@resend.dev>",
      to: [email],
      subject: `Laudo Veterinário - ${patientName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1a2a52;">Laudo Ecocardiográfico</h2>
          <p>Olá,</p>
          <p>Segue o laudo ecocardiográfico do paciente <strong>${patientName}</strong>.</p>
          <p style="margin: 24px 0;">
            <a href="${pdfUrl}" 
               style="background-color: #1a2a52; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
              📄 Baixar Laudo em PDF
            </a>
          </p>
          <p style="font-size: 12px; color: #666;">
            O link acima é válido por 7 dias. Após esse período, solicite um novo envio.
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p>Atenciosamente,<br><strong>${senderName || "Equipe Veterinária"}</strong></p>
          <p style="font-size: 11px; color: #999;">
            Este email foi enviado automaticamente pelo sistema VitaeCor.
          </p>
        </div>
      `,
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
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
