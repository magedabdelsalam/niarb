'use server'

import { createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { Workflow } from '@/types/workflow'

export async function getWorkflow(id: string) {
  const supabase = createClient()
  const { data: workflow, error } = await supabase
    .from('workflows')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error fetching workflow:', error)
    throw error
  }

  // Parse input_data if it's a string
  if (workflow.input_data && typeof workflow.input_data === 'string') {
    try {
      workflow.input_data = JSON.parse(workflow.input_data)
    } catch (e) {
      console.error('Error parsing input_data:', e)
      // If parsing fails, return the original string
      workflow.input_data = workflow.input_data
    }
  }

  return workflow
}

export async function getWorkflows() {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workflows')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching workflows:', error)
    throw error
  }

  return data
}

export async function createWorkflow(workflow: Partial<Workflow>) {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('workflows')
    .insert(workflow)
    .select()
    .single()

  if (error) {
    console.error('Error creating workflow:', error)
    throw error
  }

  revalidatePath('/')
  return data
}

export async function updateWorkflow(id: string, workflow: Partial<Workflow>) {
  const supabase = createClient()

  // Parse input_data if it's a string
  let parsedInputData = workflow.input_data
  if (typeof workflow.input_data === 'string') {
    try {
      parsedInputData = JSON.parse(workflow.input_data)
    } catch (e) {
      console.error('Error parsing input_data:', e)
      parsedInputData = workflow.input_data
    }
  }

  // Update the workflow directly without affecting version
  const { error: workflowError } = await supabase
    .from('workflows')
    .update({
      name: workflow.name,
      input_schema: workflow.input_schema,
      input_data: parsedInputData,
      logic_blocks: workflow.logic_blocks,
      calculations: workflow.calculations,
      output_schema: workflow.output_schema
    })
    .eq('id', id)

  if (workflowError) {
    console.error('Error updating workflow:', workflowError)
    throw workflowError
  }

  revalidatePath('/')
}

export async function publishWorkflowVersion(id: string, workflow: Partial<Workflow>) {
  const supabase = createClient()

  // First get the current version number
  const { data: currentWorkflow, error: currentError } = await supabase
    .from('workflows')
    .select('version')
    .eq('id', id)
    .single()

  if (currentError) {
    console.error('Error fetching current workflow:', currentError)
    throw currentError
  }

  const newVersion = (currentWorkflow?.version || 0) + 1

  // Parse input_data if it's a string
  let parsedInputData = workflow.input_data
  if (typeof workflow.input_data === 'string') {
    try {
      parsedInputData = JSON.parse(workflow.input_data)
    } catch (e) {
      console.error('Error parsing input_data:', e)
      parsedInputData = workflow.input_data
    }
  }

  // Create a clean version of the workflow data
  const versionData = {
    name: workflow.name,
    input_schema: workflow.input_schema,
    input_data: parsedInputData,
    logic_blocks: workflow.logic_blocks,
    calculations: workflow.calculations,
    output_schema: workflow.output_schema
  }

  // Create a new version
  const { error: versionError } = await supabase
    .from('workflow_versions')
    .insert({
      workflow_id: id,
      version: newVersion,
      data: versionData // Store the entire workflow data as a clean JSON object
    })

  if (versionError) {
    console.error('Error creating version:', versionError)
    throw versionError
  }

  // Update the current workflow with the new version number
  const { error } = await supabase
    .from('workflows')
    .update({
      version: newVersion
    })
    .eq('id', id)

  if (error) {
    console.error('Error updating workflow version:', error)
    throw error
  }

  revalidatePath('/')
}

export async function makeLatestVersion(id: string, version: number) {
  const supabase = createClient()
  
  // First get the version data
  const { data: versionData, error: versionError } = await supabase
    .from('workflow_versions')
    .select('*')
    .eq('workflow_id', id)
    .eq('version', version)
    .single()

  if (versionError) {
    console.error('Error fetching version:', versionError)
    throw versionError
  }

  if (!versionData) {
    throw new Error('Version not found')
  }

  // Update the workflow with the version data
  const { error: updateError } = await supabase
    .from('workflows')
    .update({
      name: versionData.name,
      input_schema: versionData.input_schema,
      input_data: versionData.input_data,
      logic_blocks: versionData.logic_blocks,
      calculations: versionData.calculations,
      output_schema: versionData.output_schema,
      version: versionData.version
    })
    .eq('id', id)

  if (updateError) {
    console.error('Error updating workflow:', updateError)
    throw updateError
  }

  revalidatePath('/')
}

export async function deleteWorkflow(id: string) {
  const supabase = createClient()

  try {
    // First delete all workflow versions
    const { error: versionsError } = await supabase
      .from('workflow_versions')
      .delete()
      .eq('workflow_id', id)

    if (versionsError) {
      console.error('Error deleting workflow versions:', versionsError)
      throw versionsError
    }

    // Then delete all workflow inputs
    const { error: inputsError } = await supabase
      .from('workflow_inputs')
      .delete()
      .eq('workflow_id', id)

    if (inputsError) {
      console.error('Error deleting workflow inputs:', inputsError)
      throw inputsError
    }

    // Finally delete the workflow itself
    const { error: workflowError } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id)

    if (workflowError) {
      console.error('Error deleting workflow:', workflowError)
      throw workflowError
    }

    revalidatePath('/')
  } catch (error) {
    console.error('Error in deleteWorkflow:', error)
    throw error
  }
} 