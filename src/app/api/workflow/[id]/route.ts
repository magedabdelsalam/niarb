import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Database } from '@/types/supabase'

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    const body = await request.json()
    const shouldCreateVersion = body.create_version === true
    delete body.create_version
    delete body.version // Remove version from body to prevent unintended updates

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get current workflow
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

    // Update workflow
    const updateData = shouldCreateVersion
      ? {
          ...body,
          version: (currentWorkflow.version || 1) + 1
        }
      : body

    const { data: workflow, error: updateError } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating workflow:', updateError)
      return NextResponse.json(
        { error: 'Failed to update workflow' },
        { status: 500 }
      )
    }

    return NextResponse.json({ workflow })
  } catch (error: any) {
    console.error('Error updating workflow:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Delete workflow
    const { error: deleteError } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting workflow:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete workflow' },
        { status: 500 }
      )
    }

    return NextResponse.json({ message: 'Workflow deleted successfully' })
  } catch (error: any) {
    console.error('Error deleting workflow:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient()

    // Get workflow
    const { data: workflow, error: getError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (getError) {
      console.error('Error fetching workflow:', getError)
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ workflow })
  } catch (error: any) {
    console.error('Error fetching workflow:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
} 
