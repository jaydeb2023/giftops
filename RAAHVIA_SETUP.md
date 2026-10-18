# Raahvia CRM + OMS - setup guide

Built on the Kaaj AI codebase (Next.js 14 + Supabase). Product home: `/raahvia` (the `/` URL redirects there).
The original Kaaj pages are untouched and still reachable.

## 1. Database
Supabase > SQL editor > run `supabase/migrations/010_raahvia_crm.sql` once. It creates 21 `rv_*` tables, the private `rv-pod` storage bucket and default settings. All tables have RLS on with no policies: everything is reached only through the `/api/rv/*` server routes.

## 2. Environment variables
Copy the Raahvia block from `.env.example`. Required: the existing Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and `NEXT_PUBLIC_APP_URL`. WhatsApp, AI calling and cron variables are optional until you connect those services; the app works without them (messages are logged as failed, human call tasks still get created).

## 3. First login
Open `/raahvia/login`, sign up. The first user becomes **admin** (set `RV_ADMIN_EMAILS` to restrict who can claim this). Then Settings > Staff to add sales, ops, finance and rider logins.

Roles: admin (everything), sales (leads, customers, inbox, orders), ops (orders, vendors, purchases, packing, delivery), finance (invoices, payments, bills, reports), rider (own mobile run page only).

## 4. WhatsApp Cloud API
1. Meta app > WhatsApp: copy phone number ID and a permanent token into `RV_WA_PHONE_NUMBER_ID`, `RV_WA_TOKEN`.
2. Webhook URL: `https://YOUR-DOMAIN/api/rv/webhooks/whatsapp`, verify token = `RV_WA_VERIFY_TOKEN`, app secret in `RV_WA_APP_SECRET`. Subscribe to `messages`.
3. Create a template named `address_request` (utility), 3 variables: {{1}} recipient name, {{2}} customer/company, {{3}} delivery date.
Replies from recipients are saved as a suggested address; staff verify it in Addresses. Texting STOP opts the number out.

## 5. AI calling
Set `RV_AI_CALL_API_URL` and `RV_AI_CALL_API_KEY` for your provider (start-call HTTP endpoint; adapt the payload in `src/lib/rv/wa.ts > startAiCall` if the provider differs). The provider posts results to `/api/rv/webhooks/ai-call` with header `x-rv-secret: RV_AI_CALL_SECRET`.

## 6. Address chase schedule
Chain: WhatsApp -> AI call -> human call task -> verified. Timings are in Settings > Address chase. Run `/api/rv/address-chase/run` regularly with header `Authorization: Bearer CRON_SECRET`. `vercel.json` has a once-a-day cron (the Vercel free-plan limit). For hourly runs use a free scheduler such as cron-job.org against the same URL.

## 7. Daily flow
Lead > convert to customer > order > import recipients from Excel (template download in the import dialog) > addresses chased automatically > purchases to vendors > packing/QC > delivery run, assign rider > rider page: pickup, deliver with photo POD > invoice from the order > record payment > reports.

## Notes
- Reports show order **contribution** (revenue minus direct costs), not accounting profit.
- Duplicates: mobile on leads/customers, invoice per order, payment reference, recipient import rows.
- Consult your CA before relying on GST outputs; set GSTIN and state code in Settings first.
