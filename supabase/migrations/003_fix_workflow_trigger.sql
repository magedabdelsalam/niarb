-- Drop existing triggers
DROP TRIGGER IF EXISTS workflow_version_trigger ON workflows;

-- Update the version handling function
CREATE OR REPLACE FUNCTION public.handle_workflow_version() RETURNS trigger AS $$
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

-- Create trigger for versioning that only fires when version is explicitly updated
CREATE TRIGGER workflow_version_trigger
AFTER UPDATE ON workflows
FOR EACH ROW
WHEN (
  OLD.version IS DISTINCT FROM NEW.version AND
  NEW.version IS NOT NULL AND
  OLD.version IS NOT NULL
)
EXECUTE FUNCTION handle_workflow_version(); 