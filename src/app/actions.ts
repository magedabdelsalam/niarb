'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@supabase/supabase-js'
import type { Workflow, WorkflowVersion } from '@/types/workflow'

// Create a single supabase client for interacting with your database
function getSupabaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function createWorkflow(workflow: Omit<Workflow, 'id'>) {
  const supabase = getSupabaseClient()
  
  // Ensure input_data is a string
  const input_data = typeof workflow.input_data === 'string' 
    ? workflow.input_data 
    : JSON.stringify(workflow.input_data)

  // Create a new object without ai_model
  const { ai_model, ...workflowData } = workflow

  const { data, error } = await supabase
    .from('workflows')
    .insert([{
      ...workflowData,
      input_data,
      status: 'draft',
      version: 1,
      created_by: null,
      ai_models: ai_model // Add ai_models separately
    }])
    .select()
    .single()

  if (error) throw new Error(error.message)
  
  revalidatePath('/')
  return data as Workflow
}

export async function updateWorkflow(id: string, workflow: Partial<Workflow>, isDraft: boolean = true) {
  const supabase = getSupabaseClient()
  
  try {
    // First get the current workflow to ensure it exists
    const { data: existingWorkflow, error: getError } = await supabase
      .from('workflows')
      .select()
      .eq('id', id)
      .single()

    if (getError) throw new Error(getError.message)
    if (!existingWorkflow) throw new Error('Workflow not found')

    // Ensure input_data is a string
    const input_data = typeof workflow.input_data === 'string' 
      ? workflow.input_data 
      : JSON.stringify(workflow.input_data)

    // Create update data without ai_model
    const { ai_model, ...updateData } = workflow

    // Update with the new data
    const { data, error } = await supabase
      .from('workflows')
      .update({
        ...updateData,
        input_data,
        ai_models: ai_model, // Add ai_models separately
        // Set the draft flag and keep current version for draft saves
        is_saving_draft: isDraft,
        ...(isDraft ? { version: existingWorkflow.version } : {})
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)
    
    revalidatePath('/')
    return data as Workflow
  } catch (error: any) {
    console.error('Error updating workflow:', error)
    throw new Error(error.message || 'Failed to update workflow')
  }
}

export async function getWorkflow(id: string) {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('workflows')
    .select()
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as Workflow
}

export async function getWorkflows() {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('workflows')
    .select()
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as Workflow[]
}

export async function deleteWorkflow(id: string) {
  const supabase = getSupabaseClient()
  
  const { error } = await supabase
    .from('workflows')
    .delete()
    .eq('id', id)

  if (error) throw new Error(error.message)
  
  revalidatePath('/')
}

export async function getWorkflowVersions(workflowId: string) {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('workflow_versions')
    .select()
    .eq('workflow_id', workflowId)
    .order('version', { ascending: false })

  if (error) throw new Error(error.message)
  return data as WorkflowVersion[]
}

export async function restoreWorkflowVersion(workflowId: string, version: WorkflowVersion) {
  const supabase = getSupabaseClient()
  
  const { error: updateError } = await supabase
    .from('workflows')
    .update({
      ...version.data
    })
    .eq('id', workflowId)

  if (updateError) throw new Error(updateError.message)
  
  revalidatePath('/')
}

export async function publishWorkflow(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('workflows')
    .update({ status: 'published' })
    .eq('id', id)

  if (error) throw new Error(error.message)
  
  revalidatePath('/')
}

export async function unpublishWorkflow(id: string) {
  const supabase = getSupabaseClient()
  const { error } = await supabase
    .from('workflows')
    .update({ status: 'draft' })
    .eq('id', id)

  if (error) throw new Error(error.message)
  
  revalidatePath('/')
}

export async function publishWorkflowVersion(id: string, workflow: Partial<Workflow>, comment?: string) {
  const supabase = getSupabaseClient()
  
  try {
    // First get the current workflow to ensure it exists
    const { data: existingWorkflow, error: getError } = await supabase
      .from('workflows')
      .select()
      .eq('id', id)
      .single()

    if (getError) throw new Error(getError.message)
    if (!existingWorkflow) throw new Error('Workflow not found')

    // Ensure input_data is a string
    const input_data = typeof workflow.input_data === 'string' 
      ? workflow.input_data 
      : JSON.stringify(workflow.input_data)

    // Create update data without ai_model
    const { ai_model, ...updateData } = workflow

    // Update the workflow with versioning enabled (will create a new version)
    const { data, error } = await supabase
      .from('workflows')
      .update({
        ...updateData,
        input_data,
        ai_models: ai_model, // Add ai_models separately
        status: 'published'
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw new Error(error.message)

    // If a comment was provided, update the version comment
    if (comment) {
      const { error: versionError } = await supabase
        .from('workflow_versions')
        .update({ comment })
        .eq('workflow_id', id)
        .eq('version', existingWorkflow.version)

      if (versionError) throw new Error(versionError.message)
    }
    
    revalidatePath('/')
    return data as Workflow
  } catch (error: any) {
    console.error('Error publishing workflow:', error)
    throw new Error(error.message || 'Failed to publish workflow')
  }
}

export async function makeLatestVersion(id: string, version: number) {
  const supabase = getSupabaseClient()
  
  try {
    // First get the workflow and version data
    const { data: versionData, error: versionError } = await supabase
      .from('workflow_versions')
      .select('data')
      .eq('workflow_id', id)
      .eq('version', version)
      .single()

    if (versionError) throw new Error(versionError.message)
    if (!versionData) throw new Error('Version not found')

    // Update the current workflow with the version data
    const { error: updateError } = await supabase
      .from('workflows')
      .update({
        ...versionData.data,
        is_saving_draft: true, // Prevent creating a new version
      })
      .eq('id', id)

    if (updateError) throw new Error(updateError.message)
    
    revalidatePath('/')
  } catch (error: any) {
    console.error('Error making version latest:', error)
    throw new Error(error.message || 'Failed to make version latest')
  }
} 