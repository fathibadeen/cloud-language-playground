-- ============ ENUMS ============
create type public.app_role as enum ('super_admin','support');
create type public.company_role as enum ('owner','admin','agent','viewer');
create type public.company_status as enum ('active','suspended','pending');
create type public.channel_type as enum ('voice','whatsapp');
create type public.agent_language as enum ('ar','en');
create type public.conversation_status as enum ('open','needs_human','human','closed');
create type public.sender_type as enum ('customer','ai','human','system');
create type public.call_status as enum ('ringing','in_progress','completed','failed','transferred');
create type public.connection_status as enum ('not_connected','testing','connected','error');
create type public.subscription_status as enum ('trialing','active','past_due','canceled');
create type public.webhook_status as enum ('received','processing','processed','failed');
create type public.doc_status as enum ('pending','processing','ready','failed');

-- ============ UTIL ============
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ PROFILES ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  locale text not null default 'ar',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

-- ============ PLATFORM ROLES ============
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;

create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role(auth.uid(), 'super_admin');
$$;

-- ============ PLANS ============
create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name_ar text not null,
  name_en text not null,
  price_sar numeric(10,2) not null default 0,
  billing_period text not null default 'monthly',
  voice_minutes int not null default 0,
  whatsapp_messages int not null default 0,
  max_agents int not null default 1,
  max_phone_numbers int not null default 1,
  max_members int not null default 3,
  max_documents int not null default 20,
  features jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.plans to anon, authenticated;
grant all on public.plans to service_role;
alter table public.plans enable row level security;
create policy "plans public read" on public.plans for select using (is_active or public.is_super_admin());
create policy "plans super admin write" on public.plans for all to authenticated using (public.is_super_admin()) with check (public.is_super_admin());

-- ============ COMPANIES ============
create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique,
  cr_number text,
  industry text,
  description text,
  website text,
  address text,
  city text,
  contact_phone text,
  contact_email text,
  working_hours jsonb not null default '{}'::jsonb,
  default_locale text not null default 'ar',
  voice_enabled boolean not null default false,
  whatsapp_enabled boolean not null default false,
  onboarding_step int not null default 1,
  onboarding_completed boolean not null default false,
  status public.company_status not null default 'active',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.companies to authenticated;
grant all on public.companies to service_role;
alter table public.companies enable row level security;

create table public.company_members (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.company_role not null default 'viewer',
  invited_email text,
  created_at timestamptz not null default now(),
  unique (company_id, user_id)
);
grant select, insert, update, delete on public.company_members to authenticated;
grant all on public.company_members to service_role;
alter table public.company_members enable row level security;
create index idx_company_members_user on public.company_members(user_id);
create index idx_company_members_company on public.company_members(company_id);

-- tenant helpers (security definer, avoid RLS recursion)
create or replace function public.is_company_member(_company_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.company_members m where m.company_id = _company_id and m.user_id = auth.uid());
$$;

create or replace function public.has_company_role(_company_id uuid, _roles public.company_role[])
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.company_members m
    where m.company_id = _company_id and m.user_id = auth.uid() and m.role = any(_roles)
  );
$$;

create or replace function public.my_company_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select company_id from public.company_members where user_id = auth.uid();
$$;

-- profiles policies
create policy "own profile select" on public.profiles for select to authenticated using (id = auth.uid() or public.is_super_admin());
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy "own roles select" on public.user_roles for select to authenticated using (user_id = auth.uid() or public.is_super_admin());

create policy "companies member select" on public.companies for select to authenticated
  using (public.is_company_member(id) or public.is_super_admin());
create policy "companies insert own" on public.companies for insert to authenticated with check (created_by = auth.uid());
create policy "companies admin update" on public.companies for update to authenticated
  using (public.has_company_role(id, array['owner','admin']::public.company_role[]) or public.is_super_admin())
  with check (public.has_company_role(id, array['owner','admin']::public.company_role[]) or public.is_super_admin());

create policy "members select" on public.company_members for select to authenticated
  using (user_id = auth.uid() or public.is_company_member(company_id) or public.is_super_admin());
create policy "members insert" on public.company_members for insert to authenticated
  with check (user_id = auth.uid() or public.has_company_role(company_id, array['owner','admin']::public.company_role[]));
create policy "members update" on public.company_members for update to authenticated
  using (public.has_company_role(company_id, array['owner','admin']::public.company_role[]))
  with check (public.has_company_role(company_id, array['owner','admin']::public.company_role[]));
create policy "members delete" on public.company_members for delete to authenticated
  using (public.has_company_role(company_id, array['owner','admin']::public.company_role[]));

-- ============ SUBSCRIPTIONS / BILLING ============
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete restrict,
  status public.subscription_status not null default 'trialing',
  current_period_start timestamptz not null default now(),
  current_period_end timestamptz not null default (now() + interval '30 days'),
  cancel_at_period_end boolean not null default false,
  payment_provider text,
  external_reference text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.subscriptions to authenticated;
grant all on public.subscriptions to service_role;
alter table public.subscriptions enable row level security;
create index idx_subscriptions_company on public.subscriptions(company_id);

create table public.billing_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  subscription_id uuid references public.subscriptions(id) on delete set null,
  amount_sar numeric(10,2) not null default 0,
  currency text not null default 'SAR',
  status text not null default 'pending',
  provider text,
  external_reference text,
  issued_at timestamptz not null default now(),
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
grant select on public.billing_records to authenticated;
grant all on public.billing_records to service_role;
alter table public.billing_records enable row level security;
create index idx_billing_company on public.billing_records(company_id);

-- ============ AI AGENTS ============
create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  channel public.channel_type not null default 'voice',
  language public.agent_language not null default 'ar',
  personality text,
  system_instructions text,
  greeting text,
  fallback_response text,
  working_hours jsonb not null default '{}'::jsonb,
  handoff_rules jsonb not null default '{}'::jsonb,
  transfer_number text,
  knowledge_base_id uuid,
  provider text,
  provider_agent_id text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.ai_agents to authenticated;
grant all on public.ai_agents to service_role;
alter table public.ai_agents enable row level security;
create index idx_agents_company on public.ai_agents(company_id);

create table public.agent_channels (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  agent_id uuid not null references public.ai_agents(id) on delete cascade,
  channel public.channel_type not null,
  is_active boolean not null default false,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update, delete on public.agent_channels to authenticated;
grant all on public.agent_channels to service_role;
alter table public.agent_channels enable row level security;

-- ============ KNOWLEDGE ============
create table public.knowledge_bases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  name text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.knowledge_bases to authenticated;
grant all on public.knowledge_bases to service_role;
alter table public.knowledge_bases enable row level security;
create index idx_kb_company on public.knowledge_bases(company_id);

create table public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  title text not null,
  source_type text not null default 'text',
  source_url text,
  storage_path text,
  content text,
  status public.doc_status not null default 'ready',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.knowledge_documents to authenticated;
grant all on public.knowledge_documents to service_role;
alter table public.knowledge_documents enable row level security;
create index idx_kdoc_company on public.knowledge_documents(company_id);

create table public.knowledge_chunks (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  document_id uuid not null references public.knowledge_documents(id) on delete cascade,
  chunk_index int not null default 0,
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.knowledge_chunks to authenticated;
grant all on public.knowledge_chunks to service_role;
alter table public.knowledge_chunks enable row level security;
create index idx_kchunk_company on public.knowledge_chunks(company_id);

-- ============ CHANNELS / NUMBERS ============
create table public.phone_numbers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  phone_number text not null,
  country text not null default 'SA',
  provider text not null default 'generic_sip',
  sip_status public.connection_status not null default 'not_connected',
  provider_status public.connection_status not null default 'not_connected',
  agent_id uuid references public.ai_agents(id) on delete set null,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, phone_number)
);
grant select, insert, update, delete on public.phone_numbers to authenticated;
grant all on public.phone_numbers to service_role;
alter table public.phone_numbers enable row level security;
create index idx_phone_company on public.phone_numbers(company_id);

create table public.whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  provider text not null default 'meta_cloud',
  phone_number text,
  business_account_id text,
  agent_id uuid references public.ai_agents(id) on delete set null,
  status public.connection_status not null default 'not_connected',
  webhook_verify_token text,
  is_active boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.whatsapp_accounts to authenticated;
grant all on public.whatsapp_accounts to service_role;
alter table public.whatsapp_accounts enable row level security;
create index idx_wa_company on public.whatsapp_accounts(company_id);

-- secrets never exposed to the client
create table public.provider_credentials (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  scope text not null,
  provider text not null,
  reference_id uuid,
  secret_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant all on public.provider_credentials to service_role;
alter table public.provider_credentials enable row level security;

-- ============ CUSTOMERS / CONVERSATIONS ============
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.customers to authenticated;
grant all on public.customers to service_role;
alter table public.customers enable row level security;
create index idx_customers_company on public.customers(company_id);

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  agent_id uuid references public.ai_agents(id) on delete set null,
  assigned_user_id uuid references auth.users(id) on delete set null,
  channel public.channel_type not null default 'whatsapp',
  status public.conversation_status not null default 'open',
  subject text,
  summary text,
  external_id text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.conversations to authenticated;
grant all on public.conversations to service_role;
alter table public.conversations enable row level security;
create index idx_conv_company on public.conversations(company_id);
create index idx_conv_created on public.conversations(created_at);
create index idx_conv_status on public.conversations(status);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender public.sender_type not null,
  sender_user_id uuid references auth.users(id) on delete set null,
  body text,
  channel public.channel_type not null default 'whatsapp',
  status text not null default 'sent',
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select, insert, update on public.messages to authenticated;
grant all on public.messages to service_role;
alter table public.messages enable row level security;
create index idx_msg_conv on public.messages(conversation_id);
create index idx_msg_company on public.messages(company_id);

create table public.voice_calls (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  agent_id uuid references public.ai_agents(id) on delete set null,
  phone_number_id uuid references public.phone_numbers(id) on delete set null,
  customer_id uuid references public.customers(id) on delete set null,
  direction text not null default 'inbound',
  from_number text,
  to_number text,
  status public.call_status not null default 'in_progress',
  duration_seconds int not null default 0,
  transferred boolean not null default false,
  provider text,
  provider_call_id text unique,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.voice_calls to authenticated;
grant all on public.voice_calls to service_role;
alter table public.voice_calls enable row level security;
create index idx_calls_company on public.voice_calls(company_id);
create index idx_calls_created on public.voice_calls(created_at);

create table public.call_transcripts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  call_id uuid not null references public.voice_calls(id) on delete cascade,
  transcript jsonb not null default '[]'::jsonb,
  raw_text text,
  created_at timestamptz not null default now()
);
grant select on public.call_transcripts to authenticated;
grant all on public.call_transcripts to service_role;
alter table public.call_transcripts enable row level security;

create table public.call_summaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  call_id uuid not null references public.voice_calls(id) on delete cascade,
  summary text,
  sentiment text,
  topics jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.call_summaries to authenticated;
grant all on public.call_summaries to service_role;
alter table public.call_summaries enable row level security;

-- ============ USAGE / OPS ============
create table public.usage_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  metric text not null,
  quantity numeric(12,2) not null default 0,
  unit text not null default 'unit',
  reference_id uuid,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
grant select on public.usage_records to authenticated;
grant all on public.usage_records to service_role;
alter table public.usage_records enable row level security;
create index idx_usage_company on public.usage_records(company_id);
create index idx_usage_occurred on public.usage_records(occurred_at);

create table public.webhook_events (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  provider text not null,
  event_type text,
  external_event_id text,
  status public.webhook_status not null default 'received',
  payload jsonb not null default '{}'::jsonb,
  error text,
  attempts int not null default 0,
  created_at timestamptz not null default now(),
  processed_at timestamptz,
  unique (provider, external_event_id)
);
grant all on public.webhook_events to service_role;
alter table public.webhook_events enable row level security;
create index idx_webhook_company on public.webhook_events(company_id);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  body text,
  type text not null default 'info',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
grant select, update on public.notifications to authenticated;
grant all on public.notifications to service_role;
alter table public.notifications enable row level security;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  action text not null,
  entity text,
  entity_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_logs to authenticated;
grant all on public.audit_logs to service_role;
alter table public.audit_logs enable row level security;
create index idx_audit_company on public.audit_logs(company_id);

-- ============ TENANT POLICIES ============
do $$
declare t text;
  rw text[] := array['subscriptions','ai_agents','agent_channels','knowledge_bases','knowledge_documents','phone_numbers','whatsapp_accounts','customers','conversations','messages','voice_calls'];
  ro text[] := array['billing_records','knowledge_chunks','call_transcripts','call_summaries','usage_records','audit_logs'];
begin
  foreach t in array rw loop
    execute format('create policy "tenant select" on public.%I for select to authenticated using (public.is_company_member(company_id) or public.is_super_admin())', t);
    execute format('create policy "tenant insert" on public.%I for insert to authenticated with check (public.has_company_role(company_id, array[''owner'',''admin'',''agent'']::public.company_role[]))', t);
    execute format('create policy "tenant update" on public.%I for update to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'',''agent'']::public.company_role[])) with check (public.has_company_role(company_id, array[''owner'',''admin'',''agent'']::public.company_role[]))', t);
    execute format('create policy "tenant delete" on public.%I for delete to authenticated using (public.has_company_role(company_id, array[''owner'',''admin'']::public.company_role[]))', t);
  end loop;
  foreach t in array ro loop
    execute format('create policy "tenant select" on public.%I for select to authenticated using (public.is_company_member(company_id) or public.is_super_admin())', t);
  end loop;
end $$;

create policy "notifications select" on public.notifications for select to authenticated
  using ((user_id = auth.uid() or user_id is null) and public.is_company_member(company_id));
create policy "notifications update" on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============ UPDATED_AT TRIGGERS ============
do $$
declare t text;
begin
  foreach t in array array['profiles','companies','plans','subscriptions','ai_agents','knowledge_bases','knowledge_documents','phone_numbers','whatsapp_accounts','provider_credentials','customers','conversations','voice_calls'] loop
    execute format('create trigger trg_%s_updated before update on public.%I for each row execute function public.set_updated_at()', t, t);
  end loop;
end $$;

-- ============ SIGNUP HANDLER ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, locale)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), new.email,
          coalesce(new.raw_user_meta_data->>'locale','ar'))
  on conflict (id) do nothing;
  return new;
end; $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- ============ SEED PLANS ============
insert into public.plans (code, name_ar, name_en, price_sar, voice_minutes, whatsapp_messages, max_agents, max_phone_numbers, max_members, max_documents, sort_order, features)
values
 ('starter','الباقة الأساسية','Starter',299,500,1000,1,1,3,20,1,'["voice","whatsapp","knowledge_base"]'::jsonb),
 ('business','باقة الأعمال','Business',399,1500,5000,3,2,10,100,2,'["voice","whatsapp","knowledge_base","human_handoff","analytics"]'::jsonb),
 ('pro','الباقة الاحترافية','Pro',599,4000,15000,10,5,25,500,3,'["voice","whatsapp","knowledge_base","human_handoff","analytics","priority_support","api_access"]'::jsonb);
