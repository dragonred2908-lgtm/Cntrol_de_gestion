-- ============================================================
-- NÚCLEO CONTROL — Esquema Postgres con Row Level Security
-- Compatible con Supabase (auth.uid()) o Postgres autogestionado.
-- Fase 2: todavía NO está conectado a la app.
-- ============================================================

create type user_role as enum ('admin', 'developer', 'operator', 'viewer');
create type order_status as enum ('recibida', 'en_cuenta', 'en_proceso', 'finalizada');
create type order_priority as enum ('baja', 'media', 'alta', 'urgente');
create type order_origin as enum ('telegram', 'web');
create type member_status as enum ('activo', 'ausente', 'inactivo');
create type activity_type as enum (
  'order_created', 'status_change', 'assigned', 'reminder_sent',
  'telegram_sync', 'security', 'member'
);

-- ---------- Tablas ----------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  role user_role not null default 'operator',
  email text,
  telegram_user text unique,
  telegram_chat_id bigint,
  status member_status not null default 'activo',
  color text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now()
);

create table orders (
  id text primary key,
  title text not null,
  description text not null default '',
  status order_status not null default 'recibida',
  priority order_priority not null default 'media',
  origin order_origin not null default 'web',
  assigned_to uuid references profiles (id) on delete set null,
  created_by uuid references profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  due_date timestamptz not null,
  completed_at timestamptz,
  department text,
  telegram_message_id bigint,
  telegram_chat_id bigint,
  reminders_count integer not null default 0,
  last_reminder_at timestamptz
);

create table order_notes (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references orders (id) on delete cascade,
  author_id uuid references profiles (id) on delete set null,
  author_name text not null,
  text text not null,
  created_at timestamptz not null default now()
);

create table activity (
  id uuid primary key default gen_random_uuid(),
  timestamp timestamptz not null default now(),
  actor text not null,
  action text not null,
  order_id text references orders (id) on delete set null,
  order_title text,
  details text not null default '',
  type activity_type not null
);

create index orders_status_idx on orders (status);
create index orders_assigned_idx on orders (assigned_to);
create index orders_due_idx on orders (due_date);
create index order_notes_order_idx on order_notes (order_id);
create index activity_timestamp_idx on activity (timestamp desc);

-- ---------- Helpers ----------

create or replace function current_user_role()
returns user_role
language sql
stable
security definer
set search_path = public
as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function can_manage_orders()
returns boolean
language sql
stable
as $$
  select current_user_role() in ('admin', 'developer');
$$;

-- ---------- RLS ----------

alter table profiles enable row level security;
alter table orders enable row level security;
alter table order_notes enable row level security;
alter table activity enable row level security;

-- Nadie anónimo lee nada; el server usa service_role (bypassa RLS).
revoke all on profiles, orders, order_notes, activity from anon;

-- Perfiles: todos los autenticados leen; solo admin/developer escriben.
create policy profiles_select on profiles
  for select to authenticated using (true);

create policy profiles_write on profiles
  for all to authenticated
  using (can_manage_orders())
  with check (can_manage_orders());

-- Órdenes: admin/developer/viewer ven todo; el operador solo lo asignado.
create policy orders_select on orders
  for select to authenticated
  using (
    current_user_role() in ('admin', 'developer', 'viewer')
    or assigned_to = auth.uid()
  );

create policy orders_insert on orders
  for insert to authenticated
  with check (can_manage_orders());

create policy orders_update on orders
  for update to authenticated
  using (can_manage_orders() or assigned_to = auth.uid())
  with check (can_manage_orders() or assigned_to = auth.uid());

create policy orders_delete on orders
  for delete to authenticated
  using (can_manage_orders());

-- Notas: se ven si se ve la orden; el operador asignado puede agregar.
create policy notes_select on order_notes
  for select to authenticated
  using (
    exists (
      select 1 from orders o
      where o.id = order_notes.order_id
        and (
          current_user_role() in ('admin', 'developer', 'viewer')
          or o.assigned_to = auth.uid()
        )
    )
  );

create policy notes_insert on order_notes
  for insert to authenticated
  with check (
    exists (
      select 1 from orders o
      where o.id = order_notes.order_id
        and (can_manage_orders() or o.assigned_to = auth.uid())
    )
  );

-- Auditoría: solo lectura para admin/developer; escribe el servidor.
create policy activity_select on activity
  for select to authenticated
  using (current_user_role() in ('admin', 'developer'));
