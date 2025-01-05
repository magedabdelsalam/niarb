-- Drop existing triggers
DROP TRIGGER IF EXISTS workflow_version_trigger ON workflows;
DROP TRIGGER IF EXISTS update_workflows_updated_at ON workflows;

-- Create trigger for updated_at
CREATE TRIGGER update_workflows_updated_at
    BEFORE UPDATE ON workflows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create trigger for versioning that only fires when publishing (when version is updated)
CREATE TRIGGER workflow_version_trigger
AFTER UPDATE OF version ON workflows
FOR EACH ROW
WHEN (OLD.version IS DISTINCT FROM NEW.version)
EXECUTE FUNCTION handle_workflow_version();