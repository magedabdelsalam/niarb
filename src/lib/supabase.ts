import { createClient } from '@supabase/supabase-js'
import type { Workflow } from '@/types/workflow'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export function subscribeToWorkflow(
  workflowId: string,
  onUpdate: (workflow: Workflow) => void
) {
  return supabase
    .channel(`workflow:${workflowId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'workflows',
        filter: `id=eq.${workflowId}`,
      },
      async (payload) => {
        // Fetch the latest data to ensure we have everything
        const { data } = await supabase
          .from('workflows')
          .select()
          .eq('id', workflowId)
          .single()
        
        if (data) {
          console.log('Subscription received update:', data)
          onUpdate(data as Workflow)
        }
      }
    )
    .subscribe()
}

export function subscribeToWorkflows(
  onUpdate: (workflows: Workflow[]) => void
) {
  return supabase
    .channel('workflows')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'workflows',
      },
      async () => {
        // Fetch the updated list
        const { data } = await supabase
          .from('workflows')
          .select()
          .order('created_at', { ascending: false })
        
        if (data) {
          onUpdate(data as Workflow[])
        }
      }
    )
    .subscribe()
} 