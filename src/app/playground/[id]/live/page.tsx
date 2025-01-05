import { createClient } from '@/utils/supabase/server'
import { notFound } from 'next/navigation'
import LivePageContent from './live-content'

async function getWorkflow(id: string, version?: string) {
  const supabase = createClient()

  if (version) {
    // Get specific version from workflow_versions
    const { data: versionData, error: versionError } = await supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_id', id)
      .eq('version', version)
      .single()

    if (versionError) {
      console.error('Error fetching workflow version:', versionError)
      return null
    }

    if (versionData) {
      return {
        id,
        name: versionData.name,
        input_schema: versionData.input_schema,
        input_data: versionData.input_data,
        logic_blocks: versionData.logic_blocks,
        calculations: versionData.calculations,
        output_schema: versionData.output_schema,
        version: parseInt(version),
        created_at: versionData.created_at
      }
    }
  }

  // Get latest version if no version specified or version not found
  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching workflow:', error)
    return null
  }

  return workflow
}

async function getLiveData(id: string) {
  const supabase = createClient()
  const { data: inputs, error } = await supabase
    .from('workflow_inputs')
    .select('*')
    .eq('workflow_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    console.error('Error fetching live data:', error)
    return []
  }

  return inputs
}

interface PageProps {
  params: Promise<{ id: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export default async function LivePage({ params, searchParams }: PageProps) {
  const { id } = await params
  const { version } = await searchParams as { version?: string }
  const workflow = await getWorkflow(id, version)
  const inputs = await getLiveData(id)

  if (!workflow) {
    notFound()
  }

  return <LivePageContent workflow={workflow} inputs={inputs} />
} 