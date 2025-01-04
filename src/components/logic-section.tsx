'use client'

import { useState, useEffect } from 'react'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { Input } from './ui/input'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from './ui/command'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Check, ChevronsUpDown, GripVertical, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InputNameField } from './input-name-field'
import type { Workflow, LogicBlock, Condition, Calculation } from '@/types/workflow'
import { Card } from './ui/card'
import { DragDropContext, Droppable, Draggable, DropResult, DroppableProvided, DraggableProvided, DraggableStateSnapshot } from '@hello-pangea/dnd'
import { useToast } from '@/hooks/use-toast'
import { makeLatestVersion } from '@/app/actions'
import { Label } from './ui/label'
import { getAllPaths } from '@/lib/utils'
import { Combobox } from '@/components/ui/combobox'
import { Textarea } from '@/components/ui/textarea'

interface LogicSectionProps {
  workflow: Workflow
  onChange: (updates: Partial<Workflow>) => void
}

const InputNameCombobox = ({ 
  value, 
  onChange, 
  inputSchema 
}: { 
  value: string, 
  onChange: (value: string) => void,
  inputSchema: string[]
}) => {
  const [open, setOpen] = useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[300px] justify-between"
        >
          {value || "Select input..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0">
        <Command>
          <CommandInput placeholder="Search input..." />
          <CommandEmpty>No input found.</CommandEmpty>
          <CommandGroup>
            {inputSchema.map((input) => (
              <CommandItem
                key={input}
                value={input}
                onSelect={(currentValue) => {
                  onChange(currentValue)
                  setOpen(false)
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === input ? "opacity-100" : "opacity-0"
                  )}
                />
                {input}
              </CommandItem>
            ))}
          </CommandGroup>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export function LogicSection({ workflow, onChange }: LogicSectionProps) {
  const { toast } = useToast()
  const [isLoadingVersion, setIsLoadingVersion] = useState(false)
  const [isMakingLatest, setIsMakingLatest] = useState(false)
  const [totalVersions, setTotalVersions] = useState(workflow.version || 1)
  const [parsedInput, setParsedInput] = useState<Record<string, any>>({})
  const [isGenerating, setIsGenerating] = useState(false)
  const [aiModel, setAiModel] = useState(workflow.ai_model || {
    model_name: '',
    api_key: '',
    is_auto_generated: false
  })

  // Load AI model config from local storage on mount
  useEffect(() => {
    const savedConfig = localStorage.getItem('ai_model_config')
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig)
        setAiModel(prev => ({
          ...prev,
          model_name: config.model_name || prev.model_name,
          api_key: config.api_key || prev.api_key
        }))
        // Also update the workflow
        onChange({
          ai_model: {
            ...workflow.ai_model,
            model_name: config.model_name || workflow.ai_model?.model_name || '',
            api_key: config.api_key || workflow.ai_model?.api_key || ''
          }
        })
      } catch (error) {
        console.error('Error loading AI config:', error)
      }
    }
  }, [])

  // Save AI model config to local storage when it changes
  useEffect(() => {
    if (aiModel.model_name || aiModel.api_key) {
      localStorage.setItem('ai_model_config', JSON.stringify({
        model_name: aiModel.model_name,
        api_key: aiModel.api_key
      }))
    }
  }, [aiModel.model_name, aiModel.api_key])

  // Update AI model when workflow changes
  useEffect(() => {
    setAiModel(workflow.ai_model || {
      model_name: '',
      api_key: '',
      is_auto_generated: false
    })
  }, [workflow.ai_model])

  const handleGenerateWorkflow = async () => {
    if (!workflow.description || !workflow.input_data || !aiModel.model_name || !aiModel.api_key) {
      toast({
        variant: "destructive",
        title: "Missing Information",
        description: "Please provide workflow description, example dataset (text or file), model name, and API key",
      })
      return
    }

    try {
      setIsGenerating(true)
      
      // Call the API to generate the workflow
      const response = await fetch('/api/workflow/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          description: workflow.description,
          input_data: workflow.input_data,
          model_name: aiModel.model_name,
          api_key: aiModel.api_key
        })
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || 'Failed to generate workflow')
      }

      const result = await response.json()
      
      // Update the workflow with the generated logic
      const updatedAiModel = { ...aiModel, is_auto_generated: true }
      onChange({
        ai_model: updatedAiModel,
        logic_blocks: result.logic_blocks,
        calculations: result.calculations,
        output_schema: result.output_schema
      })

      toast({
        title: "Success",
        description: "Workflow generated successfully!",
      })
    } catch (error: any) {
      console.error('Error generating workflow:', error)
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to generate workflow",
      })
    } finally {
      setIsGenerating(false)
    }
  }

  // Fetch total versions when component mounts or workflow ID changes
  useEffect(() => {
    async function fetchTotalVersions() {
      if (!workflow.id) {
        setTotalVersions(1)
        return
      }

      try {
        const response = await fetch(`/api/workflow/${workflow.id}/versions`)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch versions')
        }

        setTotalVersions(data.totalVersions)
      } catch (error) {
        console.error('Error fetching versions:', error)
        // Set to current version or 1 if not available
        setTotalVersions(workflow.version || 1)
      }
    }

    fetchTotalVersions()
  }, [workflow.id, workflow.version])

  // Parse input data when it changes
  useEffect(() => {
    if (workflow.input_data && workflow.input_data.trim()) {
      try {
        const cleanedInput = workflow.input_data.trim().replace(/^\uFEFF/, '')
        const parsed = JSON.parse(cleanedInput)
        setParsedInput(parsed)
      } catch (error) {
        console.error('Error parsing input data:', error)
      }
    }
  }, [workflow.input_data])

  const handleVersionChange = async (version: string) => {
    try {
      setIsLoadingVersion(true)
      const response = await fetch(`/api/workflow/${workflow.id}/version/${version}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load version')
      }

      onChange(data.workflow)
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

  const addLogicBlock = () => {
    const newBlock: LogicBlock = {
      id: crypto.randomUUID(),
      input_name: '',
      operation: 'equal',
      values: [''],
      output_name: '',
      conditions: []
    }
    onChange({
      logic_blocks: [...(workflow.logic_blocks || []), newBlock]
    })
  }

  const addCalculation = () => {
    const newCalc: Calculation = {
      id: crypto.randomUUID(),
      formula: '',
      output_name: ''
    }
    onChange({
      calculations: [...(workflow.calculations || []), newCalc]
    })
  }

  const handleDragEnd = (result: DropResult) => {
    if (!result.destination) return

    const { source, destination } = result
    const { index: sourceIndex, droppableId } = source
    const { index: destinationIndex } = destination

    if (droppableId === 'logic-blocks') {
      const newLogicBlocks = [...(workflow.logic_blocks || [])]
      const [removedBlock] = newLogicBlocks.splice(sourceIndex, 1)
      newLogicBlocks.splice(destinationIndex, 0, removedBlock)
      onChange({
        logic_blocks: newLogicBlocks
      })
    }
  }

  const handleBlockChange = (index: number, updates: Partial<LogicBlock>) => {
    const newBlocks = [...(workflow.logic_blocks || [])]
    newBlocks[index] = { ...newBlocks[index], ...updates }
    onChange({ logic_blocks: newBlocks })
  }

  const handleRemoveBlock = (index: number) => {
    const newBlocks = [...(workflow.logic_blocks || [])]
    newBlocks.splice(index, 1)
    onChange({ logic_blocks: newBlocks })
  }

  const updateCalculation = (index: number, updates: Partial<Calculation>) => {
    const newCalculations = [...(workflow.calculations || [])]
    newCalculations[index] = { ...newCalculations[index], ...updates }
    onChange({
      calculations: newCalculations
    })
  }

  const removeCalculation = (index: number) => {
    const newCalculations = [...(workflow.calculations || [])]
    newCalculations.splice(index, 1)
    onChange({
      calculations: newCalculations
    })
  }

  const addCondition = (blockIndex: number) => {
    const newLogicBlocks = [...(workflow.logic_blocks || [])]
    const block = newLogicBlocks[blockIndex]
    if (!block.conditions) {
      block.conditions = []
    }
    block.conditions.push({
      input_name: '',
      operator: 'and',
      operation: 'equal',
      values: ['']
    })
    onChange({ logic_blocks: newLogicBlocks })
  }

  const updateCondition = (blockIndex: number, conditionIndex: number, updates: Partial<Condition>) => {
    const newLogicBlocks = [...(workflow.logic_blocks || [])]
    const block = newLogicBlocks[blockIndex]
    if (!block.conditions) {
      block.conditions = []
    }
    block.conditions[conditionIndex] = { ...block.conditions[conditionIndex], ...updates }
    onChange({ logic_blocks: newLogicBlocks })
  }

  const removeCondition = (blockIndex: number, conditionIndex: number) => {
    const newLogicBlocks = [...(workflow.logic_blocks || [])]
    const block = newLogicBlocks[blockIndex]
    if (block.conditions) {
      block.conditions.splice(conditionIndex, 1)
      onChange({ logic_blocks: newLogicBlocks })
    }
  }

  const handleMakeLatest = async () => {
    if (!workflow.id || !workflow.version) return

    try {
      setIsMakingLatest(true)
      await makeLatestVersion(workflow.id, workflow.version)
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

  const getAvailablePaths = (currentBlockIndex: number) => {
    // Get paths from input data
    const inputPaths = getAllPaths(parsedInput);
    
    // Get output names from previous logic blocks
    const outputPaths = workflow.logic_blocks
      ?.slice(0, currentBlockIndex)
      .map(block => block.output_name)
      .filter(Boolean) as string[];
    
    // Combine input paths and output paths
    return [...inputPaths, ...outputPaths];
  }

  const renderLogicBlock = (block: LogicBlock, index: number) => {
    return (
      <div key={block.id} className="space-y-4 p-4 border rounded-lg relative">
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-2 top-2"
          onClick={() => handleRemoveBlock(index)}
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Input Name</Label>
            <Combobox
              value={block.input_name ?? ''}
              onChange={(value: string) => handleBlockChange(index, { input_name: value })}
              options={getAvailablePaths(index).map(path => ({
                label: path,
                value: path
              }))}
              placeholder="Select input field..."
            />
          </div>

          <div className="space-y-2">
            <Label>Operation</Label>
            <Select
              value={block.operation}
              onValueChange={(value) => handleBlockChange(index, { 
                operation: value as 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between',
                values: value === 'between' ? ['', ''] : value === 'in' ? [''] : ['']
              })}
            >
              <SelectTrigger className="w-[300px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="equal">equal</SelectItem>
                <SelectItem value="neq">not equal</SelectItem>
                <SelectItem value="gt">greater than</SelectItem>
                <SelectItem value="gte">greater than or equal</SelectItem>
                <SelectItem value="lt">less than</SelectItem>
                <SelectItem value="lte">less than or equal</SelectItem>
                <SelectItem value="in">in list</SelectItem>
                <SelectItem value="is">is null/not null</SelectItem>
                <SelectItem value="between">between</SelectItem>
                <SelectItem value="has">has</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Values</Label>
            {(block.values as string[])?.map((value, valueIndex) => (
              <Input
                key={`${block.id}-value-${valueIndex}`}
                placeholder={block.operation === 'between' ? (valueIndex === 0 ? 'Min' : 'Max') : 'Value'}
                value={value}
                onChange={(e) => {
                  const newValues = [...(block.values as string[] || [])]
                  newValues[valueIndex] = e.target.value
                  handleBlockChange(index, { values: newValues })
                }}
              />
            ))}
          </div>

          <div className="space-y-2">
            <Label>Output Name</Label>
            <Input
              placeholder="Output Name"
              value={block.output_name}
              onChange={(e) => handleBlockChange(index, { output_name: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Output Value</Label>
            <Input
              placeholder="Output Value"
              value={block.output_value}
              onChange={(e) => handleBlockChange(index, { output_value: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Default Value</Label>
            <Input
              placeholder="Default Value"
              value={block.default_value}
              onChange={(e) => handleBlockChange(index, { default_value: e.target.value })}
            />
          </div>

          <div className="space-y-2">
            <Label>Conditions</Label>
            {block.conditions?.map((condition, conditionIndex) => (
              <div key={`${block.id}-condition-${conditionIndex}`} className="flex items-center gap-2 pt-2 border-t">
                <Select
                  value={condition.operator}
                  onValueChange={(value) => 
                    updateCondition(index, conditionIndex, { operator: value as 'and' | 'or' })
                  }
                >
                  <SelectTrigger className="w-[80px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="and">AND</SelectItem>
                    <SelectItem value="or">OR</SelectItem>
                  </SelectContent>
                </Select>

                <Combobox
                  value={condition.input_name ?? ''}
                  onChange={(value) => updateCondition(index, conditionIndex, { input_name: value })}
                  options={getAvailablePaths(index).map(path => ({
                    label: path,
                    value: path
                  }))}
                  placeholder="Select input field..."
                />

                <Select
                  value={condition.operation}
                  onValueChange={(value) => {
                    const operation = value as 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between'
                    updateCondition(index, conditionIndex, {
                      operation,
                      values: operation === 'between' ? ['', ''] : operation === 'in' ? [''] : ['']
                    })
                  }}
                >
                  <SelectTrigger className="w-[300px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="equal">equal</SelectItem>
                    <SelectItem value="neq">not equal</SelectItem>
                    <SelectItem value="gt">greater than</SelectItem>
                    <SelectItem value="gte">greater than or equal</SelectItem>
                    <SelectItem value="lt">less than</SelectItem>
                    <SelectItem value="lte">less than or equal</SelectItem>
                    <SelectItem value="in">in list</SelectItem>
                    <SelectItem value="is">is null/not null</SelectItem>
                    <SelectItem value="between">between</SelectItem>
                  </SelectContent>
                </Select>

                {condition.values.map((value, valueIndex) => (
                  <Input
                    key={`${block.id}-condition-${conditionIndex}-value-${valueIndex}`}
                    placeholder={condition.operation === 'between' ? (valueIndex === 0 ? 'Min' : 'Max') : 'Value'}
                    value={value}
                    onChange={(e) => {
                      const newValues = [...condition.values]
                      newValues[valueIndex] = e.target.value
                      updateCondition(index, conditionIndex, { values: newValues })
                    }}
                  />
                ))}

                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCondition(index, conditionIndex)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ×
                </Button>
              </div>
            ))}

            <div className="flex justify-end pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => addCondition(index)}
              >
                Add Condition
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Quick Start</h3>

      <Card className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="grid gap-4">
            <Textarea
              placeholder="Describe what you want the AI to generate (e.g. 'Create a workflow that calculates total order value and applies discounts based on customer type')"
              value={workflow.description || ''}
              onChange={(e) => {
                onChange({ description: e.target.value })
                // Save description to local storage
                localStorage.setItem('ai_workflow_description', e.target.value)
              }}
              className="min-h-[100px]"
            />
            <Input
              placeholder="Model Name (e.g. gpt-3.5-turbo)"
              value={aiModel.model_name}
              onChange={(e) => {
                const updated = { ...aiModel, model_name: e.target.value }
                setAiModel(updated)
                onChange({ ai_model: updated })
              }}
            />
            <Input
              placeholder="API Key"
              type="password"
              value={aiModel.api_key}
              onChange={(e) => {
                const updated = { ...aiModel, api_key: e.target.value }
                setAiModel(updated)
                onChange({ ai_model: updated })
              }}
            />
            <Button 
              onClick={handleGenerateWorkflow}
              disabled={isGenerating}
              className="w-full"
            >
              {isGenerating ? 'Generating Workflow...' : 'Generate Workflow'}
            </Button>
          </div>
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-lg font-semibold">Logic</h2>
          <div className="flex items-center gap-2">
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
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addLogicBlock}>Add Logic</Button>
          <Button variant="outline" onClick={addCalculation}>Add Calculation</Button>
        </div>
      </div>

      {/* Logic Blocks */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="logic-blocks">
          {(provided: DroppableProvided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-4"
            >
              {workflow.logic_blocks?.map((block, index) => (
                <Draggable key={block.id} draggableId={block.id} index={index}>
                  {(provided: DraggableProvided) => (
                    <Card 
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className="p-4"
                    >
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div {...provided.dragHandleProps}>
                            <GripVertical className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <Combobox
                            value={block.input_name ?? ''}
                            onChange={(value) => handleBlockChange(index, { input_name: value })}
                            options={getAvailablePaths(index).map(path => ({
                              label: path,
                              value: path
                            }))}
                            placeholder="Select input field..."
                          />
                          <Select
                            value={block.operation}
                            onValueChange={(value) => handleBlockChange(index, { 
                              operation: value as 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between',
                              values: value === 'between' ? ['', ''] : value === 'in' ? [''] : ['']
                            })}
                          >
                            <SelectTrigger className="w-[300px]">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="equal">equal</SelectItem>
                              <SelectItem value="neq">not equal</SelectItem>
                              <SelectItem value="gt">greater than</SelectItem>
                              <SelectItem value="gte">greater than or equal</SelectItem>
                              <SelectItem value="lt">less than</SelectItem>
                              <SelectItem value="lte">less than or equal</SelectItem>
                              <SelectItem value="in">in list</SelectItem>
                              <SelectItem value="is">is null/not null</SelectItem>
                              <SelectItem value="between">between</SelectItem>
                              <SelectItem value="has">has</SelectItem>
                            </SelectContent>
                            </Select>
                          {(block.values as string[])?.map((value, valueIndex) => (
                            <Input
                              key={`${block.id}-value-${valueIndex}`}
                              placeholder={block.operation === 'between' ? (valueIndex === 0 ? 'Min' : 'Max') : 'Value'}
                              value={value}
                              onChange={(e) => {
                                const newValues = [...(block.values as string[] || [])]
                                newValues[valueIndex] = e.target.value
                                handleBlockChange(index, { values: newValues })
                              }}
                            />
                          ))}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveBlock(index)}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            ×
                          </Button>
                        </div>

                        {/* Additional Conditions */}
                        {block.conditions?.map((condition, conditionIndex) => (
                          <div key={`${block.id}-condition-${conditionIndex}`} className="flex items-center gap-2 pt-2 border-t">
                            <Select
                              value={condition.operator}
                              onValueChange={(value) => 
                                updateCondition(index, conditionIndex, { operator: value as 'and' | 'or' })
                              }
                            >
                              <SelectTrigger className="w-[80px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="and">AND</SelectItem>
                                <SelectItem value="or">OR</SelectItem>
                              </SelectContent>
                            </Select>

                            <Combobox
                              value={condition.input_name ?? ''}
                              onChange={(value) => updateCondition(index, conditionIndex, { input_name: value })}
                              options={getAvailablePaths(index).map(path => ({
                                label: path,
                                value: path
                              }))}
                              placeholder="Select input field..."
                            />

                            <Select
                              value={condition.operation}
                              onValueChange={(value) => {
                                const operation = value as 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between'
                                updateCondition(index, conditionIndex, {
                                  operation,
                                  values: operation === 'between' ? ['', ''] : operation === 'in' ? [''] : ['']
                                })
                              }}
                            >
                              <SelectTrigger className="w-[300px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="equal">equal</SelectItem>
                                <SelectItem value="neq">not equal</SelectItem>
                                <SelectItem value="gt">greater than</SelectItem>
                                <SelectItem value="gte">greater than or equal</SelectItem>
                                <SelectItem value="lt">less than</SelectItem>
                                <SelectItem value="lte">less than or equal</SelectItem>
                                <SelectItem value="in">in list</SelectItem>
                                <SelectItem value="is">is null/not null</SelectItem>
                                <SelectItem value="between">between</SelectItem>
                              </SelectContent>
                            </Select>

                            {condition.values.map((value, valueIndex) => (
                              <Input
                                key={`${block.id}-condition-${conditionIndex}-value-${valueIndex}`}
                                placeholder={condition.operation === 'between' ? (valueIndex === 0 ? 'Min' : 'Max') : 'Value'}
                                value={value}
                                onChange={(e) => {
                                  const newValues = [...condition.values]
                                  newValues[valueIndex] = e.target.value
                                  updateCondition(index, conditionIndex, { values: newValues })
                                }}
                              />
                            ))}

                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeCondition(index, conditionIndex)}
                              className="text-muted-foreground hover:text-destructive"
                            >
                              ×
                            </Button>
                          </div>
                        ))}

                        {/* Add Condition Button */}
                        <div className="flex justify-end pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addCondition(index)}
                          >
                            Add Condition
                          </Button>
                        </div>

                        {/* Output Configuration */}
                        <div className="flex items-center gap-2 pt-2 border-t">
                          <Input
                            placeholder="Output Name"
                            value={block.output_name}
                            onChange={(e) => handleBlockChange(index, { output_name: e.target.value })}
                          />
                          <Input
                            placeholder="Output Value"
                            value={block.output_value}
                            onChange={(e) => handleBlockChange(index, { output_value: e.target.value })}
                          />
                          <Input
                            placeholder="Default Value"
                            value={block.default_value}
                            onChange={(e) => handleBlockChange(index, { default_value: e.target.value })}
                          />
                        </div>
                      </div>
                    </Card>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Calculations */}
      <div className="space-y-4">
        {workflow.calculations?.map((calc, index) => (
          <Card key={calc.id || `calc-${index}`} className="p-4">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Formula (e.g. ${age} * 2)"
                value={calc.formula}
                onChange={(e) => updateCalculation(index, { formula: e.target.value })}
              />
              <Input
                placeholder="Output Name"
                value={calc.output_name}
                onChange={(e) => updateCalculation(index, { output_name: e.target.value })}
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => removeCalculation(index)}
                className="text-muted-foreground hover:text-destructive"
              >
                ×
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Formula Functions Documentation */}
      <Card className="p-4 mt-8">
        <h3 className="text-lg font-semibold mb-4">Available Formula Functions</h3>
        <div className="space-y-4">
          <div>
            <h4 className="font-medium mb-2">Basic Operations</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><code>{"${fieldName} + ${otherField}"}</code> - Addition</li>
              <li><code>{"${fieldName} - ${otherField}"}</code> - Subtraction</li>
              <li><code>{"${fieldName} * ${otherField}"}</code> - Multiplication</li>
              <li><code>{"${fieldName} / ${otherField}"}</code> - Division</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Conditional Operations</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><code>{"${booleanField ? 100 : 0}"}</code> - Ternary operator (if-then-else)</li>
              <li><code>{"${fieldName} > 10 ? 100 : 0"}</code> - Comparison with number</li>
              <li><code>{"${fieldName} === 'value' ? 100 : 0"}</code> - Equality check</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Type Conversion</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><code>{"Number(${fieldName})"}</code> - Convert to number</li>
              <li><code>{"Boolean(${fieldName})"}</code> - Convert to boolean</li>
              <li><code>{"String(${fieldName})"}</code> - Convert to string</li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-2">Complex Examples</h4>
            <ul className="list-disc pl-6 space-y-1">
              <li><code>{"(${score1} + ${score2}) * (${multiplier} || 1)"}</code> - Multiple operations with default</li>
              <li><code>{"${isQualified} ? (${score} * 2) : (${score} * 0.5)"}</code> - Nested conditions</li>
              <li><code>{"Number(${score1}) + Number(${score2})"}</code> - Safe number addition</li>
            </ul>
          </div>
          <div className="mt-4 p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              Note: All formulas must evaluate to a number. Use type conversion functions when working with mixed types.
              Variables are referenced using <code>${"{fieldName}"}</code> syntax and can use any input field or output from previous logic blocks.
            </p>
          </div>
        </div>
      </Card>
    </div>
  )
} 