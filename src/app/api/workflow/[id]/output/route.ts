import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { processWorkflow } from '../../../../../lib/workflow'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const { searchParams } = new URL(request.url)
    const inputId = searchParams.get('input_id')

    if (!inputId) {
      return NextResponse.json(
        { error: 'Input ID is required' },
        { status: 400 }
      )
    }

    // Get workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (workflowError || !workflow) {
      console.error('Error fetching workflow:', workflowError)
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    console.log('Retrieved workflow:', workflow)

    // Get input data
    const { data: input, error: inputError } = await supabase
      .from('workflow_inputs')
      .select('*')
      .eq('id', inputId)
      .eq('workflow_id', id)
      .single()

    if (inputError || !input) {
      console.error('Error fetching input:', inputError)
      return NextResponse.json(
        { error: 'Input not found' },
        { status: 404 }
      )
    }

    console.log('Retrieved input:', input)

    // Process workflow
    const output = processWorkflow(workflow, input.input_data)
    console.log('Processed output:', output)

    return NextResponse.json({ output })
  } catch (error) {
    console.error('Error processing workflow:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 