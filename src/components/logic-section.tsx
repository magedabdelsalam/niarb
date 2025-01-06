'use client'

import { useState, useEffect, useCallback } from 'react'
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
import { processWorkflow } from '@/lib/workflow'

interface LogicSectionProps {
  workflow: Workflow
  onChange: (updates: Partial<Workflow>) => void
  onDragEnd?: (result: DropResult) => void
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

export function LogicSection({ workflow, onChange, onDragEnd }: LogicSectionProps) {
  const { toast } = useToast()
  const [parsedInput, setParsedInput] = useState<Record<string, any>>({})
  const [description, setDescription] = useState('')
  const [modelName, setModelName] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  // Load saved values from localStorage
  useEffect(() => {
    const savedDescription = localStorage.getItem('ai_workflow_description')
    if (savedDescription) {
      setDescription(savedDescription)
    }

    const savedConfig = localStorage.getItem('ai_model_config')
    if (savedConfig) {
      try {
        const config = JSON.parse(savedConfig)
        if (config.model_name) setModelName(config.model_name)
        if (config.api_key) setApiKey(config.api_key)
      } catch (error) {
        console.error('Error loading AI config:', error)
      }
    }
  }, [])

  // Save model config when it changes
  useEffect(() => {
    if (modelName || apiKey) {
      localStorage.setItem('ai_model_config', JSON.stringify({
        model_name: modelName,
        api_key: apiKey
      }))
    }
  }, [modelName, apiKey])

  // Parse input data when it changes
  useEffect(() => {
    if (workflow.input_data) {
      try {
        // If it's a string that looks like escaped JSON, try to parse it
        if (typeof workflow.input_data === 'string') {
          // Handle both escaped and unescaped JSON strings
          const cleanedInput = workflow.input_data.replace(/^\uFEFF/, '').trim()
          try {
            // First try parsing it directly (for clean JSON)
            const parsed = JSON.parse(cleanedInput)
            setParsedInput(parsed as Record<string, any>)
          } catch {
            // If that fails, it might be escaped JSON
            const parsed = JSON.parse(JSON.parse(cleanedInput))
            setParsedInput(parsed as Record<string, any>)
          }
        } else {
          // If it's already an object, use it directly
          setParsedInput(workflow.input_data as Record<string, any>)
        }
      } catch (error) {
        console.error('Error parsing input data:', error)
      }
    }
  }, [workflow.input_data])

  // Process outputs locally when logic blocks change
  const processLocalOutput = useCallback(() => {
    try {
      const workflowData = {
        input_data: parsedInput,
        logic_blocks: workflow.logic_blocks || [],
        calculations: workflow.calculations || [],
        output_schema: workflow.output_schema || {}
      }

      const result = processWorkflow(workflowData)
      
      // Extract just the data part from the result
      const output = result.data || {}

      // Update the workflow with the new output
      onChange({
        logic_blocks: workflow.logic_blocks,
        calculations: workflow.calculations,
        output_schema: output
      })
    } catch (error) {
      console.error('Error processing local output:', error)
    }
  }, [parsedInput, workflow.logic_blocks, workflow.calculations, workflow.output_schema, onChange])

  // Update local output whenever logic blocks or calculations change
  useEffect(() => {
    const hasLogicBlocks = (workflow.logic_blocks || []).length > 0
    const hasCalculations = (workflow.calculations || []).length > 0
    
    if (workflow.input_data && (hasLogicBlocks || hasCalculations)) {
      processLocalOutput()
    }
  }, [workflow.logic_blocks, workflow.calculations, parsedInput, workflow.input_data, processLocalOutput])

  const addLogicBlock = () => {
    const newBlock: LogicBlock = {
      id: crypto.randomUUID(),
      input_name: '',
      operation: 'equal',
      values: [''],
      output_name: '',
      output_value: '',
      conditions: []
    }
    onChange({
      logic_blocks: [...(workflow.logic_blocks || []), newBlock]
    })
  }

  const getAvailablePaths = (currentBlockIndex: number) => {
    // Get paths from input data
    const inputPaths = getAllPaths(parsedInput).map(path => {
      // If the path starts with the root object name, keep it as is
      if (path.startsWith('patientInfo.') || path.startsWith('orderInfo.') || path.startsWith('userData.')) {
        return path;
      }
      // Otherwise, prefix it with the root object name if it exists in parsedInput
      const rootKey = Object.keys(parsedInput)[0];
      return rootKey ? `${rootKey}.${path}` : path;
    });
    
    // Get output names from previous logic blocks
    const outputPaths = workflow.logic_blocks
      ?.slice(0, currentBlockIndex)
      .map(block => block.output_name)
      .filter(Boolean) as string[];
    
    // Remove duplicates and sort
    return [...new Set([...inputPaths, ...outputPaths])].sort();
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

  const handleGenerateWorkflow = async () => {
    if (!description || !modelName || !apiKey) return

    try {
      setIsGenerating(true)
      
      // Ensure input_data is properly stringified
      const input_data = typeof workflow.input_data === 'string' 
        ? workflow.input_data 
        : JSON.stringify(workflow.input_data)

      const response = await fetch('/api/workflow/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description,
          model_name: modelName,
          api_key: apiKey,
          input_data
        })
      })
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate workflow')
      }

      // Ensure the workflow data has the correct shape
      const generatedWorkflow: Partial<Workflow> = {
        logic_blocks: data.logic_blocks,
        calculations: data.calculations,
        output_schema: data.output_schema
      }

      onChange(generatedWorkflow)
      toast({
        title: "Success",
        description: `Workflow generated`,
      })
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || 'Failed to generate workflow',
      })
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold">Quick Start</h3>

      <Card className="p-4 space-y-4">
        <div className="space-y-2">
          <div className="grid gap-4">
            <Textarea
              placeholder="Describe what you want the AI to generate (e.g. 'Create a workflow that calculates total order value and applies discounts based on customer type')"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                // Save description to local storage
                localStorage.setItem('ai_workflow_description', e.target.value)
              }}
              className="min-h-[100px]"
            />
            <Input
              placeholder="Model Name (e.g. gpt-3.5-turbo)"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
            />
            <Input
              placeholder="API Key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
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
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={addLogicBlock}>Add Logic</Button>
          <Button variant="outline" onClick={addCalculation}>Add Calculation</Button>
        </div>
      </div>

      {/* Logic Blocks */}
      <DragDropContext onDragEnd={onDragEnd || handleDragEnd}>
        <Droppable droppableId="logic-blocks">
          {(provided: DroppableProvided) => (
            <div 
              ref={provided.innerRef}
              {...provided.droppableProps}
              className="space-y-4"
            >
              {(workflow.logic_blocks || []).map((block, index) => (
                <Draggable key={block.id || `logic-block-${index}`} draggableId={block.id || `logic-block-${index}`} index={index}>
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
                              operation: value as 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between' | 'has',
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
                          {(block.values)?.map((value, valueIndex) => (
                            <Input
                              key={`${block.id}-value-${valueIndex}`}
                              placeholder={block.operation === 'between' ? (valueIndex === 0 ? 'Min' : 'Max') : 'Value'}
                              value={value}
                              onChange={(e) => {
                                const newValues = [...(block.values || [])]
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
                          <div key={`${block.id}-condition-${conditionIndex}`} className="flex items-center gap-2">
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
                        <div className="flex">
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
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Formula (e.g. ${age} * 2)"
                  value={calc.formula}
                  onChange={(e) => updateCalculation(index, { formula: e.target.value })}
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
              <div className="flex items-center gap-2 pt-2 border-t">
                <Input
                  placeholder="Output Name"
                  value={calc.output_name}
                  onChange={(e) => updateCalculation(index, { output_name: e.target.value })}
                />
              </div>
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