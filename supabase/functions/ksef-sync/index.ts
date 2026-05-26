import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { DOMParser, Element } from "https://deno.land/x/deno_dom@v0.1.46/deno-dom-wasm.ts";

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

const INSTANT_PAYMENT_METHODS = new Set(["1", "2", "3", "4", "7"]);
const MAX_XML_FETCHES_PER_SYNC = 15;
const MAX_SYNC_RUNTIME_MS = 105_000;
const MAX_RATE_LIMIT_WAIT_SECONDS = 10;

function normalizePaymentMethod(value: string | null | undefined): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;
  if (["1", "2", "3", "4", "5", "6", "7"].includes(raw)) return raw;
  const text = raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  if (text.includes("gotow") || text.includes("cash")) return "1";
  if (text.includes("karta") || text.includes("card") || text.includes("platnicz")) return "2";
  if (text.includes("bon") || text.includes("voucher")) return "3";
  if (text.includes("czek") || text.includes("check")) return "4";
  if (text.includes("mobil") || text.includes("blik")) return "7";
  if (text.includes("przelew") || text.includes("transfer") || text.includes("bank")) return "6";
  return raw;
}

function isInstantPaymentMethod(value: string | null | undefined): boolean {
  const method = normalizePaymentMethod(value);
  return method !== null && INSTANT_PAYMENT_METHODS.has(method);
}

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
// KSeF API enforces max 3-month date ranges, so we chunk automatically.
async function queryInvoices(baseUrl: string, accessToken: string, nip: string, subjectType: string = "subject2", dateFrom?: string, dateTo?: string) {
  const now = new Date();
  const globalFrom = dateFrom ? new Date(dateFrom) : new Date(now);
  if (!dateFrom) globalFrom.setMonth(globalFrom.getMonth() - 3);
  const globalTo = dateTo ? new Date(dateTo) : now;

  // Build 3-month windows
  const windows: { from: Date; to: Date }[] = [];
  let wStart = new Date(globalFrom);
  while (wStart < globalTo) {
    const wEnd = new Date(wStart);
    wEnd.setMonth(wEnd.getMonth() + 3);
    // cap at globalTo
    const actualEnd = wEnd > globalTo ? globalTo : wEnd;
    windows.push({ from: new Date(wStart), to: actualEnd });
    wStart = new Date(actualEnd);
    // avoid infinite loop if dates are equal
    if (wStart >= globalTo) break;
  }
  if (windows.length === 0) {
    windows.push({ from: globalFrom, to: globalTo });
  }

  console.log(`[ksef-sync] queryInvoices ${subjectType}: ${windows.length} window(s) from ${globalFrom.toISOString()} to ${globalTo.toISOString()}`);

  const allInvoices: any[] = [];

  for (const window of windows) {
    let pageNum = 0;
    while (true) {
      const queryBody: any = {
        subjectType,
        dateRange: {
          dateType: "issue",
          from: window.from.toISOString(),
          to: window.to.toISOString(),
        },
      };

      const headers: Record<string, string> = {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      };

      if (pageNum > 0) {
        await new Promise(r => setTimeout(r, 500));
      }

      const url = `${baseUrl}/api/v2/invoices/query/metadata?pageSize=100&pageOffset=${pageNum}`;
      console.log(`[ksef-sync] POST ${url} page=${pageNum} subjectType=${subjectType}`);

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

      const pageInvoices = data?.invoices || data?.invoiceHeaderList || [];
      allInvoices.push(...pageInvoices);

      if (!data.hasMore || pageInvoices.length === 0) {
        break;
      }

      pageNum++;
      if (pageNum > 50) {
        break;
      }
    }
  }

  console.log(`[ksef-sync] Total ${subjectType} invoices fetched: ${allInvoices.length}`);
  return { invoices: allInvoices };
}

// Get single invoice
async function getInvoice(baseUrl: string, accessToken: string, ksefNumber: string) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetchWithRetry(`${baseUrl}/api/v2/invoices/ksef/${ksefNumber}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/octet-stream, application/json",
      },
    });
    if (res.ok) return await res.text();

    const text = await res.text();
    if (res.status === 429 && attempt < 2) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const secondsFromBody = Number(text.match(/po\s+(\d+)\s+sekund/i)?.[1]);
      const requestedWait = retryAfter || secondsFromBody || 30;
      if (requestedWait > MAX_RATE_LIMIT_WAIT_SECONDS) {
        throw new Error(`KSeF rate limit for ${ksefNumber}: retry after ${requestedWait}s`);
      }
      const waitSeconds = Math.min(MAX_RATE_LIMIT_WAIT_SECONDS, Math.max(3, requestedWait));
      console.log(`[ksef-sync] Rate limited while fetching ${ksefNumber}, waiting ${waitSeconds}s`);
      await new Promise((r) => setTimeout(r, waitSeconds * 1000));
      continue;
    }
    throw new Error(`Get invoice ${ksefNumber} failed (${res.status}): ${text}`);
  }
  throw new Error(`Get invoice ${ksefNumber} failed after retries`);
}

// Namespace-agnostic XML parsing using DOMParser
function parseInvoiceXml(xml: string) {
  try {
    const doc = new DOMParser().parseFromString(xml, "text/html");
    if (!doc) throw new Error("DOMParser returned null");

    // Walk all elements, ignoring namespace prefixes (use localName)
    const allEls: Element[] = [];
    const walk = (node: any) => {
      if (node && node.nodeType === 1) allEls.push(node as Element);
      const children = node?.childNodes;
      if (children) for (const c of children) walk(c);
    };
    walk(doc);

    const localName = (el: Element) => {
      const n = (el as any).localName || el.tagName || "";
      const idx = n.indexOf(":");
      return (idx >= 0 ? n.slice(idx + 1) : n).toLowerCase();
    };

    const findAll = (tag: string): Element[] => {
      const t = tag.toLowerCase();
      return allEls.filter((el) => localName(el) === t);
    };
    const findFirst = (tag: string): Element | null => {
      const t = tag.toLowerCase();
      return allEls.find((el) => localName(el) === t) || null;
    };
    const getTag = (tag: string): string | null => {
      const el = findFirst(tag);
      const v = el?.textContent?.trim();
      return v || null;
    };
    const getAmount = (tag: string) => {
      const v = getTag(tag);
      return v ? parseFloat(v.replace(",", ".")) : 0;
    };

    // Extract seller (Podmiot1) and buyer (Podmiot2) separately
    const extractPartyFrom = (root: Element | null) => {
      if (!root) return { name: "", nip: "" };
      const sub: Element[] = [];
      const walkSub = (n: any) => {
        if (n && n.nodeType === 1) sub.push(n as Element);
        if (n?.childNodes) for (const c of n.childNodes) walkSub(c);
      };
      walkSub(root);
      const find = (tag: string) => {
        const t = tag.toLowerCase();
        const el = sub.find((e) => localName(e) === t);
        return el?.textContent?.trim() || "";
      };
      return {
        name: find("Nazwa") || find("ImieNazwisko") || "",
        nip: find("NIP") || find("NrNIP") || "",
      };
    };
    const podmiot1El = findFirst("Podmiot1");
    const podmiot2El = findFirst("Podmiot2");
    const seller = extractPartyFrom(podmiot1El);
    const buyer = extractPartyFrom(podmiot2El);
    const vendor = seller.name || getTag("Nazwa") || "Nieznany kontrahent";
    const nip = seller.nip || getTag("NrNIP") || getTag("NIP") || "";
    const date = getTag("P_1") || getTag("DataWystawienia") || new Date().toISOString().split("T")[0];
    const grossAmount = getAmount("P_15") || getAmount("KwotaBrutto") || 0;

    // Payment section: <Platnosc>...</Platnosc> with <FormaPlatnosci>, <TerminPlatnosci>, <Zaplacono>, <DataZaplaty>
    const platnoscEl = findFirst("Platnosc");
    const inPayment = (tag: string): string | null => {
      if (!platnoscEl) return null;
      const t = tag.toLowerCase();
      const stack: any[] = [platnoscEl];
      while (stack.length) {
        const cur = stack.pop();
        if (cur && cur.nodeType === 1 && localName(cur as Element) === t) {
          const v = (cur as Element).textContent?.trim();
          if (v) return v;
        }
        if (cur?.childNodes) for (const c of cur.childNodes) stack.push(c);
      }
      return null;
    };

    const rawPaymentMethod =
      inPayment("FormaPlatnosci") ||
      getTag("FormaPlatnosci") ||
      getTag("SposobPlatnosci") ||
      getTag("RodzajPlatnosci") ||
      getTag("MetodaPlatnosci") ||
      getTag("OpisPlatnosci");
    const paymentMethod = normalizePaymentMethod(rawPaymentMethod);

    let paymentDueDate =
      inPayment("TerminPlatnosci") ||
      getTag("TerminPlatnosci") ||
      getTag("P_22A") ||
      null;
    if (paymentDueDate) {
      const m = paymentDueDate.match(/(\d{4}-\d{2}-\d{2})/);
      paymentDueDate = m ? m[1] : null;
    }
    if (!paymentDueDate && date) {
      const d = new Date(date);
      if (!isNaN(d.getTime())) {
        d.setDate(d.getDate() + 14);
        paymentDueDate = d.toISOString().split("T")[0];
      }
    }

    const zaplaconoFlag =
      inPayment("Zaplacono") || getTag("Zaplacono") || getTag("P_18") || null;
    let dataZaplaty =
      inPayment("DataZaplaty") || getTag("DataZaplaty") || getTag("P_18A") || null;
    if (dataZaplaty) {
      const dm = dataZaplaty.match(/(\d{4}-\d{2}-\d{2})/);
      dataZaplaty = dm ? dm[1] : null;
    }
    // P_18="1" = paid, "2" = not paid. Only "1"/"true"/realna data zaplaty oznacza zapłaconą.
    const isPaidInXml =
      zaplaconoFlag === "1" || zaplaconoFlag?.toLowerCase() === "true" || !!dataZaplaty;

    console.log("[ksef-sync][XML]", JSON.stringify({
      vendor, nip, date, grossAmount,
      rawPaymentMethod, paymentMethod,
      paymentDueDate, zaplaconoFlag, dataZaplaty, isPaidInXml,
    }));

    // Line items
    const items: Array<any> = [];
    const wiersze = findAll("FaWiersz");
    let ordinal = 1;
    for (const w of wiersze) {
      const sub: Element[] = [];
      const walkSub = (n: any) => {
        if (n && n.nodeType === 1) sub.push(n as Element);
        if (n?.childNodes) for (const c of n.childNodes) walkSub(c);
      };
      walkSub(w);
      const getF = (tag: string) => {
        const t = tag.toLowerCase();
        const el = sub.find((e) => localName(e) === t);
        return el?.textContent?.trim() || null;
      };
      const getN = (tag: string) => {
        const v = getF(tag);
        return v ? parseFloat(v.replace(",", ".")) : 0;
      };

      const name = getF("P_7") || getF("NazwaTowaru") || getF("Opis") || "";
      const quantity = getN("P_8B") || getN("Ilosc") || 1;
      const unit = getF("P_8A") || getF("JednostkaMiary") || "szt.";
      const unitPriceNet = getN("P_9A") || getN("CenaJednostkowa") || 0;
      const netAmount = getN("P_11") || getN("WartoscNetto") || 0;
      const vatRateNum = getN("P_12") || 23;
      const vatRate = vatRateNum === -1 ? "zw." : `${vatRateNum}%`;
      const vatAmount = getN("P_11A") || (netAmount * (vatRateNum > 0 ? vatRateNum / 100 : 0));
      const itemGross = netAmount + vatAmount;

      items.push({
        ordinal: ordinal++,
        name, quantity, unit,
        unit_price_net: unitPriceNet,
        net_amount: netAmount,
        vat_rate: vatRate,
        vat_amount: vatAmount,
        gross_amount: itemGross,
      });
    }

    return { vendor, nip, seller, buyer, date, grossAmount, items, paymentMethod, paymentDueDate, isPaidInXml, dataZaplaty };
  } catch (err) {
    console.error("[ksef-sync][XML] Parse error:", err instanceof Error ? err.message : err);
    return {
      vendor: "Nieznany kontrahent",
      nip: "",
      seller: { name: "", nip: "" },
      buyer: { name: "", nip: "" },
      date: new Date().toISOString().split("T")[0],
      grossAmount: 0,
      items: [],
      paymentMethod: null,
      paymentDueDate: null,
      isPaidInXml: false,
      dataZaplaty: null,
    };
  }
}

// Main sync for single company
async function syncCompany(
  supabase: ReturnType<typeof createClient>,
  company: { id: string; nip: string; ksef_token: string },
  ksefEnv: string,
  dateFrom?: string,
  dateTo?: string,
  onlyKsefNumber?: string | null
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

      // Step 7: Query invoices — both subject1 (przychodowe) and subject2 (kosztowe)
      const [queryResult2, queryResult1] = await Promise.all([
        queryInvoices(baseUrl, accessToken, company.nip, "subject2", dateFrom, dateTo),
        queryInvoices(baseUrl, accessToken, company.nip, "subject1", dateFrom, dateTo),
      ]);

      // Tag each invoice ref with its type
      const kosztowe = (queryResult2?.invoices || []).map((r: any) => ({ ...r, _invoiceType: "kosztowa" }));
      const przychodowe = (queryResult1?.invoices || []).map((r: any) => ({ ...r, _invoiceType: "przychodowa" }));
      const allRefs = [...kosztowe, ...przychodowe].filter((ref: any) => {
        if (!onlyKsefNumber) return true;
        const number = ref.ksefNumber || ref.ksefReferenceNumber || ref.invoiceReferenceNumber || ref.referenceNumber;
        return number === onlyKsefNumber;
      });

      console.log(`[ksef-sync] Found ${kosztowe.length} kosztowych, ${przychodowe.length} przychodowych`);

      // Step 8: Upsert invoices
      let upsertedCount = 0;
      let processedCount = 0;
      let skippedCompleteCount = 0;
      let deferredXmlCount = 0;
      let xmlFetches = 0;
      const processingStartedAt = Date.now();
      for (const ref of allRefs) {
        if (!onlyKsefNumber && Date.now() - processingStartedAt > MAX_SYNC_RUNTIME_MS) {
          console.log(`[ksef-sync] Stopping early before edge timeout after ${processedCount} invoices and ${xmlFetches} XML fetches`);
          break;
        }

        const ksefNumber =
          ref.ksefNumber ||
          ref.ksefReferenceNumber ||
          ref.invoiceReferenceNumber ||
          ref.referenceNumber;
        if (!ksefNumber) continue;

        try {
          const { data: existing } = await supabase
            .from("invoices")
            .select("id, date, payment_method, payment_due_date, payment_status, paid_at")
            .eq("ksef_number", ksefNumber)
            .eq("company_id", company.id)
            .maybeSingle();

          if (existing) {
            const { count } = await supabase
              .from("invoice_items")
              .select("id", { count: "exact", head: true })
              .eq("invoice_id", existing.id);

            // Skip XML re-fetch if invoice already has complete payment data + items
            const hasCompletePayment =
              existing.payment_method &&
              existing.payment_due_date &&
              existing.payment_status &&
              count && count > 0;
            if (hasCompletePayment && !onlyKsefNumber) {
              skippedCompleteCount++;
              continue;
            }

            if (!onlyKsefNumber && xmlFetches >= MAX_XML_FETCHES_PER_SYNC) {
              deferredXmlCount++;
              continue;
            }

            try {
              xmlFetches++;
              const xml = await getInvoice(baseUrl, accessToken, ksefNumber);
              const parsed = parseInvoiceXml(xml);
              const instantPayment = isInstantPaymentMethod(parsed.paymentMethod);
              const xmlPaid = instantPayment || parsed.isPaidInXml;
              const paymentUpdate: Record<string, string | null> = {};

              if (parsed.paymentMethod !== null) paymentUpdate.payment_method = parsed.paymentMethod;
              if (parsed.paymentDueDate) paymentUpdate.payment_due_date = parsed.paymentDueDate;
              if (xmlPaid) {
                paymentUpdate.payment_status = "paid";
                paymentUpdate.paid_at = parsed.dataZaplaty
                  ? new Date(parsed.dataZaplaty).toISOString()
                  : existing.paid_at || new Date().toISOString();
              }

              if (Object.keys(paymentUpdate).length > 0) {
                const { error: updateError } = await supabase
                  .from("invoices")
                  .update(paymentUpdate)
                  .eq("id", existing.id);
                if (updateError) console.error(`[ksef-sync] Payment backfill error for ${ksefNumber}:`, updateError);
                else upsertedCount++;
              }

              if (count && count > 0) continue;

              if (parsed.items.length > 0) {
                const itemRows = parsed.items.map(item => ({
                  invoice_id: existing.id,
                  ordinal: item.ordinal,
                  name: item.name,
                  quantity: item.quantity,
                  unit: item.unit,
                  unit_price_net: item.unit_price_net,
                  net_amount: item.net_amount,
                  vat_rate: item.vat_rate,
                  vat_amount: item.vat_amount,
                  gross_amount: item.gross_amount,
                }));
                const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows);
                if (!itemsError) upsertedCount++;
              }
            } catch (xmlErr) {
              console.log(`[ksef-sync] Could not backfill XML for ${ksefNumber}: ${xmlErr}`);
            }
            continue;
          }

          const invoiceType = ref._invoiceType || "kosztowa";
          const isIncomeRef = invoiceType === "przychodowa";
          let vendor = (isIncomeRef ? (ref.buyer?.name || ref.buyerName) : (ref.seller?.name || ref.subjectName || ref.vendorName)) || "Nieznany";
          let nip = (isIncomeRef ? (ref.buyer?.nip || ref.buyerNip) : (ref.seller?.nip || ref.subjectNip || ref.nip)) || "";
          let date = ref.issueDate || ref.invoicingDate || ref.date || new Date().toISOString().split("T")[0];
          let grossAmount = ref.grossAmount || ref.grossValue || ref.grossAmount || 0;

          let parsedItems: any[] = [];
          let paymentMethod: string | null = null;
          let paymentDueDate: string | null = null;
          let isPaidInXml = false;
          let dataZaplaty: string | null = null;

          if (!onlyKsefNumber && xmlFetches >= MAX_XML_FETCHES_PER_SYNC) {
            deferredXmlCount++;
          } else {
            try {
              xmlFetches++;
              const xml = await getInvoice(baseUrl, accessToken, ksefNumber);
              const parsed = parseInvoiceXml(xml);
              const isIncome = invoiceType === "przychodowa";
              const parsedVendor = isIncome
                ? (parsed.buyer?.name || parsed.vendor)
                : (parsed.seller?.name || parsed.vendor);
              const parsedNip = isIncome
                ? (parsed.buyer?.nip || parsed.nip)
                : (parsed.seller?.nip || parsed.nip);
              if (parsedVendor) vendor = parsedVendor;
              if (parsedNip) nip = parsedNip;
              if (parsed.date) date = parsed.date;
              if (parsed.grossAmount) grossAmount = parsed.grossAmount;
              parsedItems = parsed.items || [];
              paymentMethod = parsed.paymentMethod;
              paymentDueDate = parsed.paymentDueDate;
              isPaidInXml = parsed.isPaidInXml;
              dataZaplaty = parsed.dataZaplaty;
            } catch (xmlErr) {
              console.log(`[ksef-sync] Could not fetch XML for ${ksefNumber}: ${xmlErr}`);
            }
          }

          // Fallback termin płatności: data wystawienia + 14 dni jeśli brak w XML
          if (!paymentDueDate && date) {
            const d = new Date(date);
            if (!isNaN(d.getTime())) {
              d.setDate(d.getDate() + 14);
              paymentDueDate = d.toISOString().split("T")[0];
            }
          }

          // Natychmiastowe formy płatności = zawsze opłacone (gotówka, karta, bon, czek, płatność mobilna)
          const isCash = isInstantPaymentMethod(paymentMethod);
          const isPaid = isCash || isPaidInXml;
          const paidAt = isPaid
            ? (dataZaplaty ? new Date(dataZaplaty).toISOString() : new Date().toISOString())
            : null;

          const { data: inserted, error: insertError } = await supabase.from("invoices").insert({
            company_id: company.id,
            date,
            vendor,
            nip,
            gross_amount: grossAmount,
            ksef_number: ksefNumber,
            status: "new",
            invoice_type: invoiceType,
            payment_method: paymentMethod,
            payment_due_date: paymentDueDate,
            payment_status: isPaid ? "paid" : "unpaid",
            paid_at: paidAt,
          }).select("id").single();

          if (insertError) {
            console.error(`[ksef-sync] Insert error for ${ksefNumber}:`, insertError);
          } else {
            upsertedCount++;
            if (parsedItems.length > 0 && inserted?.id) {
              const itemRows = parsedItems.map(item => ({
                invoice_id: inserted.id,
                ordinal: item.ordinal,
                name: item.name,
                quantity: item.quantity,
                unit: item.unit,
                unit_price_net: item.unit_price_net,
                net_amount: item.net_amount,
                vat_rate: item.vat_rate,
                vat_amount: item.vat_amount,
                gross_amount: item.gross_amount,
              }));
              const { error: itemsError } = await supabase.from("invoice_items").insert(itemRows);
              if (!itemsError) {
                console.log(`[ksef-sync] Inserted ${itemRows.length} items for ${ksefNumber}`);
              }
            }
          }
          processedCount++;
        } catch (invErr) {
          console.error(`[ksef-sync] Error processing ${ksefNumber}:`, invErr);
        }
      }

      return {
        companyId: company.id,
        companyNip: company.nip,
        totalFound: allRefs.length,
        newInvoices: upsertedCount,
        processedInvoices: processedCount,
        skippedComplete: skippedCompleteCount,
        deferredXml: deferredXmlCount,
        xmlFetches,
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
    const dateFrom = body.date_from || null;
    const dateTo = body.date_to || null;
    const onlyKsefNumber = typeof body.ksef_number === "string" ? body.ksef_number : null;

    const [{ data: ownedCompanies, error: ownedCompaniesError }, { data: companyRoles, error: companyRolesError }] = await Promise.all([
      supabase.from("companies").select("id").eq("user_id", userId),
      supabase.from("user_roles").select("company_id").eq("user_id", userId),
    ]);

    if (ownedCompaniesError) throw new Error(`DB error: ${ownedCompaniesError.message}`);
    if (companyRolesError) throw new Error(`DB error: ${companyRolesError.message}`);

    const accessibleCompanyIds = Array.from(
      new Set([
        ...(ownedCompanies ?? []).map((company: { id: string }) => company.id),
        ...(companyRoles ?? []).map((role: { company_id: string }) => role.company_id),
      ])
    );

    if (accessibleCompanyIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nie znaleziono firm do synchronizacji" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (companyId && !accessibleCompanyIds.includes(companyId)) {
      return new Response(
        JSON.stringify({ error: "Brak dostępu do wybranej firmy" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: companies, error: companiesError } = await supabase
      .from("companies")
      .select("id, nip, ksef_token")
      .in("id", companyId ? [companyId] : accessibleCompanyIds);

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
        const result = await syncCompany(supabase, company, ksefEnv, dateFrom, dateTo, onlyKsefNumber);
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
        error: "Blad synchronizacji. Sprobuj ponownie.",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
