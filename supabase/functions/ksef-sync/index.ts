import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// KSeF API 2.0 base URLs
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

async function importRsaPublicKey(pem: string): Promise<CryptoKey> {
  const pemContents = pem
    .replace(/-----BEGIN PUBLIC KEY-----/, "")
    .replace(/-----END PUBLIC KEY-----/, "")
    .replace(/\s/g, "");
  const binaryString = atob(pemContents);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return crypto.subtle.importKey(
    "spki",
    bytes.buffer,
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"]
  );
}

// Retry wrapper for fetch with exponential backoff
async function fetchWithRetry(url: string, options: RequestInit, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(url, options);
      return res;
    } catch (err) {
      if (i === retries - 1) throw err;
      console.log(`[ksef-sync] Retry ${i + 1}/${retries} for ${url}`);
      await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
    }
  }
  throw new Error("Unreachable");
}

// === KSeF v2 Auth Flow ===

// Step 1: Get auth challenge
async function getChallenge(baseUrl: string, nip: string) {
  console.log(`[ksef-sync] POST ${baseUrl}/api/v2/auth/challenge`);
  const res = await fetchWithRetry(`${baseUrl}/api/v2/auth/challenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      contextIdentifier: { type: "onip", identifier: nip },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Challenge failed (${res.status}): ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Challenge response not JSON: ${text.substring(0, 200)}`);
  }
}

// Step 2: Get KSeF public RSA key
async function getPublicKey(baseUrl: string): Promise<string> {
  // Try known endpoints
  const endpoints = [
    `${baseUrl}/api/v2/auth/public-key/rsa`,
    `${baseUrl}/api/v2/online/Session/Key/RSA`,
  ];

  for (const url of endpoints) {
    console.log(`[ksef-sync] Trying public key: ${url}`);
    try {
      const res = await fetchWithRetry(url, {
        headers: { Accept: "application/json, application/octet-stream, text/plain" },
      });
      if (!res.ok) {
        const t = await res.text();
        console.log(`[ksef-sync] Public key ${url} returned ${res.status}: ${t.substring(0, 100)}`);
        continue;
      }
      const text = await res.text();
      if (text.includes("BEGIN PUBLIC KEY")) return text;
      try {
        const json = JSON.parse(text);
        if (json.key) return json.key;
        if (json.publicKey) return json.publicKey;
        if (json.rsaPublicKey) return json.rsaPublicKey;
        // If the JSON has a base64 encoded key
        if (json.value) return json.value;
        console.log(`[ksef-sync] Public key JSON keys: ${Object.keys(json).join(", ")}`);
        // Return the first string value that looks like a key
        for (const v of Object.values(json)) {
          if (typeof v === "string" && v.length > 100) return v;
        }
      } catch { /* not json, use raw text */ }
      if (text.length > 100) return text;
    } catch (err) {
      console.log(`[ksef-sync] Public key ${url} error: ${err}`);
    }
  }
  throw new Error("Could not fetch KSeF RSA public key from any endpoint");
}

// Step 3: Encrypt token with RSA-OAEP
async function encryptToken(token: string, publicKeyPem: string): Promise<string> {
  const timestamp = Date.now();
  const plaintext = `${token}|${timestamp}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);

  const cryptoKey = await importRsaPublicKey(publicKeyPem);
  const encrypted = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, cryptoKey, data);
  return toBase64(new Uint8Array(encrypted));
}

// Step 4: Authenticate with KSeF token
async function authWithKsefToken(
  baseUrl: string,
  nip: string,
  encryptedToken: string,
  challenge: string
) {
  console.log(`[ksef-sync] POST ${baseUrl}/api/v2/auth/ksef-token`);
  const res = await fetchWithRetry(`${baseUrl}/api/v2/auth/ksef-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      encryptedToken,
      challenge,
      contextIdentifier: { type: "onip", identifier: nip },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Auth ksef-token failed (${res.status}): ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Auth response not JSON: ${text.substring(0, 200)}`);
  }
}

// Step 5: Poll auth status until ready
async function pollAuthStatus(
  baseUrl: string,
  referenceNumber: string,
  authToken: string,
  maxAttempts = 10
) {
  for (let i = 0; i < maxAttempts; i++) {
    console.log(`[ksef-sync] Polling auth status attempt ${i + 1}/${maxAttempts}`);
    const res = await fetchWithRetry(`${baseUrl}/api/v2/auth/${referenceNumber}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        Accept: "application/json",
      },
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Auth status check failed (${res.status}): ${text}`);

    try {
      const data = JSON.parse(text);
      const statusCode = data?.status?.code || data?.processingCode;
      console.log(`[ksef-sync] Auth status code: ${statusCode}`);
      if (statusCode === 200 || statusCode === "200") return data;
      if (statusCode !== 100 && statusCode !== "100") {
        throw new Error(`Auth failed with status ${statusCode}: ${text}`);
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith("Auth failed")) throw e;
      throw new Error(`Auth status not JSON: ${text.substring(0, 200)}`);
    }

    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error("Auth polling timed out after max attempts");
}

// Step 6: Redeem access token
async function redeemToken(baseUrl: string, authToken: string) {
  console.log(`[ksef-sync] POST ${baseUrl}/api/v2/auth/token/redeem`);
  const res = await fetchWithRetry(`${baseUrl}/api/v2/auth/token/redeem`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${authToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({}),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Token redeem failed (${res.status}): ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Token redeem not JSON: ${text.substring(0, 200)}`);
  }
}

// Step 7: Query invoices using accessToken
async function queryInvoices(baseUrl: string, accessToken: string, nip: string) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  console.log(`[ksef-sync] POST ${baseUrl}/api/v2/invoices/query`);
  const res = await fetchWithRetry(`${baseUrl}/api/v2/invoices/query`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      queryCriteria: {
        subjectType: "subject1",
        type: "incremental",
        acquisitionTimestampThresholdFrom: threeMonthsAgo.toISOString(),
        acquisitionTimestampThresholdTo: now.toISOString(),
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Invoice query failed (${res.status}): ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Invoice query not JSON: ${text.substring(0, 200)}`);
  }
}

// Alternative: Try v1-style sync query if v2 doesn't work
async function queryInvoicesV1(baseUrl: string, sessionToken: string) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const url = `${baseUrl}/api/online/Query/Invoice/Sync?PageSize=100&PageOffset=0`;
  console.log(`[ksef-sync] POST ${url}`);
  const res = await fetchWithRetry(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      SessionToken: sessionToken,
    },
    body: JSON.stringify({
      queryCriteria: {
        subjectType: "subject1",
        type: "incremental",
        acquisitionTimestampThresholdFrom: threeMonthsAgo.toISOString(),
        acquisitionTimestampThresholdTo: now.toISOString(),
      },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`V1 query failed (${res.status}): ${text}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`V1 query not JSON: ${text.substring(0, 200)}`);
  }
}

// Get single invoice
async function getInvoice(baseUrl: string, accessToken: string, ksefNumber: string) {
  const res = await fetchWithRetry(`${baseUrl}/api/v2/invoices/${ksefNumber}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/octet-stream, application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get invoice ${ksefNumber} failed (${res.status}): ${text}`);
  }
  return await res.text();
}

// Parse invoice XML to extract key fields
function parseInvoiceXml(xml: string) {
  const getTag = (tag: string) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<`, "i"));
    return match ? match[1].trim() : null;
  };
  const getAmount = (tag: string) => {
    const val = getTag(tag);
    return val ? parseFloat(val) : 0;
  };

  const vendor = getTag("Nazwa") || "Nieznany kontrahent";
  const nip = getTag("NrNIP") || getTag("NIP") || "";
  const date = getTag("P_1") || getTag("DataWystawienia") || new Date().toISOString().split("T")[0];
  const grossAmount = getAmount("P_15") || getAmount("KwotaBrutto") || 0;

  return { vendor, nip, date, grossAmount };
}

// Main sync for single company
async function syncCompany(
  supabase: ReturnType<typeof createClient>,
  company: { id: string; nip: string; ksef_token: string },
  ksefEnv: string
) {
  const baseUrl = KSEF_URLS[ksefEnv] || KSEF_URLS.prod;

  // Extract the raw token - the stored value may include metadata like "token|nip-xxx|hash"
  // The actual KSeF auth token is the first part before the first pipe
  const rawToken = company.ksef_token.split("|")[0].trim();
  console.log(`[ksef-sync] Using KSeF env: ${ksefEnv}, base: ${baseUrl}`);
  console.log(`[ksef-sync] Token prefix: ${rawToken.substring(0, 20)}...`);

  // Step 1: Get challenge
  console.log(`[ksef-sync] Step 1: Getting challenge for NIP: ${company.nip}`);
  const challengeData = await getChallenge(baseUrl, company.nip);
  const challenge = challengeData.challenge;
  console.log(`[ksef-sync] Got challenge: ${challenge?.substring(0, 20)}...`);

  // Step 2: Get public key
  console.log(`[ksef-sync] Step 2: Getting RSA public key`);
  const publicKeyPem = await getPublicKey(baseUrl);
  console.log(`[ksef-sync] Got public key (${publicKeyPem.length} chars)`);

  // Step 3: Encrypt token
  console.log(`[ksef-sync] Step 3: Encrypting token`);
  // Use full token for encryption (token|timestamp format is handled by encryptToken)
  const encryptedToken = await encryptToken(company.ksef_token, publicKeyPem);

  // Step 4: Authenticate
  console.log(`[ksef-sync] Step 4: Authenticating with KSeF token`);
  const authResult = await authWithKsefToken(baseUrl, company.nip, encryptedToken, challenge);
  const authToken = authResult?.authenticationToken?.token || authResult?.authenticationToken;
  const refNumber = authResult?.referenceNumber;

  if (!authToken) {
    throw new Error(`No authenticationToken received. Response: ${JSON.stringify(authResult).substring(0, 300)}`);
  }
  console.log(`[ksef-sync] Got authToken, refNumber: ${refNumber}`);

  // Step 5: Poll until auth is complete
  console.log(`[ksef-sync] Step 5: Polling auth status`);
  await pollAuthStatus(baseUrl, refNumber, authToken);

  // Step 6: Redeem access token
  console.log(`[ksef-sync] Step 6: Redeeming access token`);
  const tokenData = await redeemToken(baseUrl, authToken);
  const accessToken = tokenData?.accessToken || tokenData?.token;

  if (!accessToken) {
    throw new Error(`No accessToken received. Response: ${JSON.stringify(tokenData).substring(0, 300)}`);
  }
  console.log(`[ksef-sync] Got accessToken`);

  // Step 7: Query invoices
  console.log(`[ksef-sync] Step 7: Querying invoices`);
  let queryResult;
  try {
    queryResult = await queryInvoices(baseUrl, accessToken, company.nip);
  } catch (e) {
    console.log(`[ksef-sync] V2 query failed, trying v1: ${e}`);
    queryResult = await queryInvoicesV1(baseUrl, accessToken);
  }

  const invoiceRefs =
    queryResult?.invoiceHeaderList ||
    queryResult?.invoicesList ||
    queryResult?.items ||
    [];
  console.log(`[ksef-sync] Found ${invoiceRefs.length} invoices`);

  // Step 8: Upsert invoices
  let upsertedCount = 0;
  for (const ref of invoiceRefs) {
    const ksefNumber =
      ref.ksefReferenceNumber || ref.invoiceReferenceNumber || ref.referenceNumber;
    if (!ksefNumber) continue;

    try {
      const { data: existing } = await supabase
        .from("invoices")
        .select("id")
        .eq("ksef_number", ksefNumber)
        .eq("company_id", company.id)
        .maybeSingle();

      if (existing) continue;

      // Try to get full invoice XML for details
      let vendor = ref.subjectName || ref.vendorName || "Nieznany";
      let nip = ref.subjectNip || ref.nip || company.nip;
      let date = ref.invoicingDate || ref.date || new Date().toISOString().split("T")[0];
      let grossAmount = ref.grossValue || ref.grossAmount || 0;

      try {
        const xml = await getInvoice(baseUrl, accessToken, ksefNumber);
        const parsed = parseInvoiceXml(xml);
        if (parsed.vendor) vendor = parsed.vendor;
        if (parsed.nip) nip = parsed.nip;
        if (parsed.date) date = parsed.date;
        if (parsed.grossAmount) grossAmount = parsed.grossAmount;
      } catch (xmlErr) {
        console.log(`[ksef-sync] Could not fetch XML for ${ksefNumber}: ${xmlErr}`);
      }

      const { error: insertError } = await supabase.from("invoices").insert({
        company_id: company.id,
        date,
        vendor,
        nip,
        gross_amount: grossAmount,
        ksef_number: ksefNumber,
        status: "new",
      });

      if (insertError) {
        console.error(`[ksef-sync] Insert error for ${ksefNumber}:`, insertError);
      } else {
        upsertedCount++;
      }
    } catch (invErr) {
      console.error(`[ksef-sync] Error processing ${ksefNumber}:`, invErr);
    }
  }

  return {
    companyId: company.id,
    companyNip: company.nip,
    totalFound: invoiceRefs.length,
    newInvoices: upsertedCount,
  };
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
    const companyId = body.company_id || null;
    const ksefEnv = body.ksef_env || "prod";

    let query = supabase.from("companies").select("id, nip, ksef_token");
    if (companyId) query = query.eq("id", companyId);

    const { data: companies, error: companiesError } = await query;
    if (companiesError) throw new Error(`DB error: ${companiesError.message}`);
    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nie znaleziono firm do synchronizacji" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validCompanies = companies.filter(
      (c: any) => c.ksef_token && c.ksef_token.trim().length > 0
    );
    if (validCompanies.length === 0) {
      return new Response(
        JSON.stringify({ error: "Żadna firma nie ma skonfigurowanego tokenu KSeF" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results = [];
    const errors = [];

    for (const company of validCompanies) {
      try {
        const result = await syncCompany(supabase, company, ksefEnv);
        results.push(result);
      } catch (err) {
        console.error(`[ksef-sync] Error syncing ${company.nip}:`, err);
        errors.push({
          companyId: company.id,
          companyNip: company.nip,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        results,
        errors,
        summary: {
          totalCompanies: validCompanies.length,
          successCount: results.length,
          errorCount: errors.length,
          totalNewInvoices: results.reduce((sum, r) => sum + r.newInvoices, 0),
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[ksef-sync] Fatal error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Nieznany błąd synchronizacji",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
