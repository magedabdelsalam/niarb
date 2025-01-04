'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from './ui/card'
import { Button } from './ui/button'
import InputSection from './input-section'
import { LogicSection } from './logic-section'
import { OutputSection } from './output-section'
import { useToast } from '@/hooks/use-toast'
import type { Workflow } from '@/types/workflow'
import { createWorkflow, updateWorkflow, deleteWorkflow, publishWorkflowVersion } from '@/app/actions'
import { subscribeToWorkflow } from '@/lib/supabase'
import { Input } from './ui/input'

const defaultWorkflow: Workflow = {
  id: '',
  name: 'New Workflow',
  input_schema: [],
  input_data: '',
  logic_blocks: [],
  calculations: [],
  output_schema: {},
  ai_model: {
    model_name: ''
  }
}

interface WorkflowPlaygroundProps {
  initialWorkflow?: Workflow
}

export function WorkflowPlayground({ initialWorkflow }: WorkflowPlaygroundProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [workflow, setWorkflow] = useState<Workflow>({
    id: initialWorkflow?.id,
    name: initialWorkflow?.name || '',
    input_schema: initialWorkflow?.input_schema || [],
    input_data: initialWorkflow?.input_data || '',
    logic_blocks: initialWorkflow?.logic_blocks || [],
    calculations: initialWorkflow?.calculations || [],
    output_schema: initialWorkflow?.output_schema || {},
    ai_model: initialWorkflow?.ai_model,
    version: initialWorkflow?.version
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Update workflow when initialWorkflow changes (e.g., after page reload)
  useEffect(() => {
    if (initialWorkflow) {
      setWorkflow(initialWorkflow)
    }
  }, [initialWorkflow])

  const handleInputChange = (input_schema: string[]) => {
    setWorkflow(prev => ({ ...prev, input_schema }))
  }

  const handleInputDataChange = (input_data: string) => {
    console.log('Updating workflow input data:', input_data)
    setWorkflow(prev => ({ ...prev, input_data }))
  }

  const handleWorkflowUpdate = (updates: Partial<Workflow>) => {
    setWorkflow(prev => ({ ...prev, ...updates }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      // Prepare complete workflow data
      const workflowData = {
        name: workflow.name,
        description: workflow.description,
        input_schema: workflow.input_schema,
        input_data: workflow.input_data || '',
        example_dataset: workflow.example_dataset,
        logic_blocks: workflow.logic_blocks,
        calculations: workflow.calculations,
        output_schema: workflow.output_schema,
        ai_model: workflow.ai_model
      }

      console.log('Saving workflow data:', workflowData)

      if (workflow.id) {
        try {
          await updateWorkflow(workflow.id, workflowData, true) // Save as draft
          // After saving, reload the page to get fresh data
          router.refresh()
          toast({
            title: "Success",
            description: "Draft saved successfully"
          })
        } catch (updateError: any) {
          console.error('Error updating workflow:', updateError)
          toast({
            title: "Error",
            description: updateError.message || 'Failed to save',
            variant: "destructive"
          })
        }
      } else {
        try {
          const newWorkflow = await createWorkflow(workflowData)
          console.log('New workflow created:', newWorkflow)
          router.push(`/playground/${newWorkflow.id}`)
          toast({
            title: "Success",
            description: "Workflow created successfully"
          })
        } catch (createError: any) {
          console.error('Error creating workflow:', createError)
          toast({
            title: "Error",
            description: createError.message || 'Failed to create workflow',
            variant: "destructive"
          })
        }
      }
    } catch (error: any) {
      console.error('Error in handleSave:', error)
      toast({
        title: "Error",
        description: error.message || 'Failed to save workflow',
        variant: "destructive"
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handlePublish = async () => {
    try {
      setIsPublishing(true)
      // Prepare complete workflow data
      const workflowData = {
        name: workflow.name,
        input_schema: workflow.input_schema,
        input_data: workflow.input_data || '',
        logic_blocks: workflow.logic_blocks,
        calculations: workflow.calculations,
        output_schema: workflow.output_schema,
        ai_model: workflow.ai_model
      }

      if (workflow.id) {
        await publishWorkflowVersion(workflow.id, workflowData)
        router.refresh()
        toast({
          title: "Success",
          description: "Workflow published successfully"
        })
      }
    } catch (error: any) {
      console.error('Error publishing workflow:', error)
      toast({
        title: "Error",
        description: error.message || 'Failed to publish workflow',
        variant: "destructive"
      })
    } finally {
      setIsPublishing(false)
    }
  }

  const handleDelete = async () => {
    if (!workflow.id) return

    try {
      setIsDeleting(true)
      await deleteWorkflow(workflow.id)
      router.push('/')
      toast({
        title: 'Success',
        description: 'Workflow deleted successfully'
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete workflow',
        variant: 'destructive'
      })
      console.error('Error deleting workflow:', error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <button
          onClick={() => router.push('/')}
          className="text-2xl font-bold hover:opacity-80 transition-opacity"
        >
          NIARB
        </button>
        <Input
          className="w-64 text-xl font-medium text-center"
          value={workflow.name || ''}
          onChange={(e) => handleWorkflowUpdate({ name: e.target.value })}
          placeholder="Enter Workflow Name"
        />
        <div className="space-x-2">
          {workflow.id && (
            <>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
              <Button
                variant="outline"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Save'}
              </Button>
              <Button
                onClick={handlePublish}
                disabled={isPublishing}
              >
                {isPublishing ? 'Publishing...' : 'Publish'}
              </Button>
            </>
          )}
          {!workflow.id && (
            <Button
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Creating...' : 'Create Workflow'}
            </Button>
          )}
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="p-4">
          <InputSection
            workflow={workflow}
            onInputChange={handleInputChange}
            onInputDataChange={handleInputDataChange}
          />
        </Card>
        
        <Card className="p-4 lg:col-span-1">
          <LogicSection
            workflow={workflow}
            onChange={handleWorkflowUpdate}
          />
        </Card>
        
        <Card className="p-4">
          <OutputSection
            workflow={workflow}
            onChange={handleWorkflowUpdate}
          />
        </Card>
      </div>
    </div>
  )
} 