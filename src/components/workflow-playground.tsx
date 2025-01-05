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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select"

const defaultWorkflow: Workflow = {
  id: '',
  name: '',
  input_schema: [],
  input_data: {},
  logic_blocks: [],
  calculations: [],
  output_schema: {}
}

interface WorkflowPlaygroundProps {
  initialWorkflow?: Workflow
}

export function WorkflowPlayground({ initialWorkflow }: WorkflowPlaygroundProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [workflow, setWorkflow] = useState<Workflow>(
    initialWorkflow || defaultWorkflow
  )
  const [isSaving, setIsSaving] = useState(false)
  const [isPublishing, setIsPublishing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isLoadingVersion, setIsLoadingVersion] = useState(false)
  const [isMakingLatest, setIsMakingLatest] = useState(false)
  const [totalVersions, setTotalVersions] = useState(1)

  // Update workflow when initialWorkflow changes (e.g., after page reload)
  useEffect(() => {
    if (initialWorkflow) {
      setWorkflow(initialWorkflow)
      setTotalVersions(initialWorkflow.version || 1)
    }
  }, [initialWorkflow])

  // Subscribe to workflow updates and version changes
  useEffect(() => {
    if (!workflow.id) return

    const subscription = subscribeToWorkflow(workflow.id, (updatedWorkflow) => {
      setWorkflow(updatedWorkflow)
      setTotalVersions(updatedWorkflow.version || 1)
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [workflow.id])

  const handleInputChange = (input_schema: string[]) => {
    setWorkflow(prev => ({ ...prev, input_schema }))
  }

  const handleInputDataChange = (input_data: string) => {
    console.log('Updating workflow input data:', input_data)
    setWorkflow(prev => ({ ...prev, input_data }))
  }

  const handleWorkflowUpdate = (update: Partial<Workflow>) => {
    setWorkflow(prev => ({
      ...prev,
      ...update
    }))
  }

  const handleSave = async () => {
    try {
      setIsSaving(true)
      // Prepare complete workflow data
      const workflowData = {
        name: workflow.name,
        input_schema: workflow.input_schema,
        input_data: workflow.input_data || '',
        logic_blocks: workflow.logic_blocks,
        calculations: workflow.calculations,
        output_schema: workflow.output_schema
      }

      if (workflow.id) {
        await updateWorkflow(workflow.id, workflowData)
        router.refresh()
        toast({
          title: "Success",
          description: "Workflow saved successfully"
        })
      } else {
        const newWorkflow = await createWorkflow(workflowData)
        router.push(`/playground/${newWorkflow.id}`)
        toast({
          title: "Success",
          description: "Workflow created successfully"
        })
      }
    } catch (error: any) {
      console.error('Error saving workflow:', error)
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
        output_schema: workflow.output_schema
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

  const handleVersionChange = async (version: string) => {
    try {
      setIsLoadingVersion(true)
      const response = await fetch(`/api/workflow/${workflow.id}/version/${version}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load version')
      }

      handleWorkflowUpdate(data.workflow)
      toast({
        title: "Success",
        description: `Loaded version ${version}`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to load version',
      })
    } finally {
      setIsLoadingVersion(false)
    }
  }

  const handleMakeLatest = async () => {
    if (!workflow.id || !workflow.version) return

    try {
      setIsMakingLatest(true)
      const response = await fetch(`/api/workflow/${workflow.id}/version/${workflow.version}/make-latest`, {
        method: 'POST'
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to make version latest')
      }

      toast({
        title: "Success",
        description: `Version ${workflow.version} is now the latest version`,
      })
      // Refresh the page to get the updated data
      window.location.reload()
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to make version latest',
      })
    } finally {
      setIsMakingLatest(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/')}
            className="text-2xl font-bold hover:opacity-80 transition-opacity"
        >
          NIARB
        </button>
        <Button
            variant="outline"
            onClick={() => router.push(`/playground/${workflow.id}/live`)}
          >
            Live
          </Button>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Input
              className="w-64 text-xl font-medium text-center"
              value={workflow.name || ''}
              onChange={(e) => handleWorkflowUpdate({ name: e.target.value })}
              placeholder="Enter Workflow Name"
            />
            {workflow.id && (
              <>
                <Select
                  value={String(workflow.version || 1)}
                  onValueChange={handleVersionChange}
                  disabled={isLoadingVersion}
                >
                  <SelectTrigger className="w-[70px]">
                    <SelectValue placeholder="v1" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: totalVersions }, (_, i) => i + 1).map((version) => (
                      <SelectItem key={`version-${version}`} value={String(version)}>
                        v{version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {workflow.version && workflow.version < totalVersions && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMakeLatest}
                    disabled={isMakingLatest}
                  >
                    {isMakingLatest ? 'Making Latest...' : 'Make Latest'}
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

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
                {isPublishing ? 'Publishing...' : `Publish v${(workflow.version || 1) + 1}`}
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