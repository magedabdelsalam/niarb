import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const body = await request.json()

    // Store the input data in Supabase
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Ensure input data is properly formatted
    const inputData = typeof body === 'string' ? body : JSON.stringify(body)

    // Store the input data
    const { data, error } = await supabase
      .from('workflow_inputs')
      .insert({
        workflow_id: id,
        input_data: inputData,
        output_data: null, // Reset output data when input changes
        logic_data: null // Reset logic data when input changes
      })
      .select()
      .single()

    if (error) {
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