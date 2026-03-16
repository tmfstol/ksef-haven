import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// KSeF API base URLs
const KSEF_API_PROD = "https://ksef.mf.gov.pl/api";
const KSEF_API_TEST = "https://ksef-test.mf.gov.pl/api";

// Use test environment by default - can be changed via request body
function getKsefBaseUrl(env: string = "test") {
  return env === "prod" ? KSEF_API_PROD : KSEF_API_TEST;
}

// Helper: base64 encode Uint8Array
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

// Helper: parse PEM public key to CryptoKey
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

// Step 1: Get authorisation challenge
async function getChallenge(baseUrl: string, nip: string) {
  const res = await fetch(`${baseUrl}/online/Session/AuthorisationChallenge`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      contextIdentifier: { type: "onip", identifier: nip },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Challenge failed (${res.status}): ${text}`);
  }
  return await res.json();
}

// Step 2: Get KSeF public RSA key
async function getPublicKey(baseUrl: string) {
  // Try multiple known endpoints for the public key
  const endpoints = [
    `${baseUrl}/online/Session/Key/RSA`,
  ];
  
  for (const url of endpoints) {
    const res = await fetch(url, {
      headers: { Accept: "application/octet-stream, application/json" },
    });
    if (res.ok) {
      const text = await res.text();
      // If it's PEM formatted, return as is
      if (text.includes("BEGIN PUBLIC KEY")) return text;
      // If it's JSON with a key field
      try {
        const json = JSON.parse(text);
        if (json.key) return json.key;
        if (json.publicKey) return json.publicKey;
      } catch { /* not json */ }
      return text;
    }
  }
  throw new Error("Could not fetch KSeF public RSA key");
}

// Step 3: Encrypt token with RSA-OAEP
async function encryptToken(token: string, publicKeyPem: string, challenge: string): Promise<string> {
  const timestamp = Date.now();
  const plaintext = `${token}|${timestamp}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(plaintext);
  
  const cryptoKey = await importRsaPublicKey(publicKeyPem);
  const encrypted = await crypto.subtle.encrypt(
    { name: "RSA-OAEP" },
    cryptoKey,
    data
  );
  
  return toBase64(new Uint8Array(encrypted));
}

// Step 4: Init session with encrypted token (v1 API - /api/online/Session/InitToken)
async function initSession(baseUrl: string, nip: string, encryptedToken: string, challenge: string) {
  // Build the XML body for InitToken
  const xmlBody = `<?xml version="1.0" encoding="UTF-8"?>
<ns3:InitSessionTokenRequest xmlns="http://ksef.mf.gov.pl/schema/gtw/svc/online/types/2021/10/01/0001"
  xmlns:ns2="http://ksef.mf.gov.pl/schema/gtw/svc/types/2021/10/01/0001"
  xmlns:ns3="http://ksef.mf.gov.pl/schema/gtw/svc/online/auth/request/2021/10/01/0001">
  <ns3:Context>
    <Challenge>${challenge}</Challenge>
    <ns2:Identifier xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="ns2:SubjectIdentifierByCompanyType">
      <ns2:Identifier>${nip}</ns2:Identifier>
    </ns2:Identifier>
    <ns2:DocumentType>
      <ns2:Service>KSeF</ns2:Service>
      <ns2:FormCode>
        <ns2:SystemCode>FA (2)</ns2:SystemCode>
        <ns2:SchemaVersion>1-0E</ns2:SchemaVersion>
        <ns2:TargetNamespace>http://crd.gov.pl/wzor/2023/06/29/12648/</ns2:TargetNamespace>
        <ns2:Value>FA</ns2:Value>
      </ns2:FormCode>
    </ns2:DocumentType>
    <ns2:Token>${encryptedToken}</ns2:Token>
  </ns3:Context>
</ns3:InitSessionTokenRequest>`;

  const res = await fetch(`${baseUrl}/online/Session/InitToken`, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      Accept: "application/json",
    },
    body: xmlBody,
  });
  
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`InitToken failed (${res.status}): ${text}`);
  }
  return await res.json();
}

// Step 5: Query invoices
async function queryInvoices(baseUrl: string, sessionToken: string, pageSize = 100, pageOffset = 0) {
  const now = new Date();
  const threeMonthsAgo = new Date(now);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  const res = await fetch(
    `${baseUrl}/online/Query/Invoice/Sync?PageSize=${pageSize}&PageOffset=${pageOffset}`,
    {
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
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Query invoices failed (${res.status}): ${text}`);
  }
  return await res.json();
}

// Step 6: Get single invoice details
async function getInvoice(baseUrl: string, sessionToken: string, ksefNumber: string) {
  const res = await fetch(
    `${baseUrl}/online/Invoice/Get/${ksefNumber}`,
    {
      headers: {
        Accept: "application/octet-stream",
        SessionToken: sessionToken,
      },
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Get invoice ${ksefNumber} failed (${res.status}): ${text}`);
  }
  return await res.text(); // Returns XML
}

// Step 7: Terminate session
async function terminateSession(baseUrl: string, sessionToken: string) {
  try {
    await fetch(`${baseUrl}/online/Session/Terminate`, {
      method: "GET",
      headers: { SessionToken: sessionToken, Accept: "application/json" },
    });
  } catch {
    // Best effort - don't fail if terminate fails
  }
}

// Parse invoice XML to extract key fields
function parseInvoiceXml(xml: string) {
  // Simple XML parsing using regex for the key fields
  const getTag = (tag: string) => {
    const match = xml.match(new RegExp(`<[^>]*${tag}[^>]*>([^<]+)<`, "i"));
    return match ? match[1].trim() : null;
  };
  
  const getAmount = (tag: string) => {
    const val = getTag(tag);
    return val ? parseFloat(val) : 0;
  };

  // Try to extract vendor name, NIP, date, and amounts
  // The FA XML schema uses specific element names
  const vendor =
    getTag("DaneIdentyfikacyjne>.*?Nazwa") ||
    getTag("Nazwa") ||
    "Nieznany kontrahent";
  
  const nip =
    getTag("DaneIdentyfikacyjne>.*?NIP") ||
    getTag("NrNIP") ||
    getTag("NIP") ||
    "";
  
  const date =
    getTag("P_1") || // Data wystawienia in FA schema
    getTag("DataWystawienia") ||
    new Date().toISOString().split("T")[0];
  
  const grossAmount =
    getAmount("P_15") || // Kwota brutto in FA schema
    getAmount("BruttoPrzych662") ||
    getAmount("KwotaBrutto") ||
    0;

  return { vendor, nip, date, grossAmount };
}

// Main sync function for a single company
async function syncCompany(
  supabase: ReturnType<typeof createClient>,
  company: { id: string; nip: string; ksef_token: string },
  ksefEnv: string
) {
  const baseUrl = getKsefBaseUrl(ksefEnv);
  let sessionToken: string | null = null;
  
  try {
    // Step 1: Get challenge
    console.log(`[ksef-sync] Getting challenge for NIP: ${company.nip}`);
    const challengeData = await getChallenge(baseUrl, company.nip);
    const challenge = challengeData.challenge;

    // Step 2: Get public key
    console.log("[ksef-sync] Getting RSA public key");
    const publicKeyPem = await getPublicKey(baseUrl);

    // Step 3: Encrypt token
    console.log("[ksef-sync] Encrypting token");
    const encryptedToken = await encryptToken(company.ksef_token, publicKeyPem, challenge);

    // Step 4: Init session
    console.log("[ksef-sync] Initializing session");
    const sessionData = await initSession(baseUrl, company.nip, encryptedToken, challenge);
    sessionToken = sessionData.sessionToken?.token || sessionData.sessionToken;
    
    if (!sessionToken) {
      throw new Error("No session token received from KSeF");
    }

    // Step 5: Query invoices (paginated)
    console.log("[ksef-sync] Querying invoices");
    let allInvoiceRefs: any[] = [];
    let pageOffset = 0;
    const pageSize = 100;

    while (true) {
      const queryResult = await queryInvoices(baseUrl, sessionToken, pageSize, pageOffset);
      const items = queryResult.invoiceHeaderList || [];
      allInvoiceRefs = allInvoiceRefs.concat(items);
      
      if (items.length < pageSize) break;
      pageOffset += pageSize;
    }

    console.log(`[ksef-sync] Found ${allInvoiceRefs.length} invoices`);

    // Step 6: For each invoice, get details and upsert
    let upsertedCount = 0;
    
    for (const ref of allInvoiceRefs) {
      const ksefNumber = ref.ksefReferenceNumber || ref.invoiceReferenceNumber;
      if (!ksefNumber) continue;

      try {
        // Check if already exists
        const { data: existing } = await supabase
          .from("invoices")
          .select("id")
          .eq("ksef_number", ksefNumber)
          .eq("company_id", company.id)
          .maybeSingle();
        
        if (existing) continue; // Skip already imported invoices

        // Fetch full invoice XML
        const xml = await getInvoice(baseUrl, sessionToken, ksefNumber);
        const parsed = parseInvoiceXml(xml);

        // Insert into database
        const { error: insertError } = await supabase.from("invoices").insert({
          company_id: company.id,
          date: parsed.date,
          vendor: parsed.vendor,
          nip: parsed.nip || company.nip,
          gross_amount: parsed.grossAmount,
          ksef_number: ksefNumber,
          status: "new",
        });

        if (insertError) {
          console.error(`[ksef-sync] Insert error for ${ksefNumber}:`, insertError);
        } else {
          upsertedCount++;
        }
      } catch (invoiceError) {
        console.error(`[ksef-sync] Error processing invoice ${ksefNumber}:`, invoiceError);
      }
    }

    // Step 7: Terminate session
    await terminateSession(baseUrl, sessionToken);

    return {
      companyId: company.id,
      companyNip: company.nip,
      totalFound: allInvoiceRefs.length,
      newInvoices: upsertedCount,
    };
  } catch (error) {
    // Try to terminate session if we got one
    if (sessionToken) {
      await terminateSession(baseUrl, sessionToken);
    }
    throw error;
  }
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
    const ksefEnv = body.ksef_env || "test"; // "test" or "prod"

    // Fetch companies to sync
    let query = supabase.from("companies").select("id, nip, ksef_token");
    if (companyId) {
      query = query.eq("id", companyId);
    }
    
    const { data: companies, error: companiesError } = await query;
    if (companiesError) throw new Error(`DB error: ${companiesError.message}`);
    if (!companies || companies.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nie znaleziono firm do synchronizacji" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Filter out companies without ksef_token
    const validCompanies = companies.filter((c: any) => c.ksef_token && c.ksef_token.trim().length > 0);
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
        console.error(`[ksef-sync] Error syncing company ${company.nip}:`, err);
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
