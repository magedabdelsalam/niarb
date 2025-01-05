import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/supabase'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const url = new URL(request.url)
    const version = url.searchParams.get('version')

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()

    // Get the workflow data based on version
    let workflow
    if (version) {
      const versionNumber = parseInt(version)
      console.log('Looking up version:', { workflowId: id, versionNumber })
      
      // First, check if we have duplicate versions
      const { data: allVersions, error: versionsError } = await supabase
        .from('workflow_versions')
        .select('*')
        .eq('workflow_id', id)
        .eq('version', versionNumber)
        .order('created_at', { ascending: false })

      if (versionsError) {
        console.error('Version lookup error:', versionsError)
        return NextResponse.json(
          { error: 'Error looking up version' },
          { status: 500 }
        )
      }

      if (!allVersions || allVersions.length === 0) {
        console.error('No versions found')
        return NextResponse.json(
          { error: 'Version not found' },
          { status: 404 }
        )
      }

      console.log(`Found ${allVersions.length} entries for version ${versionNumber}:`, 
        allVersions.map(v => ({ id: v.id, created_at: v.created_at })))
      
      // Use the most recent version
      workflow = allVersions[0].data
    } else {
      const { data: workflowData, error: workflowError } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', id)
        .single()

      if (workflowError || !workflowData) {
        return NextResponse.json(
          { error: 'Workflow not found' },
          { status: 404 }
        )
      }
      workflow = workflowData
    }

    // Ensure we have a proper JSON object
    let inputData: Record<string, any>
    try {
      // If it's a string that looks like JSON, parse it
      if (typeof body === 'string') {
        inputData = JSON.parse(body)
      } 
      // If it's already an object but might be stringified JSON
      else if (typeof body === 'object' && body !== null) {
        if (typeof body.input_data === 'string') {
          inputData = JSON.parse(body.input_data)
        } else {
          inputData = body.input_data || body
        }
      } else {
        throw new Error('Invalid input data format')
      }

      // Validate that we have a proper object
      if (typeof inputData !== 'object' || inputData === null) {
        throw new Error('Input data must be a valid JSON object')
      }
    } catch (e) {
      console.error('Error parsing input data:', e)
      return NextResponse.json(
        { error: 'Invalid input data format' },
        { status: 400 }
      )
    }

    // Store the input data with version information
    const { data, error } = await supabase
      .from('workflow_inputs')
      .insert({
        workflow_id: id,
        workflow_version: version ? parseInt(version) : workflow.version,
        input_data: inputData,
        output_data: null,
        logic_data: null
      })
      .select()
      .single()

    if (error) {
      console.error('Error storing input data:', error)
      return NextResponse.json(
        { error: 'Failed to store input data' },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      message: 'Input data stored successfully',
      input_id: data.id
    })
  } catch (error: any) {
    console.error('Error processing input:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 