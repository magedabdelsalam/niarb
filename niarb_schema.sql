-- NIARB (AI Workflow Builder) Database Schema
-- Complete SQL script for Supabase deployment
-- This recreates the database structure from the backup

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================

-- Function to update updated_at column automatically
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path TO 'public';

-- Function to handle workflow versioning
CREATE OR REPLACE FUNCTION public.handle_workflow_version()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert the new version with the version number from NEW.version
  INSERT INTO workflow_versions (
    workflow_id,
    version,
    data
  )
  VALUES (
    NEW.id,
    NEW.version,
    jsonb_build_object(
      'name', NEW.name,
      'input_schema', NEW.input_schema,
      'input_data', NEW.input_data,
      'logic_blocks', NEW.logic_blocks,
      'calculations', NEW.calculations,
      'output_schema', NEW.output_schema
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to try parsing JSON safely
CREATE OR REPLACE FUNCTION public.try_parse_json(json_text TEXT)
RETURNS JSONB AS $$
BEGIN
    RETURN jsonb_parse(json_text);
END;
$$ LANGUAGE plpgsql
SET search_path TO 'public';

-- ============================================================
-- MAIN TABLES
-- ============================================================

-- Main workflows table
CREATE TABLE IF NOT EXISTS public.workflows (
    id UUID DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name TEXT NOT NULL,
    input_data JSONB DEFAULT '{}'::jsonb,
    input_schema JSONB DEFAULT '[]'::jsonb,
    logic_blocks JSONB DEFAULT '[]'::jsonb,
    calculations JSONB DEFAULT '[]'::jsonb,
    output_schema JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_by UUID,
    version INTEGER DEFAULT 1,
    description TEXT DEFAULT ''::text,
    PRIMARY KEY (id)
);

-- Workflow versions table for version control
CREATE TABLE IF NOT EXISTS public.workflow_versions (
    id UUID DEFAULT extensions.uuid_generate_v4() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    workflow_id UUID NOT NULL,
    version INTEGER NOT NULL,
    data JSONB DEFAULT '{}'::jsonb NOT NULL,
    PRIMARY KEY (id)
);

-- Workflow inputs table to store execution data
CREATE TABLE IF NOT EXISTS public.workflow_inputs (
    id UUID DEFAULT gen_random_uuid() NOT NULL,
    workflow_id UUID,
    input_data JSONB NOT NULL,
    output_data JSONB,
    logic_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    workflow_version INTEGER,
    PRIMARY KEY (id)
);

-- ============================================================
-- FOREIGN KEY CONSTRAINTS
-- ============================================================

-- Add foreign key constraints
ALTER TABLE ONLY public.workflow_inputs
    ADD CONSTRAINT workflow_inputs_workflow_id_fkey 
    FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workflow_versions
    ADD CONSTRAINT workflow_versions_workflow_id_fkey 
    FOREIGN KEY (workflow_id) REFERENCES public.workflows(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.workflows
    ADD CONSTRAINT workflows_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES auth.users(id);

-- ============================================================
-- INDEXES
-- ============================================================

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS workflow_versions_workflow_id_idx 
ON public.workflow_versions USING btree (workflow_id);

CREATE INDEX IF NOT EXISTS workflows_created_by_idx 
ON public.workflows USING btree (created_by);

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Trigger to automatically update updated_at column
CREATE TRIGGER update_workflows_updated_at 
    BEFORE UPDATE ON public.workflows 
    FOR EACH ROW 
    EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger to handle workflow versioning before update
CREATE TRIGGER handle_workflow_version 
    BEFORE UPDATE ON public.workflows 
    FOR EACH ROW 
    EXECUTE FUNCTION public.handle_workflow_version();

-- Trigger to handle workflow versioning after update when version changes
CREATE TRIGGER workflow_version_trigger 
    AFTER UPDATE ON public.workflows 
    FOR EACH ROW 
    WHEN (((old.version IS DISTINCT FROM new.version) AND (new.version IS NOT NULL) AND (old.version IS NOT NULL))) 
    EXECUTE FUNCTION public.handle_workflow_version();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE public.workflows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_inputs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- Workflows policies - users can only access their own workflows
CREATE POLICY "Users can view their own workflows" 
ON public.workflows FOR SELECT 
USING (auth.uid() = created_by);

CREATE POLICY "Users can create workflows" 
ON public.workflows FOR INSERT 
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own workflows" 
ON public.workflows FOR UPDATE 
USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own workflows" 
ON public.workflows FOR DELETE 
USING (auth.uid() = created_by);

-- Workflow versions policies - inherit from parent workflow
CREATE POLICY "Users can view their workflow versions" 
ON public.workflow_versions FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.workflows 
        WHERE workflows.id = workflow_versions.workflow_id 
        AND workflows.created_by = auth.uid()
    )
);

CREATE POLICY "Users can create workflow versions" 
ON public.workflow_versions FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workflows 
        WHERE workflows.id = workflow_versions.workflow_id 
        AND workflows.created_by = auth.uid()
    )
);

-- Workflow inputs policies - inherit from parent workflow
CREATE POLICY "Users can view their workflow inputs" 
ON public.workflow_inputs FOR SELECT 
USING (
    EXISTS (
        SELECT 1 FROM public.workflows 
        WHERE workflows.id = workflow_inputs.workflow_id 
        AND workflows.created_by = auth.uid()
    )
);

CREATE POLICY "Users can create workflow inputs" 
ON public.workflow_inputs FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.workflows 
        WHERE workflows.id = workflow_inputs.workflow_id 
        AND workflows.created_by = auth.uid()
    )
);

CREATE POLICY "Users can update their workflow inputs" 
ON public.workflow_inputs FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.workflows 
        WHERE workflows.id = workflow_inputs.workflow_id 
        AND workflows.created_by = auth.uid()
    )
);

CREATE POLICY "Users can delete their workflow inputs" 
ON public.workflow_inputs FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.workflows 
        WHERE workflows.id = workflow_inputs.workflow_id 
        AND workflows.created_by = auth.uid()
    )
);

-- ============================================================
-- PERMISSIONS
-- ============================================================

-- Grant necessary permissions to Supabase roles
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================
-- REALTIME
-- ============================================================

-- Enable realtime for the tables (optional)
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.workflows;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_versions;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.workflow_inputs;

-- ============================================================
-- COMMENTS
-- ============================================================

COMMENT ON TABLE public.workflows IS 'Main table storing AI workflow definitions and configurations';
COMMENT ON TABLE public.workflow_versions IS 'Version control for workflows, storing historical snapshots';
COMMENT ON TABLE public.workflow_inputs IS 'Execution logs and data for workflow runs';

COMMENT ON COLUMN public.workflows.logic_blocks IS 'JSON array containing the workflow logic blocks/nodes';
COMMENT ON COLUMN public.workflows.input_schema IS 'JSON schema defining expected input structure';
COMMENT ON COLUMN public.workflows.output_schema IS 'JSON schema defining output structure';
COMMENT ON COLUMN public.workflows.calculations IS 'JSON array containing calculation definitions';

-- ============================================================
-- SETUP COMPLETE
-- ============================================================

-- This completes the NIARB database schema setup
-- The database is now ready for use with proper RLS policies and permissions
