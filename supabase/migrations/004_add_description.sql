-- Add description column to workflows table
alter table workflows 
add column if not exists description text default '';

-- Update store_workflow_version function to include description
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
      'description', coalesce(old.description, ''),
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