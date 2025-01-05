CREATE TABLE public.workflow_inputs (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  workflow_id uuid NULL,
  input_data jsonb NOT NULL,
  output_data jsonb NULL,
  logic_data jsonb NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  workflow_version integer NULL,
  CONSTRAINT workflow_inputs_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_inputs_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);

CREATE TABLE public.workflow_versions (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  workflow_id uuid NOT NULL,
  version integer NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT workflow_versions_pkey PRIMARY KEY (id),
  CONSTRAINT workflow_versions_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflows(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS workflow_versions_workflow_id_idx ON public.workflow_versions USING btree (workflow_id);

CREATE TABLE public.workflows (
  id uuid NOT NULL DEFAULT extensions.uuid_generate_v4(),
  name text NOT NULL,
  input_data jsonb NULL DEFAULT '{}'::jsonb,
  input_schema jsonb NULL DEFAULT '[]'::jsonb,
  logic_blocks jsonb NULL DEFAULT '[]'::jsonb,
  calculations jsonb NULL DEFAULT '[]'::jsonb,
  output_schema jsonb NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  created_by uuid NULL,
  version integer NULL DEFAULT 1,
  description text NULL DEFAULT ''::text,
  CONSTRAINT workflows_pkey PRIMARY KEY (id),
  CONSTRAINT workflows_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id)
);
CREATE INDEX IF NOT EXISTS workflows_created_by_idx ON public.workflows USING btree (created_by);

-- Row Level Security Policies
CREATE POLICY "Users can delete their own workflows" ON public.workflows FOR DELETE TO authenticated USING ((select auth.uid()) = created_by);
CREATE POLICY "Users can update their own workflows" ON public.workflows FOR UPDATE TO authenticated USING ((select auth.uid()) = created_by) WITH CHECK ((select auth.uid()) = created_by);
CREATE POLICY "Users can create workflows" ON public.workflows FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = created_by);
CREATE POLICY "Users can view their own workflows" ON public.workflows FOR SELECT TO authenticated USING ((select auth.uid()) = created_by);

-- Functions
CREATE OR REPLACE FUNCTION public.handle_workflow_version() RETURNS trigger AS $$
DECLARE
  version_number integer;
BEGIN
  -- Get the next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO version_number
  FROM workflow_versions
  WHERE workflow_id = NEW.id;

  -- Insert the new version
  INSERT INTO workflow_versions (
    workflow_id,
    version,
    data
  )
  VALUES (
    NEW.id,
    version_number,
    jsonb_build_object(
      'name', NEW.name,
      'input_schema', NEW.input_schema,
      'input_data', NEW.input_data,
      'logic_blocks', NEW.logic_blocks,
      'calculations', NEW.calculations,
      'output_schema', NEW.output_schema
    )
  );

  -- Set the version number in the new record
  NEW.version = version_number;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.try_parse_json(text) RETURNS jsonb AS $$
BEGIN
  RETURN $1::jsonb;
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for versioning
CREATE TRIGGER workflow_version_trigger
AFTER UPDATE OF version ON workflows
FOR EACH ROW
WHEN (OLD.version IS DISTINCT FROM NEW.version)
EXECUTE FUNCTION handle_workflow_version();