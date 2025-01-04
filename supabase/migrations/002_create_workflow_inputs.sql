-- Drop existing table if it exists
drop table if exists workflow_inputs cascade;

-- Create the table with all columns
create table workflow_inputs (
  id uuid default gen_random_uuid() primary key,
  workflow_id uuid references workflows(id) on delete cascade,
  input_data jsonb not null,
  output_data jsonb,
  logic_data jsonb,
  created_at timestamptz default now() not null
); 

-- Disable RLS for development
alter table workflow_inputs disable row level security;

-- Grant access to the service role
grant all privileges on table workflow_inputs to service_role; 