'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { formatDistanceToNow } from 'date-fns'
import type { WorkflowData } from '@/types/workflow'
import { subscribeToWorkflows } from '@/lib/supabase'

interface WorkflowListProps {
  initialWorkflows: WorkflowData[]
}

export function WorkflowList({ initialWorkflows }: WorkflowListProps) {
  const [workflows, setWorkflows] = useState(initialWorkflows)

  useEffect(() => {
    const subscription = subscribeToWorkflows((updatedWorkflows) => {
      setWorkflows(updatedWorkflows)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return (
    <div className="grid gap-4">
      {workflows?.map((workflow) => (
        <Link
          key={workflow.id}
          href={`/playground/${workflow.id}`}
          className="block"
        >
          <div className="border rounded-lg p-4 hover:bg-accent transition-colors">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">{workflow.name}</h2>
              <span className="text-sm text-muted-foreground">
                {workflow.updated_at
                  ? `Updated ${formatDistanceToNow(new Date(workflow.updated_at))} ago`
                  : 'Just created'}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {workflow.input_schema?.length || 0} inputs · {workflow.logic_blocks?.length || 0} logic blocks · {workflow.calculations?.length || 0} calculations
            </p>
          </div>
        </Link>
      ))}

      {(!workflows || workflows.length === 0) && (
        <div className="text-center py-12">
          <h3 className="text-lg font-medium">No workflows yet</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Create your first workflow to get started
          </p>
        </div>
      )}
    </div>
  )
} 