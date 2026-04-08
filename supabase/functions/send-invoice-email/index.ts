const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

import { createClient } from "@supabase/supabase-js";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("pl-PL", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(date));
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
  }).format(amount);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let client: SMTPClient | null = null;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const body = await req.json();
    const invoiceId = typeof body?.invoiceId === "string" ? body.invoiceId : null;

    if (!invoiceId) {
      return jsonResponse({ error: "Brak identyfikatora faktury" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("id, company_id, date, vendor, nip, gross_amount, ksef_number")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return jsonResponse({ error: "Nie znaleziono faktury" }, 404);
    }

    const { data: company, error: companyError } = await supabase
      .from("companies")
      .select("name, client_portal_email")
      .eq("id", invoice.company_id)
      .single();

    if (companyError || !company) {
      return jsonResponse({ error: "Nie znaleziono firmy" }, 404);
    }

    if (!company.client_portal_email) {
      return jsonResponse({ error: "Brak e-maila portalu klienta dla tej firmy" }, 400);
    }

    const gmailAddress = Deno.env.get("GMAIL_ADDRESS")?.trim().toLowerCase();
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD")?.replace(/\s+/g, "").trim();

    if (!gmailAddress || !gmailPassword) {
      return jsonResponse({ error: "Brak konfiguracji Gmail" }, 500);
    }

    if (!gmailAddress.endsWith("@gmail.com") && !gmailAddress.endsWith("@googlemail.com")) {
      return jsonResponse({ error: "Adres nadawcy musi być kontem Gmail" }, 500);
    }

    if (gmailPassword.length !== 16) {
      return jsonResponse({ error: "Hasło aplikacji Gmail ma nieprawidłowy format" }, 500);
    }

    const companyName = escapeHtml(company.name || "Faktura");
    const vendor = escapeHtml(invoice.vendor);
    const nip = escapeHtml(invoice.nip);
    const ksefNumber = escapeHtml(invoice.ksef_number || "—");
    const formattedDate = formatDate(invoice.date);
    const formattedAmount = formatCurrency(Number(invoice.gross_amount || 0));
    const subject = `Faktura ${invoice.ksef_number || invoice.vendor} z dnia ${formattedDate}`;

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background: #ffffff; color: #111827;">
        <h2 style="margin: 0 0 20px; color: #111827; border-bottom: 2px solid #2563eb; padding-bottom: 12px;">
          ${companyName}
        </h2>
        <p style="margin: 0 0 16px; color: #4b5563;">Przesyłamy dane faktury do portalu klienta.</p>
        <table style="width: 100%; border-collapse: collapse; margin: 20px 0; border: 1px solid #e5e7eb;">
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; font-weight: bold; color: #6b7280; width: 38%;">Kontrahent</td>
            <td style="padding: 10px;">${vendor}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #6b7280;">NIP</td>
            <td style="padding: 10px; font-family: monospace;">${nip}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; font-weight: bold; color: #6b7280;">Data wystawienia</td>
            <td style="padding: 10px;">${formattedDate}</td>
          </tr>
          <tr>
            <td style="padding: 10px; font-weight: bold; color: #6b7280;">Kwota brutto</td>
            <td style="padding: 10px; font-weight: bold; color: #2563eb;">${formattedAmount}</td>
          </tr>
          <tr style="background: #f9fafb;">
            <td style="padding: 10px; font-weight: bold; color: #6b7280;">Numer KSeF</td>
            <td style="padding: 10px; font-family: monospace;">${ksefNumber}</td>
          </tr>
        </table>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 24px; border-top: 1px solid #e5e7eb; padding-top: 12px;">
          Wiadomość wygenerowana automatycznie z systemu KSeF Archiwum.
        </p>
      </div>
    `;

    client = new SMTPClient({
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
      from: `KSeF Archiwum <${gmailAddress}>`,
      to: company.client_portal_email,
      subject,
      content: "auto",
      html: htmlBody,
    });

    return jsonResponse({ success: true });
  } catch (error) {
    console.error("Email send error:", error);

    const message = error instanceof Error ? error.message : "Błąd wysyłki e-mail";
    const normalizedMessage = message.includes("Username and Password not accepted")
      ? "Gmail odrzucił logowanie. Najczęściej oznacza to błędny adres Gmail albo hasło aplikacji. Upewnij się, że wpisane zostało dokładnie to samo konto Gmail, dla którego wygenerowano 16-znakowe hasło aplikacji, bez spacji."
      : message;

    return jsonResponse({ error: normalizedMessage }, 500);
  } finally {
    if (client) {
      try {
        await client.close();
      } catch (closeError) {
        console.error("SMTP close error:", closeError);
      }
    }
  }
});
