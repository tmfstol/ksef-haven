import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const KSEF_URLS: Record<string, string> = {
  prod: "https://api.ksef.mf.gov.pl",
  test: "https://api-test.ksef.mf.gov.pl",
  demo: "https://api-demo.ksef.mf.gov.pl",
};

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function extractSpkiFromCert(certDer: Uint8Array): Uint8Array {
  const rsaOid = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
  for (let i = 0; i < certDer.length - rsaOid.length; i++) {
    let found = true;
    for (let j = 0; j < rsaOid.length; j++) {
      if (certDer[i + j] !== rsaOid[j]) { found = false; break; }
    }
    if (!found) continue;
    for (let back = 2; back < 10; back++) {
      const seqStart = i - back;
      if (seqStart < 0) continue;
      if (certDer[seqStart] !== 0x30) continue;
      let pos = seqStart + 1;
      let len = certDer[pos]; pos++;
      if (len & 0x80) {
        const numBytes = len & 0x7f;
        len = 0;
        for (let k = 0; k < numBytes; k++) {
          len = (len << 8) | certDer[pos]; pos++;
        }
      }
      const totalLen = pos - seqStart + len;
      if (totalLen >= 200 && totalLen <= 1000) {
        return certDer.slice(seqStart, seqStart + totalLen);
      }
    }
  }
  throw new Error("Could not find RSA SPKI in certificate");
}

async function importRsaPublicKey(pemOrBase64: string): Promise<CryptoKey> {
  const b64 = pemOrBase64
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  try {
    return await crypto.subtle.importKey("spki", bytes.buffer, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  } catch {
    const spki = extractSpkiFromCert(bytes);
    const buf = new ArrayBuffer(spki.length);
    new Uint8Array(buf).set(spki);
    return crypto.subtle.importKey("spki", buf, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]);
  }
}

async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

async function authenticate(baseUrl: string, nip: string, ksefToken: string) {
  // Challenge
  const challengeRes = await fetchWithRetry(`${baseUrl}/api/v2/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ contextIdentifier: { type: "Nip", value: nip } }),
  });
  const challengeText = await challengeRes.text();
  if (!challengeRes.ok) throw new Error(`Challenge failed: ${challengeText}`);
  const challengeData = JSON.parse(challengeText);
  const challenge = challengeData.challenge;
  const challengeTimestamp = challengeData.timestampMs
    ? parseInt(challengeData.timestampMs)
    : challengeData.timestamp
    ? Math.floor(new Date(challengeData.timestamp).getTime())
    : Date.now();

  // Public key
  const pkRes = await fetchWithRetry(`${baseUrl}/api/v2/security/public-key-certificates`, {
    headers: { Accept: "application/json" },
  });
  const pkText = await pkRes.text();
  if (!pkRes.ok) throw new Error(`Public key failed: ${pkText.substring(0, 200)}`);
  const pkJson = JSON.parse(pkText);
  const certs = pkJson.certificates || pkJson.items || pkJson;
  let pem = "";
  if (Array.isArray(certs)) {
    for (const cert of certs) {
      if (Array.isArray(cert.usage) && cert.usage.includes("KsefTokenEncryption")) {
        pem = cert.certificate || cert.publicKey || cert.pem || cert.value || "";
        break;
      }
    }
    if (!pem && certs.length > 0) {
      pem = certs[0].certificate || certs[0].publicKey || certs[0].pem || certs[0].value || "";
    }
  }
  if (!pem) throw new Error("No usable certificate");

  // Encrypt token
  const plaintext = `${ksefToken}|${challengeTimestamp}`;
  const encoder = new TextEncoder();
  const cryptoKey = await importRsaPublicKey(pem);
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cryptoKey, encoder.encode(plaintext));
  const encryptedToken = toBase64(new Uint8Array(encrypted));

  // Auth
  const authRes = await fetchWithRetry(`${baseUrl}/api/v2/auth/ksef-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ encryptedToken, challenge, contextIdentifier: { type: "Nip", value: nip } }),
  });
  const authText = await authRes.text();
  if (!authRes.ok) throw new Error(`Auth failed: ${authText}`);
  const authResult = JSON.parse(authText);
  const authToken = authResult?.authenticationToken?.token || authResult?.authenticationToken;
  const refNumber = authResult?.referenceNumber;
  if (!authToken) throw new Error("No authToken received");

  // Poll
  for (let i = 0; i < 10; i++) {
    const statusRes = await fetchWithRetry(`${baseUrl}/api/v2/auth/${refNumber}`, {
      headers: { Authorization: `Bearer ${authToken}`, Accept: "application/json" },
    });
    const statusText = await statusRes.text();
    if (!statusRes.ok) throw new Error(`Auth poll failed: ${statusText}`);
    const statusData = JSON.parse(statusText);
    const code = statusData?.status?.code || statusData?.processingCode;
    if (code === 200 || code === "200") break;
    if (code !== 100 && code !== "100") throw new Error(`Auth failed: ${code}`);
    await new Promise(r => setTimeout(r, 2000));
  }

  // Redeem
  const redeemRes = await fetchWithRetry(`${baseUrl}/api/v2/auth/token/redeem`, {
    method: "POST",
    headers: { Authorization: `Bearer ${authToken}`, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const redeemText = (await redeemRes.text()).replace(/^\uFEFF/, "").trim();
  if (!redeemRes.ok) throw new Error(`Redeem failed: ${redeemText.substring(0, 300)}`);
  const redeemData = JSON.parse(redeemText);
  const at = redeemData.accessToken;
  return typeof at === "object" && at?.token ? at.token : at;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { invoice_id, ksef_env = "prod", format = "xml" } = body;

    if (!invoice_id) {
      return new Response(JSON.stringify({ error: "Brak invoice_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get invoice and company data
    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("ksef_number, company_id")
      .eq("id", invoice_id)
      .single();

    if (invErr || !invoice) {
      return new Response(JSON.stringify({ error: "Faktura nie znaleziona" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!invoice.ksef_number) {
      return new Response(JSON.stringify({ error: "Faktura nie ma numeru KSeF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: company, error: compErr } = await supabase
      .from("companies")
      .select("nip, ksef_token")
      .eq("id", invoice.company_id)
      .single();

    if (compErr || !company || !company.ksef_token) {
      return new Response(JSON.stringify({ error: "Firma nie znaleziona lub brak tokenu KSeF" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = KSEF_URLS[ksef_env] || KSEF_URLS.prod;

    // Authenticate
    console.log(`[ksef-download] Authenticating for NIP ${company.nip}`);
    const accessToken = await authenticate(baseUrl, company.nip, company.ksef_token.trim());

    // Fetch invoice XML
    console.log(`[ksef-download] Fetching invoice ${invoice.ksef_number}`);
    const invoiceRes = await fetchWithRetry(`${baseUrl}/api/v2/invoices/ksef/${invoice.ksef_number}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/octet-stream, application/json",
      },
    });

    if (!invoiceRes.ok) {
      const errText = await invoiceRes.text();
      throw new Error(`Fetch invoice failed (${invoiceRes.status}): ${errText.substring(0, 300)}`);
    }

    const xml = await invoiceRes.text();
    console.log(`[ksef-download] Got XML (${xml.length} chars)`);

    return new Response(JSON.stringify({ xml, ksef_number: invoice.ksef_number }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[ksef-download] Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Nieznany błąd" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
