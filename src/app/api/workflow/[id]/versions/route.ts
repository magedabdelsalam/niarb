import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const { id } = await params

    // Check if workflow exists
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('id')
      .eq('id', id)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Get total versions
    const { data: versions, error: versionsError } = await supabase
      .from('workflows')
      .select('version')
      .eq('id', id)
      .order('version', { ascending: false })
      .limit(1)

    if (versionsError) {
      return NextResponse.json(
        { error: 'Failed to fetch versions' },
        { status: 500 }
      )
    }

    const totalVersions = versions?.[0]?.version || 1

    return NextResponse.json({ totalVersions })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    )
  }
} 
