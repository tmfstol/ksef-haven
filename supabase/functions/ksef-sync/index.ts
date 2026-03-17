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

// Find SPKI in X.509 cert by searching for RSA OID bytes
function extractSpkiFromCert(certDer: Uint8Array): Uint8Array {
  // RSA OID: 1.2.840.113549.1.1.1 = 06 09 2a 86 48 86 f7 0d 01 01 01
  const rsaOid = [0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
  
  // Find the OID in the cert
  for (let i = 0; i < certDer.length - rsaOid.length; i++) {
    let found = true;
    for (let j = 0; j < rsaOid.length; j++) {
      if (certDer[i + j] !== rsaOid[j]) { found = false; break; }
    }
    if (!found) continue;
    
    // OID found at position i. The AlgorithmIdentifier SEQUENCE starts 2 bytes before
    // (tag 30 + length byte). But we need the SPKI SEQUENCE which is one level up.
    // Search backwards from the AlgorithmIdentifier to find the enclosing SEQUENCE
    // SPKI = SEQUENCE { AlgorithmIdentifier, BIT STRING }
    // AlgorithmIdentifier = SEQUENCE { OID, NULL }
    // So we need to find the SEQUENCE that contains the AlgorithmIdentifier
    
    // The AlgorithmIdentifier SEQUENCE should be at i-2 (30 0d for RSA with NULL param)
    // The SPKI SEQUENCE should be a few bytes before that
    for (let back = 2; back < 10; back++) {
      const seqStart = i - back;
      if (seqStart < 0) continue;
      if (certDer[seqStart] !== 0x30) continue; // Must be SEQUENCE
      
      // Read the length to verify this is a valid SEQUENCE containing our OID
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
      // SPKI for RSA-2048 is typically 290-300 bytes, RSA-4096 is ~550 bytes
      if (totalLen >= 200 && totalLen <= 1000) {
        console.log(`[ksef-sync] Found SPKI at offset ${seqStart}, length ${totalLen}, header bytes: ${Array.from(certDer.slice(seqStart, seqStart + 6)).map(b => b.toString(16).padStart(2, '0')).join(' ')}`);
        return certDer.slice(seqStart, seqStart + totalLen);
      }
    }
  }
  
  throw new Error("Could not find RSA SPKI in certificate");
}

async function importRsaPublicKey(pemOrBase64: string): Promise<CryptoKey> {
  console.log(`[ksef-sync] Key/cert starts with: ${pemOrBase64.substring(0, 50)}`);
  
  // Strip PEM headers if present
  const b64 = pemOrBase64
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s/g, "");
    
  const binaryString = atob(b64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  console.log(`[ksef-sync] Decoded key/cert: ${bytes.length} bytes`);

  // Try importing as raw SPKI first (works for small keys / raw SPKI format)
  try {
    return await crypto.subtle.importKey(
      "spki",
      bytes.buffer,
      { name: "RSA-OAEP", hash: "SHA-256" },
      false,
      ["encrypt"]
    );
  } catch {
    console.log(`[ksef-sync] Not raw SPKI, trying X.509 extraction`);
  }

  // Extract SPKI from X.509 certificate
  const spki = extractSpkiFromCert(bytes);
  const buf = new ArrayBuffer(spki.length);
  new Uint8Array(buf).set(spki);
  return crypto.subtle.importKey(
    "spki",
    buf,
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
      contextIdentifier: { type: "Nip", value: nip },
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Challenge failed (${res.status}): ${text}`);
  try {
    const data = JSON.parse(text);
    console.log(`[ksef-sync] Challenge response keys: ${Object.keys(data).join(", ")}`);
    // Extract timestamp from challenge response (used for token encryption)
    let challengeTimestamp: number;
    if (data.timestampMs) {
      challengeTimestamp = parseInt(data.timestampMs);
    } else if (data.timestamp) {
      challengeTimestamp = Math.floor(new Date(data.timestamp).getTime());
    } else {
      challengeTimestamp = Date.now();
      console.log(`[ksef-sync] WARNING: No timestamp in challenge response, using Date.now()`);
    }
    data._challengeTimestamp = challengeTimestamp;
    return data;
  } catch {
    throw new Error(`Challenge response not JSON: ${text.substring(0, 200)}`);
  }
}

// Step 2: Get KSeF public RSA key
async function getPublicKey(baseUrl: string): Promise<string> {
  const url = `${baseUrl}/api/v2/security/public-key-certificates`;
  console.log(`[ksef-sync] GET ${url}`);
  const res = await fetchWithRetry(url, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Public key fetch failed (${res.status}): ${text.substring(0, 200)}`);

  try {
    const json = JSON.parse(text);
    // Find certificate with KsefTokenEncryption usage
    const certs = json.certificates || json.items || json;
    if (Array.isArray(certs)) {
      for (const cert of certs) {
        const usage = cert.usage || [];
        if (Array.isArray(usage) && usage.includes("KsefTokenEncryption")) {
          const pem = cert.certificate || cert.publicKey || cert.pem || cert.value;
          if (pem) {
            console.log(`[ksef-sync] Found KsefTokenEncryption certificate`);
            return pem;
          }
        }
      }
      // Fallback: use the first certificate
      if (certs.length > 0) {
        const first = certs[0];
        const pem = first.certificate || first.publicKey || first.pem || first.value;
        if (pem) {
          console.log(`[ksef-sync] Using first certificate (no KsefTokenEncryption found)`);
          console.log(`[ksef-sync] Available usages: ${certs.map((c: any) => JSON.stringify(c.usage)).join(", ")}`);
          return pem;
        }
      }
    }
    // Log full structure for debugging
    console.log(`[ksef-sync] Certificate response structure: ${JSON.stringify(json).substring(0, 500)}`);
    throw new Error("No usable certificate found in response");
  } catch (e) {
    if (e instanceof SyntaxError) {
      throw new Error(`Public key response not JSON: ${text.substring(0, 200)}`);
    }
    throw e;
  }
}

// Step 3: Encrypt token with RSA-OAEP
async function encryptToken(token: string, publicKeyPem: string, challengeTimestamp: number): Promise<string> {
  // KSeF expects: token|timestamp where timestamp is from the challenge response (Unix ms)
  const plaintext = `${token}|${challengeTimestamp}`;
  console.log(`[ksef-sync] Encrypting plaintext (${plaintext.length} chars): ${plaintext.substring(0, 80)}...`);
  
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
      contextIdentifier: { type: "Nip", value: nip },
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
  const rawText = await res.text();
  // Strip BOM and trim whitespace
  const text = rawText.replace(/^\uFEFF/, "").trim();
  if (!res.ok) throw new Error(`Token redeem failed (${res.status}): ${text.substring(0, 300)}`);
  const data = JSON.parse(text);
  // accessToken may be nested: {accessToken: {token: "jwt..."}} or flat {accessToken: "jwt..."}
  const at = data.accessToken;
  const accessToken = typeof at === "object" && at?.token ? at.token : at;
  const rt = data.refreshToken;
  const refreshToken = typeof rt === "object" && rt?.token ? rt.token : rt;
  console.log(`[ksef-sync] Got accessToken (${accessToken ? accessToken.length : 0} chars)`);
  return { accessToken, refreshToken };
}

// Step 7: Query invoices using accessToken
async function queryInvoices(baseUrl: string, accessToken: string, nip: string) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const url = `${baseUrl}/api/v2/invoices/query/metadata?pageSize=100`;
  const allInvoices: any[] = [];
  let continuationToken: string | null = null;
  let pageNum = 0;

  while (true) {
    const queryBody: any = {
      subjectType: "subject2",
      dateRange: {
        dateType: "issue",
        from: threeMonthsAgo.toISOString(),
        to: now.toISOString(),
      },
    };

    // Build headers - add continuation token for subsequent pages
    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    };
    if (continuationToken) {
      headers["x-continuation-token"] = continuationToken;
    }

    // Rate limit: wait between pages
    if (pageNum > 0) {
      await new Promise(r => setTimeout(r, 500));
    }

    console.log(`[ksef-sync] POST ${url} page=${pageNum}, continuationToken=${continuationToken ? continuationToken.substring(0, 30) + '...' : 'none'}`);

    let res: Response;
    for (let retry = 0; retry < 3; retry++) {
      res = await fetchWithRetry(url, {
        method: "POST",
        headers,
        body: JSON.stringify(queryBody),
      });
      if (res.status === 429) {
        const wait = Math.pow(2, retry + 1) * 1000;
        console.log(`[ksef-sync] Rate limited on page ${pageNum}, waiting ${wait}ms`);
        await new Promise(r => setTimeout(r, wait));
        continue;
      }
      break;
    }
    const rawText = await res!.text();
    const text = rawText.replace(/^\uFEFF/, "").trim();
    console.log(`[ksef-sync] Invoice query page ${pageNum} response (${res!.status}): ${text.substring(0, 300)}`);
    if (!res!.ok) throw new Error(`Invoice query failed (${res!.status}): ${text.substring(0, 300)}`);

    const data = JSON.parse(text);
    
    // Debug: log all response keys and headers
    console.log(`[ksef-sync] Response keys: ${Object.keys(data).join(', ')}`);
    const allHeaders: string[] = [];
    res!.headers.forEach((v, k) => allHeaders.push(`${k}: ${v.substring(0, 50)}`));
    console.log(`[ksef-sync] Response headers: ${allHeaders.join(' | ')}`);
    
    const pageInvoices = data?.invoices || data?.invoiceHeaderList || [];
    allInvoices.push(...pageInvoices);

    // Get continuation token from response headers or body
    const resContinuationToken = res!.headers.get("x-continuation-token") || data?.continuationToken || data?.nextPageToken || null;

    if (!data.hasMore || !resContinuationToken) {
      console.log(`[ksef-sync] No more pages. hasMore=${data.hasMore}, token=${!!resContinuationToken}, invoiceCount=${pageInvoices.length}`);
      break;
    }

    continuationToken = resContinuationToken;
    pageNum++;

    // Safety limit
    if (pageNum > 50) {
      console.log(`[ksef-sync] Reached page limit (50), stopping pagination`);
      break;
    }
  }

  console.log(`[ksef-sync] Total invoices fetched across ${pageNum + 1} pages: ${allInvoices.length}`);
  return { invoices: allInvoices };
}

// Get single invoice
async function getInvoice(baseUrl: string, accessToken: string, ksefNumber: string) {
  const res = await fetchWithRetry(`${baseUrl}/api/v2/invoices/ksef/${ksefNumber}`, {
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

  // Try multiple token interpretations - the stored value may be "reference|nip-xxx|hash"
  const fullToken = company.ksef_token.trim();
  const parts = fullToken.split("|");
  // Candidates: full token, first part (reference), last part (hash)
  const tokenCandidates = parts.length === 3
    ? [parts[0], parts[2], fullToken]
    : [fullToken];

  console.log(`[ksef-sync] Using KSeF env: ${ksefEnv}, base: ${baseUrl}`);
  console.log(`[ksef-sync] Token candidates: ${tokenCandidates.length}`);

  let lastError: Error | null = null;

  for (let ci = 0; ci < tokenCandidates.length; ci++) {
    const rawToken = tokenCandidates[ci];
    console.log(`[ksef-sync] Trying candidate ${ci}: length=${rawToken.length}, prefix=${rawToken.substring(0, 30)}...`);

    try {
      // Step 1: Get challenge (fresh for each attempt)
      const challengeData = await getChallenge(baseUrl, company.nip);
      const challenge = challengeData.challenge;
      console.log(`[ksef-sync] Got challenge: ${challenge?.substring(0, 20)}...`);

      // Step 2: Get public key
      const publicKeyPem = await getPublicKey(baseUrl);

      // Step 3: Encrypt token with challenge timestamp
      const encryptedToken = await encryptToken(rawToken, publicKeyPem, challengeData._challengeTimestamp);

      // Step 4: Authenticate
      const authResult = await authWithKsefToken(baseUrl, company.nip, encryptedToken, challenge);
      const authToken = authResult?.authenticationToken?.token || authResult?.authenticationToken;
      const refNumber = authResult?.referenceNumber;

      if (!authToken) {
        throw new Error(`No authenticationToken received. Response: ${JSON.stringify(authResult).substring(0, 300)}`);
      }
      console.log(`[ksef-sync] Got authToken, refNumber: ${refNumber}`);

      // Step 5: Poll until auth is complete
      await pollAuthStatus(baseUrl, refNumber, authToken);

      // Step 6: Redeem access token
      const tokenData = await redeemToken(baseUrl, authToken);
      const accessToken = tokenData?.accessToken || tokenData?.token;

      if (!accessToken) {
        throw new Error(`No accessToken received. Response: ${JSON.stringify(tokenData).substring(0, 300)}`);
      }
      console.log(`[ksef-sync] SUCCESS with candidate ${ci}! Got accessToken`);

      // Step 7: Query invoices
      const queryResult = await queryInvoices(baseUrl, accessToken, company.nip);

      const invoiceRefs =
        queryResult?.invoices ||
        queryResult?.invoiceHeaderList ||
        queryResult?.invoicesList ||
        queryResult?.items ||
        [];
      console.log(`[ksef-sync] Found ${invoiceRefs.length} invoices`);

      // Step 8: Upsert invoices
      let upsertedCount = 0;
      for (const ref of invoiceRefs) {
        const ksefNumber =
          ref.ksefNumber ||
          ref.ksefReferenceNumber ||
          ref.invoiceReferenceNumber ||
          ref.referenceNumber;
        if (!ksefNumber) continue;

        try {
          const { data: existing } = await supabase
            .from("invoices")
            .select("id")
            .eq("ksef_number", ksefNumber)
            .eq("company_id", company.id)
            .maybeSingle();

          if (existing) continue;

          let vendor = ref.seller?.name || ref.subjectName || ref.vendorName || "Nieznany";
          let nip = ref.seller?.nip || ref.subjectNip || ref.nip || company.nip;
          let date = ref.issueDate || ref.invoicingDate || ref.date || new Date().toISOString().split("T")[0];
          let grossAmount = ref.grossAmount || ref.grossValue || ref.grossAmount || 0;

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
    } catch (err) {
      console.log(`[ksef-sync] Candidate ${ci} failed: ${err instanceof Error ? err.message.substring(0, 100) : String(err)}`);
      lastError = err instanceof Error ? err : new Error(String(err));
      // Wait a bit before trying next candidate to avoid rate limiting
      if (ci < tokenCandidates.length - 1) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error("All token candidates failed");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── JWT Validation ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Brak autoryzacji" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Nieprawidłowy token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;
    console.log(`[ksef-sync] Authenticated user: ${userId}`);

    // Use service role for DB operations
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const companyId = body.company_id || null;
    const ksefEnv = body.ksef_env || "prod";

    // Only fetch companies belonging to the authenticated user
    let query = supabase.from("companies").select("id, nip, ksef_token").eq("user_id", userId);
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
          error: "Synchronizacja nie powiodla sie dla tej firmy.",
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
