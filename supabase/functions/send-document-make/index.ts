import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function resolveWebhookUrl(rawUrl?: string | null): string {
  const trimmed = rawUrl?.trim();
  if (!trimmed) throw new Error("Brak URL webhooka Make w ustawieniach firmy");
  const candidate = /^[a-zA-Z][a-zA-Z\d+.-]*:\/\//.test(trimmed) ? trimmed : `https://${trimmed}`;
  return new URL(candidate).toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonResponse({ error: "Unauthorized" }, 401);

    const { documentId } = await req.json();
    if (!documentId || typeof documentId !== "string") {
      return jsonResponse({ error: "Brak identyfikatora dokumentu" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: doc, error: docErr } = await supabase
      .from("documents")
      .select("id, company_id, name, description, category, file_path, mime_type")
      .eq("id", documentId)
      .single();
    if (docErr || !doc) return jsonResponse({ error: "Nie znaleziono dokumentu" }, 404);

    const { data: company } = await supabase
      .from("companies")
      .select("name, nip, client_portal_email, make_webhook_url")
      .eq("id", doc.company_id)
      .single();

    const webhookUrl = resolveWebhookUrl(company?.make_webhook_url || Deno.env.get("MAKE_WEBHOOK_URL"));

    const { data: file, error: storageErr } = await supabase.storage
      .from("invoice-uploads")
      .download(doc.file_path);
    if (storageErr || !file) return jsonResponse({ error: "Nie udało się pobrać pliku" }, 500);

    const bytes = new Uint8Array(await file.arrayBuffer());
    const base64Data = bytesToBase64(bytes);
    const filename = doc.file_path.split("/").pop() || doc.name;
    const contentType = doc.mime_type || "application/pdf";

    const formData = new FormData();
    formData.append("document_id", doc.id);
    formData.append("document_name", doc.name);
    formData.append("description", doc.description || "");
    formData.append("category", doc.category || "");
    formData.append("company_name", company?.name || "");
    formData.append("company_nip", company?.nip || "");
    formData.append("portal_email", company?.client_portal_email || "");
    formData.append("type", "document");
    // Make Gmail attachment fields
    formData.append("filename", filename);
    formData.append("data", base64Data);
    formData.append("contentType", contentType);
    formData.append("file", new File([bytes], filename, { type: contentType }), filename);
    formData.append("attachment", new File([bytes], filename, { type: contentType }), filename);

    const res = await fetch(webhookUrl, { method: "POST", body: formData });
    if (!res.ok) {
      const text = await res.text();
      return jsonResponse({ error: `Make webhook error [${res.status}]: ${text}` }, 502);
    }
    await res.text();

    await supabase
      .from("documents")
      .update({ sent_to_portal_at: new Date().toISOString(), sent_to_portal_by: user.id })
      .eq("id", documentId);

    return jsonResponse({ success: true });
  } catch (err) {
    console.error("send-document-make error:", err);
    return jsonResponse({ error: err instanceof Error ? err.message : "Błąd" }, 500);
  }
});
