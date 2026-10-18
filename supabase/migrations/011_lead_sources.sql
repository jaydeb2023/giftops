-- More lead sources + social inbox support. Safe to run once after 010.
alter table public.rv_leads add column if not exists external_id text;      -- e.g. Instagram / Messenger sender id
create index if not exists rv_leads_external_idx on public.rv_leads(external_id);

alter table public.rv_leads drop constraint if exists rv_leads_source_check;
alter table public.rv_leads add constraint rv_leads_source_check check (source in
  ('phone','website','whatsapp','chatbot','referral','social','manual',
   'facebook','instagram','linkedin','google_ads','indiamart','justdial','email'));

alter table public.rv_communications drop constraint if exists rv_communications_channel_check;
alter table public.rv_communications add constraint rv_communications_channel_check check (channel in
  ('whatsapp','call','ai_call','sms','email','note','instagram','messenger'));
