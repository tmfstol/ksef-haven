const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { recipientEmail, subject, invoiceData, companyName } = await req.json();

    if (!recipientEmail || !subject || !invoiceData) {
      return new Response(JSON.stringify({ error: "Brak wymaganych danych" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const gmailAddress = Deno.env.get("GMAIL_ADDRESS");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailAddress || !gmailPassword) {
      return new Response(JSON.stringify({ error: "Brak konfiguracji Gmail" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #4f46e5; padding-bottom: 10px;">
          ${companyName || "Faktura"}
        </h2>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; color: #666;">Kontrahent:</td>
            <td style="padding: 10px;">${invoiceData.vendor}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #666;">NIP:</td>
            <td style="padding: 10px; font-family: monospace;">${invoiceData.nip}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; color: #666;">Data wystawienia:</td>
            <td style="padding: 10px;">${invoiceData.date}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #666;">Kwota brutto:</td>
            <td style="padding: 10px; font-weight: bold; color: #4f46e5;">${invoiceData.grossAmount}</td>
          </tr>
          <tr style="background: #f8f9fa;">
            <td style="padding: 10px; font-weight: bold; color: #666;">Numer KSeF:</td>
            <td style="padding: 10px; font-family: monospace;">${invoiceData.ksefNumber || "—"}</td>
          </tr>
        </table>
        <p style="color: #999; font-size: 12px; margin-top: 30px; border-top: 1px solid #eee; padding-top: 10px;">
          Wiadomość wygenerowana automatycznie z systemu KSeF Archiwum.
        </p>
      </div>
    `;

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: {
          username: gmailAddress,
          password: gmailPassword,
        },
      },
    });

    await client.send({
      from: gmailAddress,
      to: recipientEmail,
      subject: subject,
      content: "auto",
      html: htmlBody,
    });

    await client.close();

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Email send error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Błąd wysyłki e-mail" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
