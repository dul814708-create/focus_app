create table if not exists sessions (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users(id),
  type text not null check (type in ('focus', 'checkin')),
  task_name text,
  planned_minutes integer,
  actual_minutes integer,
  completed boolean,
  note text,
  created_at timestamptz not null default now()
);

alter table sessions enable row level security;

create policy "individual access"
  on sessions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
