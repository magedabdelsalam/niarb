import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; version: string }> }
) {
  try {
    const { id, version } = await params

    // Get current workflow to check latest version
    const { data: currentWorkflow, error: currentError } = await supabase
      .from('workflows')
      .select('version')
      .eq('id', id)
      .single()

    if (currentError) {
      console.error('Error fetching current workflow:', currentError)
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // If requesting the latest version, get it from workflows table
    if (parseInt(version) === currentWorkflow.version) {
      const { data: latestData, error: latestError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single()

      if (latestError) {
        return NextResponse.json(
          { error: 'Failed to fetch latest version' },
          { status: 500 }
        )
      }

      return NextResponse.json({ workflow: latestData })
    }

    // Otherwise, get the specific version from workflow_versions
    const { data: versionData, error: versionError } = await supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_id', id)
      .eq('version', parseInt(version))
      .single()

    if (versionError) {
      return NextResponse.json(
        { error: 'Failed to fetch version' },
        { status: 500 }
      )
    }

    return NextResponse.json({ workflow: versionData })
  } catch (error: any) {
    console.error('Error fetching workflow version:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 