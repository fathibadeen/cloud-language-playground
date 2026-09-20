create table public.connection_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  channel channel_type not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text,
  reviewed_by uuid references auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index connection_requests_company_idx on public.connection_requests (company_id, created_at desc);
create index connection_requests_pending_idx on public.connection_requests (status) where status = 'pending';

grant select, insert on public.connection_requests to authenticated;
grant all on public.connection_requests to service_role;

alter table public.connection_requests enable row level security;

create policy "Members can read own company requests"
  on public.connection_requests for select to authenticated
  using (public.is_company_member(company_id));

create policy "Owners and admins can create requests"
  on public.connection_requests for insert to authenticated
  with check (public.has_company_role(company_id, array['owner','admin']::company_role[]));

create trigger trg_connection_requests_updated before update on public.connection_requests
  for each row execute function public.set_updated_at();