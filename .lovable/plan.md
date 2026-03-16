

## Problem

Synchronization buttons ("Synchronizuj lokalnie" and "Sync. wszystkich") still call `localhost:4000`, which is unavailable in the cloud environment. The user sees the error toast "Synchronizacja lokalna niedostępna" every time they click sync.

## Plan: Build Cloud-Based KSeF Sync via Edge Function

### 1. Create Edge Function `ksef-sync`

A backend function that:
- Accepts a `company_id` (or syncs all companies if omitted)
- Reads the company's `ksef_token` and `nip` from the `companies` table
- Calls the KSeF API (`https://ksef.mf.gov.pl/api/`) to fetch invoices using the token
- Upserts fetched invoices into the `invoices` table (deduplicating by `ksef_number`)
- Returns a count of new/updated invoices

**KSeF API flow:**
1. Initialize a session with the token → get session ID
2. Query invoices for the company's NIP
3. For each invoice, fetch XML details (vendor, amount, date, NIP)
4. Insert/update records in the database

### 2. Update Frontend Hooks

- **`useSync`** — change from `fetch("http://localhost:4000/api/sync")` to call the `ksef-sync` edge function via `supabase.functions.invoke("ksef-sync", { body: { company_id } })`
- **`useSyncAllCompanies`** — same, but without `company_id` to sync all companies
- Pass `activeCompanyId` to `useSync` so it syncs the correct company

### 3. Update UI Labels

- Rename "Synchronizuj lokalnie" → "Synchronizuj z KSeF"
- Update toast messages to reflect cloud sync status
- Pass `activeCompanyId` from `Index.tsx` to the sync mutation

### 4. Files Changed

| File | Change |
|------|--------|
| `supabase/functions/ksef-sync/index.ts` | New edge function |
| `src/hooks/useInvoices.ts` | `useSync` calls edge function |
| `src/hooks/useCompanies.ts` | `useSyncAllCompanies` calls edge function |
| `src/components/dashboard/DashboardHeader.tsx` | Button label update |
| `src/pages/Index.tsx` | Pass `activeCompanyId` to sync |

### Important Note

The KSeF API has specific authentication and query endpoints. The edge function will need to handle the KSeF session protocol. If the KSeF test/production API is not reachable or the token format changes, the sync will fail gracefully with a descriptive error message.

