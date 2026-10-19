# GiftOps - technical setup guide

Built on the Kaaj AI codebase (Next.js 14 + Supabase). Product home: `/app` (the `/` URL redirects there).
The original Kaaj pages are untouched and still reachable.

## 1. Database
Supabase > SQL editor > run `010_raahvia_crm.sql`, then `011_lead_sources.sql`, then `012_multitenant.sql` once each (012 adds company workspaces and moves existing data into a company called "Evynta"). It creates 21 `rv_*` tables, the private `rv-pod` storage bucket and default settings. All tables have RLS on with no policies: everything is reached only through the `/api/rv/*` server routes.

## 2. Environment variables
Copy the Raahvia block from `.env.example`. Required: the existing Supabase keys (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) and `NEXT_PUBLIC_APP_URL`. WhatsApp, AI calling and cron variables are optional until you connect those services; the app works without them (messages are logged as failed, human call tasks still get created).

## 3. First login
Set `RV_SUPER_ADMIN_EMAILS` to your own login email (platform owner: sees all companies at `/app/platform`). Every other person who signs up at `/app/login` enters a company name and gets their own private company workspace on a 14-day trial, and becomes its admin. Set `RV_SIGNUP_OPEN=false` to switch self-signup off and add companies yourself from the Platform page. Company admins add their own team under Settings > Staff.

Roles: admin (everything), sales (leads, customers, inbox, orders), ops (orders, vendors, purchases, packing, delivery), finance (invoices, payments, bills, reports), rider (own mobile run page only).

## 4. WhatsApp Cloud API
1. Meta app > WhatsApp: each company enters its own phone number ID and permanent token in Settings > Integrations. The webhook is shared; the company is identified by its phone number ID.
2. Webhook URL: `https://YOUR-DOMAIN/api/rv/webhooks/whatsapp`, verify token = `RV_WA_VERIFY_TOKEN`, app secret in `RV_WA_APP_SECRET`. Subscribe to `messages`.
3. Create a template named `address_request` (utility), 3 variables: {{1}} recipient name, {{2}} customer/company, {{3}} delivery date.
Replies from recipients are saved as a suggested address; staff verify it in Addresses. Texting STOP opts the number out.

## 5. AI calling
Each company enters its provider's URL and key in Settings > Integrations (start-call HTTP endpoint; adapt the payload in `src/lib/rv/wa.ts > startAiCall` if the provider differs). The provider posts results to `/api/rv/webhooks/ai-call` with header `x-rv-secret: RV_AI_CALL_SECRET`.

## 6. Address chase schedule
Chain: WhatsApp -> AI call -> human call task -> verified. Timings are in Settings > Address chase. Run `/api/rv/address-chase/run` regularly with header `Authorization: Bearer CRON_SECRET`. `vercel.json` has a once-a-day cron (the Vercel free-plan limit). For hourly runs use a free scheduler such as cron-job.org against the same URL.

## 7. Daily flow
Lead > convert to customer > order > import recipients from Excel (template download in the import dialog) > addresses chased automatically > purchases to vendors > packing/QC > delivery run, assign rider > rider page: pickup, deliver with photo POD > invoice from the order > record payment > reports.

## Notes
- Reports show order **contribution** (revenue minus direct costs), not accounting profit.
- Duplicates: mobile on leads/customers, invoice per order, payment reference, recipient import rows.
- Consult your CA before relying on GST outputs; set GSTIN and state code in Settings first.

## 8. Lead sources (run `supabase/migrations/011_lead_sources.sql` first)
All sources land in one Leads list, with one lead per phone number or social account.
- **Website form, chatbot, IndiaMART / JustDial / Google Ads forwarders, Zapier / Make:** use the company's own lead key shown in Settings > Integrations (it identifies the company), then POST `{name, mobile, email, company, occasion, message, source}` to `/api/rv/public/lead` with header `x-api-key`. Add a hidden form field named `hp` that stays empty (spam trap).
- **WhatsApp:** see section 4.
- **Facebook + Instagram:** create one Meta app, add the Webhooks product, callback `/api/rv/webhooks/meta` with `RV_META_VERIFY_TOKEN`. Subscribe the Page to `leadgen` (lead ads) and `messages`; subscribe the Instagram account to `messages`. Set `RV_META_APP_SECRET` in Vercel (shared). Each company enters its Page ID, Instagram ID and long-lived Page token in Settings > Integrations. Lead ads need the `leads_retrieval` permission and DMs need `pages_messaging` / `instagram_manage_messages`; Meta app review is required before real customers can use them.
- DMs are received into the Inbox. Replying to a DM is still done in Meta's own inbox for now.
- **Past enquiries:** Leads > Import Excel.
