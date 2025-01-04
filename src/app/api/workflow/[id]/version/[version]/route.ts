import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: Request,
  { params }: { params: { id: string; version: string } }
) {
  try {
    const { id, version } = params

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

      if (latestError || !latestData) {
        console.error('Error fetching latest version:', latestError)
        return NextResponse.json(
          { error: 'Latest version not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({
        workflow: latestData
      })
    }

    // Otherwise, get historical version from workflow_versions
    const { data: versionData, error: versionError } = await supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_id', id)
      .eq('version', version)
      .single()

    if (versionError || !versionData) {
      console.error('Error fetching workflow version:', versionError)
      return NextResponse.json(
        { error: 'Workflow version not found' },
        { status: 404 }
      )
    }

    // Return the version data with the version number
    return NextResponse.json({
      workflow: {
        ...versionData.data,
        id,
        version: parseInt(version)
      }
    })
  } catch (error) {
    console.error('Error loading workflow version:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 