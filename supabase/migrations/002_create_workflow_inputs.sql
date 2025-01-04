create table if not exists workflow_inputs (
  id uuid default gen_random_uuid() primary key,
  workflow_id uuid references workflows(id) on delete cascade,
  input_data jsonb not null,
  created_at timestamptz default now() not null
); 