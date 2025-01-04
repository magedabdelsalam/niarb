import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
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

    // Store the input data
    const { data, error } = await supabase
      .from('workflow_inputs')
      .insert({
        workflow_id: id,
        input_data: body
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
  } catch (error) {
    console.error('Error processing input:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 