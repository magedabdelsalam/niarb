-- Enable the pgvector extension for potential AI features
create extension if not exists "uuid-ossp";

-- Create enum for workflow status
create type workflow_status as enum ('draft', 'published');

-- Create workflows table
create table workflows (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  input_data text default '',
  input_schema jsonb default '[]'::jsonb,
  logic_blocks jsonb default '[]'::jsonb,
  calculations jsonb default '[]'::jsonb,
  output_schema jsonb default '{}'::jsonb,
  ai_model jsonb default null,
  status workflow_status default 'draft',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id),
  version integer default 1,
  is_saving_draft boolean default false
);

-- Create versions table for workflow versioning
create table workflow_versions (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid references workflows(id) on delete cascade,
  version integer not null,
  data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  created_by uuid references auth.users(id),
  comment text
);

-- Create index for faster queries
create index workflows_created_by_idx on workflows(created_by);
create index workflows_status_idx on workflows(status);
create index workflow_versions_workflow_id_idx on workflow_versions(workflow_id);

-- Create function to update updated_at timestamp
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger update_workflows_updated_at
  before update on workflows
  for each row
  execute function update_updated_at_column();

-- Create function to store workflow version
create or replace function store_workflow_version()
returns trigger as $$
declare
  version_data jsonb;
begin
  -- Skip versioning if this is a draft save
  if new.is_saving_draft then
    -- Reset the flag
    new.is_saving_draft = false;
    return new;
  end if;

  if (tg_op = 'UPDATE') then
    -- Build version data object with null checks
    version_data = jsonb_build_object(
      'name', old.name,
      'input_data', coalesce(old.input_data, ''),
      'input_schema', coalesce(old.input_schema, '[]'::jsonb),
      'logic_blocks', coalesce(old.logic_blocks, '[]'::jsonb),
      'calculations', coalesce(old.calculations, '[]'::jsonb),
      'output_schema', coalesce(old.output_schema, '{}'::jsonb),
      'status', old.status
    );

    -- Add ai_model only if it exists
    if (select true from information_schema.columns 
        where table_name = 'workflows' 
        and column_name = 'ai_model') then
      version_data = version_data || 
        jsonb_build_object('ai_model', coalesce(old.ai_model, 'null'::jsonb));
    end if;

    -- Store the previous version
    insert into workflow_versions (
      workflow_id,
      version,
      data,
      created_by
    ) values (
      old.id,
      old.version,
      version_data,
      old.created_by
    );
    -- Increment version number
    new.version = old.version + 1;
  end if;
  return new;
end;
$$ language plpgsql;

-- Create trigger to automatically store versions
create trigger store_workflow_version_trigger
  before update on workflows
  for each row
  execute function store_workflow_version();

-- Temporarily disable RLS for development
alter table workflows disable row level security;
alter table workflow_versions disable row level security;

-- Create policies for workflows
create policy "Users can view their own workflows"
  on workflows for select
  using (auth.uid() = created_by);

create policy "Users can create workflows"
  on workflows for insert
  with check (auth.uid() = created_by);

create policy "Users can update their own workflows"
  on workflows for update
  using (auth.uid() = created_by);

create policy "Users can delete their own workflows"
  on workflows for delete
  using (auth.uid() = created_by);

-- Create policies for workflow versions
create policy "Users can view versions of their workflows"
  on workflow_versions for select
  using (exists (
    select 1 from workflows
    where workflows.id = workflow_versions.workflow_id
    and workflows.created_by = auth.uid()
  ));

-- Remove the old enable/disable functions since we're not using them anymore
drop function if exists disable_workflow_versioning();
drop function if exists enable_workflow_versioning();

-- Grant execute permissions on the functions
grant execute on function disable_workflow_versioning to authenticated;
grant execute on function enable_workflow_versioning to authenticated; 