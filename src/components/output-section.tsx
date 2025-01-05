'use client'

import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { Card } from './ui/card'
import { Textarea } from './ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs'
import { useToast } from '@/hooks/use-toast'
import type { Workflow, LogicBlock, Calculation } from '@/types/workflow'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from "lucide-react"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'

type OutputSectionProps = {
  workflow: Workflow
  onChange: (updates: Partial<Workflow>) => void
}

type OutputData = Record<string, any>

type DebugInfo = {
  parsedInput: Record<string, any>;
  logicResults: Record<string, string>;
  calculationResults: Record<string, string>;
  error?: string;
}

// Helper function to get nested value
function getNestedValue(obj: any, path: string, outputData: Record<string, any> = {}) {
  if (!path) return undefined;
  
  // First check if the path is an output name
  if (outputData.hasOwnProperty(path)) {
    return outputData[path];
  }
  
  // Try both direct path and input_data prefixed path
  const paths = [
    path,
    path.startsWith('input_data.') ? path : `input_data.${path}`
  ];
  
  for (const currentPath of paths) {
    // Handle array notation in path (e.g., "education[0].institution" or "education.0.institution")
    const normalizedPath = currentPath.replace(/\[(\d+)\]/g, '.$1');
    const keys = normalizedPath.split('.');
    let result = obj;
    let valid = true;
    
    for (const key of keys) {
      if (result === null || result === undefined) {
        valid = false;
        break;
      }
      
      // If we're at the final key and it's an array, return the whole array
      if (Array.isArray(result) && keys.indexOf(key) === keys.length - 1) {
        return result;
      }
      
      // If we're at an intermediate array, get the specified index or first item
      if (Array.isArray(result)) {
        result = /^\d+$/.test(key) ? result[Number(key)] : result[0];
      } else {
        result = result[key];
      }
    }
    
    if (valid && result !== undefined) {
      return result;
    }
  }
  
  // Get all available paths for error message
  const availablePaths = getAllPaths(obj);
  console.error(`Error: Input ${path} not found. Available paths: ${availablePaths.join(', ')}`);
  return undefined;
}

// Helper function to get all nested paths
function getAllPaths(obj: any, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.entries(obj).reduce((paths: string[], [key, value]) => {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    if (Array.isArray(value)) {
      // Add array paths with indices
      const arrayPaths = value.map((_, index) => {
        const arrayPath = `${currentPath}[${index}]`;
        if (typeof value[index] === 'object') {
          return [arrayPath, ...getAllPaths(value[index], arrayPath)];
        }
        return arrayPath;
      }).flat();
      return [...paths, currentPath, ...arrayPaths];
    } else if (value && typeof value === 'object') {
      return [...paths, currentPath, ...getAllPaths(value, currentPath)];
    }
    return [...paths, currentPath];
  }, []);
}

export function OutputSection({ workflow, onChange }: OutputSectionProps) {
  const { toast } = useToast()
  const [showDebug, setShowDebug] = useState(false)
  const [isLoadingVersion, setIsLoadingVersion] = useState(false)
  const [totalVersions, setTotalVersions] = useState(workflow.version || 1)
  const [outputData, setOutputData] = useState<{ data: OutputData; debug: DebugInfo }>({ 
    data: {}, 
    debug: { parsedInput: {}, logicResults: {}, calculationResults: {} } 
  })

  // Fetch total versions when component mounts or workflow ID changes
  useEffect(() => {
    async function fetchTotalVersions() {
      if (!workflow.id) return

      try {
        const response = await fetch(`/api/workflow/${workflow.id}/versions`)
        const data = await response.json()
        
        if (!response.ok) {
          throw new Error(data.error || 'Failed to fetch versions')
        }

        setTotalVersions(data.totalVersions)
      } catch (error) {
        console.error('Error fetching versions:', error)
      }
    }

    fetchTotalVersions()
  }, [workflow.id])

  const getOutputData = (): { data: OutputData; debug: DebugInfo } => {
    try {
      let data: OutputData = {}
      let debug: DebugInfo = {
        parsedInput: {},
        logicResults: {},
        calculationResults: {}
      }
      
      // Parse input data
      let parsedInput: Record<string, any> = {}
      if (workflow.input_data) {
        try {
          // If it's already an object, use it directly
          if (typeof workflow.input_data === 'object' && workflow.input_data !== null) {
            parsedInput = workflow.input_data
          } else if (typeof workflow.input_data === 'string' && workflow.input_data.trim()) {
            // If it's a string, try to parse it
            const cleanedInput = workflow.input_data.trim().replace(/^\uFEFF/, '')
            const parsed = JSON.parse(cleanedInput)
            parsedInput = parsed
          }
          
          // Log the parsed input for debugging
          console.log('Parsed input:', parsedInput)
        } catch (error) {
          // If JSON parsing fails, try CSV
          if (typeof workflow.input_data === 'string' && workflow.input_data.includes(',')) {
            const lines = workflow.input_data.split('\n').filter(Boolean)
            if (lines.length >= 2) {
              const headers = lines[0].split(',')
              const values = lines[1].split(',')
              
              // Build nested object structure from dot notation
              headers.forEach((header: string, index: number) => {
                const path = header.trim().split('.')
                let current = parsedInput
                
                path.forEach((key, i) => {
                  if (i === path.length - 1) {
                    current[key] = values[index]?.trim()
                  } else {
                    current[key] = current[key] || {}
                    current = current[key]
                  }
                })
              })
            }
          }
        }
      }
      debug.parsedInput = parsedInput

      // Process logic blocks
      workflow.logic_blocks?.forEach((block: LogicBlock) => {
        if (!block.output_name) return

        // Evaluate primary condition using nested value access
        const inputValue = getNestedValue(parsedInput, block.input_name, data)
        
        if (inputValue === undefined) {
          // Get all available nested paths
          const availablePaths = [
            ...getAllPaths(parsedInput),
            ...Object.keys(data)
          ];
          const errorMsg = `Error: Input ${block.input_name} not found. Available paths: ${availablePaths.join(', ')}`
          console.error(errorMsg);
          console.log('Full input structure:', JSON.stringify(parsedInput, null, 2));
          debug.logicResults[block.output_name] = errorMsg
          // Set default value even if input is not found
          data[block.output_name] = block.default_value || ""
          return
        }

        // Handle array inputs by processing each item
        const inputValues = Array.isArray(inputValue) ? inputValue : [inputValue];
        const results = inputValues.map((value, index) => {
          let primaryResult = false;
          const itemSuffix = inputValues.length > 1 ? `[${index}]` : '';
          
          try {
            switch (block.operation) {
              case 'equal':
                let comparisonValue = value;
                if (typeof value === 'object') {
                  // Extract just the field value for comparison
                  const fieldName = block.input_name.split('.').pop();
                  comparisonValue = value[fieldName || ''];
                }
                const normalizedInput = typeof comparisonValue === 'object' ? JSON.stringify(comparisonValue) : String(comparisonValue)
                const normalizedValue = typeof block.values?.[0] === 'object' ? JSON.stringify(block.values[0]) : String(block.values?.[0] || '')
                primaryResult = normalizedInput === normalizedValue
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${JSON.stringify(comparisonValue)} === ${JSON.stringify(block.values?.[0])} -> ${primaryResult}`
                break
              case 'neq':
                let neqComparisonValue = value;
                if (typeof value === 'object') {
                  // Extract just the field value for comparison
                  const fieldName = block.input_name.split('.').pop();
                  neqComparisonValue = value[fieldName || ''];
                }
                const neqInput = typeof neqComparisonValue === 'object' ? JSON.stringify(neqComparisonValue) : String(neqComparisonValue)
                const neqValue = typeof block.values?.[0] === 'object' ? JSON.stringify(block.values[0]) : String(block.values?.[0] || '')
                primaryResult = neqInput !== neqValue
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${JSON.stringify(neqComparisonValue)} !== ${JSON.stringify(block.values?.[0])} -> ${primaryResult}`
                break
              case 'gt':
                primaryResult = Number(value) > Number(block.values?.[0] || 0)
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${value} > ${block.values?.[0]} -> ${primaryResult}`
                break
              case 'gte':
                primaryResult = Number(value) >= Number(block.values?.[0] || 0)
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${value} >= ${block.values?.[0]} -> ${primaryResult}`
                break
              case 'lt':
                primaryResult = Number(value) < Number(block.values?.[0] || 0)
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${value} < ${block.values?.[0]} -> ${primaryResult}`
                break
              case 'lte':
                primaryResult = Number(value) <= Number(block.values?.[0] || 0)
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${value} <= ${block.values?.[0]} -> ${primaryResult}`
                break
              case 'in':
                let inComparisonValue = value;
                if (typeof value === 'object') {
                  // Extract just the field value for comparison
                  const fieldName = block.input_name.split('.').pop();
                  inComparisonValue = value[fieldName || ''];
                }
                const listValue = block.values?.[0]
                const list = typeof listValue === 'string' ? listValue.split(',').map((v: string) => v.trim()) : []
                primaryResult = list.includes(String(inComparisonValue))
                // Only store the result once, without array index
                debug.logicResults[block.output_name] = `"${inComparisonValue}" in [${list.join(', ')}] -> ${primaryResult}`
                break
              case 'is':
                const isNull = block.values?.[0] === 'null'
                primaryResult = isNull ? value === null : value !== null
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${value} is ${isNull ? 'null' : 'not null'} -> ${primaryResult}`
                break
              case 'between':
                const numValue = Number(value)
                const min = Number(block.values?.[0] || 0)
                const max = Number(block.values?.[1] || 0)
                primaryResult = numValue >= min && numValue <= max
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `${min} <= ${numValue} <= ${max} -> ${primaryResult}`
                break
              case 'has':
                const hasResult = String(value).toLowerCase().includes(String(block.values?.[0] || '').toLowerCase())
                debug.logicResults[`${block.output_name}${itemSuffix}`] = `"${value}" has "${block.values?.[0]}" -> ${hasResult}`
                primaryResult = hasResult
                break
            }
          } catch (error) {
            console.error(`Error processing logic block ${block.output_name}:`, error)
            primaryResult = false
          }

          // Process conditions
          let finalResult = primaryResult;
          block.conditions?.forEach((condition, i) => {
            try {
              const conditionValue = getNestedValue(parsedInput, condition.input_name, data)
              if (conditionValue === undefined) {
                debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `Error: Input ${condition.input_name} not found`
                return
              }

              // Handle array condition values
              const conditionValues = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
              const condValue = conditionValues[index] || conditionValues[0];
              
              let conditionResult = false;
              switch (condition.operation) {
                case 'equal':
                  const normalizedCondInput = typeof condValue === 'object' ? JSON.stringify(condValue) : String(condValue)
                  const normalizedCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
                  conditionResult = normalizedCondInput === normalizedCondValue
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${JSON.stringify(condValue)} === ${JSON.stringify(condition.values?.[0])} -> ${conditionResult}`
                  break
                case 'neq':
                  const neqCondInput = typeof condValue === 'object' ? JSON.stringify(condValue) : String(condValue)
                  const neqCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
                  conditionResult = neqCondInput !== neqCondValue
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${JSON.stringify(condValue)} !== ${JSON.stringify(condition.values?.[0])} -> ${conditionResult}`
                  break
                case 'gt':
                  conditionResult = Number(condValue) > Number(condition.values?.[0] || 0)
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${condValue} > ${condition.values?.[0]} -> ${conditionResult}`
                  break
                case 'gte':
                  conditionResult = Number(condValue) >= Number(condition.values?.[0] || 0)
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${condValue} >= ${condition.values?.[0]} -> ${conditionResult}`
                  break
                case 'lt':
                  conditionResult = Number(condValue) < Number(condition.values?.[0] || 0)
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${condValue} < ${condition.values?.[0]} -> ${conditionResult}`
                  break
                case 'lte':
                  conditionResult = Number(condValue) <= Number(condition.values?.[0] || 0)
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${condValue} <= ${condition.values?.[0]} -> ${conditionResult}`
                  break
                case 'in':
                  const listValue = condition.values?.[0]
                  const list = typeof listValue === 'string' ? listValue.split(',').map((v: string) => v.trim()) : []
                  conditionResult = list.includes(String(condValue))
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${condValue} in [${list.join(', ')}] -> ${conditionResult}`
                  break
                case 'is':
                  const isNull = condition.values?.[0] === 'null'
                  conditionResult = isNull ? condValue === null : condValue !== null
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${condValue} is ${isNull ? 'null' : 'not null'} -> ${conditionResult}`
                  break
                case 'between':
                  const value = Number(condValue)
                  const min = Number(condition.values?.[0] || 0)
                  const max = Number(condition.values?.[1] || 0)
                  conditionResult = value >= min && value <= max
                  debug.logicResults[`${block.output_name}${itemSuffix}_condition_${i}`] = `${min} <= ${value} <= ${max} -> ${conditionResult}`
                  break
              }

              if (condition.operator === 'and') {
                finalResult = finalResult && conditionResult;
              } else {
                finalResult = finalResult || conditionResult;
              }
            } catch (error) {
              console.error(`Error processing condition ${i} for block ${block.output_name}:`, error)
            }
          });

          return {
            result: finalResult,
            value: finalResult ? block.output_value : (block.default_value || "")
          };
        });

        // Store results as an array if input was an array and has multiple items
        if (block.operation === 'in' || block.operation === 'has') {
          // For 'in' and 'has' operations, store a single result
          data[block.output_name] = results.some(r => r.result) ? (block.output_value || 20) : (block.default_value || 0);
        } else if (Array.isArray(inputValue) && results.length > 1) {
          // For other operations, keep array structure if input was an array
          data[block.output_name] = results.map(r => r.value);
        } else {
          // Store single value and ensure it's not undefined
          data[block.output_name] = results[0]?.value || block.default_value || 0;
        }
      })

      // Process calculations
      workflow.calculations?.forEach((calc: Calculation) => {
        if (!calc.output_name) return

        try {
          // Create a context with input data
          const context = { ...parsedInput }
          // Add logic block results
          workflow.logic_blocks?.forEach((block: LogicBlock) => {
            if (block.output_name) {
              context[block.output_name] = data[block.output_name]
            }
          })

          // Get the raw formula and ensure it's a string
          const rawFormula = typeof calc.formula === 'string' ? 
            calc.formula : 
            String(calc.formula)

          console.log('Evaluating calculation:', {
            output_name: calc.output_name,
            original_formula: rawFormula,
            context
          })
          
          // Evaluate formula with context, supporting nested paths
          const formula = rawFormula.replace(/\${([\w.]+)}/g, (_: string, key: string) => {
            const value = getNestedValue(context, key)
            console.log('Replacing variable:', { key, value, type: typeof value })
            
            if (value === undefined) {
              throw new Error(`Variable ${key} not found in context`)
            }
            
            // Handle different types
            if (typeof value === 'boolean') {
              return value ? '1' : '0'
            }
            if (typeof value === 'string') {
              // Handle string booleans
              if (value.toLowerCase() === 'true') return '1'
              if (value.toLowerCase() === 'false') return '0'
              // Try to convert to number
              const num = Number(value)
              return isNaN(num) ? '0' : String(num)
            }
            if (typeof value === 'object') {
              if (value === null) return '0'
              if (Array.isArray(value)) return String(value.length)
              return '0'
            }
            return String(value)
          })
          
          console.log('Formula after variable replacement:', formula)
          
          try {
            // Validate formula before evaluation
            if (!formula || formula.trim() === '') {
              throw new Error('Empty formula')
            }
            if (formula === '{}' || formula === 'undefined') {
              throw new Error('Invalid formula: empty object or undefined')
            }

            // Check for balanced parentheses
            let parenCount = 0
            for (const char of formula) {
              if (char === '(') parenCount++
              if (char === ')') parenCount--
              if (parenCount < 0) throw new Error('Unmatched closing parenthesis')
            }
            if (parenCount > 0) throw new Error('Missing closing parenthesis')

            // Validate formula syntax by attempting to parse it
            try {
              new Function(`return (${formula})`)
            } catch (syntaxError: any) {
              throw new Error(`Invalid formula syntax: ${syntaxError.message}`)
            }
            
            // Wrap in Number() to ensure numeric result
            const evalFormula = `Number(${formula})`
            console.log('Final formula to evaluate:', evalFormula)
            
            // Try to evaluate with a safe subset of operations
            const safeEval = new Function('return ' + evalFormula)
            const result = safeEval()
            console.log('Evaluation result:', result)
            
            if (isNaN(result)) {
              throw new Error('Formula did not evaluate to a valid number')
            }
            
            data[calc.output_name] = result
            debug.calculationResults[calc.output_name] = `${formula} -> ${result}`
          } catch (evalError: any) {
            console.error('Error evaluating formula:', {
              original_formula: rawFormula,
              replaced_formula: formula,
              error: evalError.message,
              context,
              stack: evalError.stack
            })
            data[calc.output_name] = 0 // Default to 0 on error
            debug.calculationResults[calc.output_name] = `Error: ${evalError.message}`
          }
        } catch (error: any) {
          console.error(`Error processing calculation ${calc.output_name}:`, error)
          data[calc.output_name] = 0 // Default to 0 on error
          debug.calculationResults[calc.output_name] = `Error: ${error.message}`
        }
      })

      return { data, debug }
    } catch (error: any) {
      console.error('Error in getOutputData:', error)
      return {
        data: {},
        debug: {
          parsedInput: {},
          logicResults: { error: error.message },
          calculationResults: {}
        }
      }
    }
  }

  // Update output data when workflow changes
  useEffect(() => {
    const result = getOutputData()
    
    // Initialize output schema if it doesn't exist
    if (!workflow.output_schema) {
      const newSchema: Record<string, boolean> = Object.keys(result.data).reduce((acc, key) => ({
        ...acc,
        [key]: true
      }), {})
      
      onChange({
        output_schema: newSchema
      })
    } else {
      // Filter by output schema - only include fields that are toggled on
      const outputSchema = workflow.output_schema as Record<string, boolean>
      result.data = Object.fromEntries(
        Object.entries(result.data).filter(([key]) => outputSchema[key] !== false)
      )
    }
    
    setOutputData(result)
  }, [workflow.input_data, workflow.logic_blocks, workflow.calculations, workflow.output_schema])

  const renderError = (error: string) => (
    <Alert variant="destructive" className="mb-4">
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )

  const renderDebugSection = () => {
    if (!showDebug) return null

    return (
      <div className="space-y-4">
        <div>
          <h3 className="font-medium mb-2">Input Data</h3>
          <pre className="bg-muted p-4 rounded-md overflow-auto">
            {JSON.stringify(outputData.debug.parsedInput, null, 2)}
          </pre>
        </div>
        <div>
          <h3 className="font-medium mb-2">Logic Results</h3>
          <pre className="bg-muted p-4 rounded-md overflow-auto">
            {JSON.stringify(outputData.debug.logicResults, null, 2)}
          </pre>
        </div>
        <div>
          <h3 className="font-medium mb-2">Calculation Results</h3>
          <pre className="bg-muted p-4 rounded-md overflow-auto">
            {JSON.stringify(outputData.debug.calculationResults, null, 2)}
          </pre>
        </div>
      </div>
    )
  }

  const renderOutputSchema = () => {
    // Get all possible output keys from logic blocks and calculations
    const allOutputKeys = [
      ...(workflow.logic_blocks?.map(block => block.output_name) || []),
      ...(workflow.calculations?.map(calc => calc.output_name) || [])
    ].filter(Boolean) as string[];

    if (allOutputKeys.length === 0) return null;

    return (
      <div className="space-y-4 mb-4">
        <h3 className="font-medium">Output Schema</h3>
        <div className="space-y-2">
          {allOutputKeys.map(key => (
            <div key={key} className="flex items-center justify-between">
              <span>{key}</span>
              <Switch
                checked={workflow.output_schema ? (workflow.output_schema as Record<string, boolean>)[key] !== false : true}
                onCheckedChange={(checked) => {
                  const currentSchema = (workflow.output_schema || {}) as Record<string, boolean>
                  onChange({
                    output_schema: {
                      ...currentSchema,
                      [key]: checked
                    }
                  })
                }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  const handleExport = (format: 'json' | 'csv' | 'excel') => {
    if (Object.keys(outputData.data).length === 0) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "No data to export",
      })
      return
    }

    try {
      let content: string
      let filename: string
      let type: string

      switch (format) {
        case 'json':
          content = JSON.stringify(outputData.data, null, 2)
          filename = 'workflow_output.json'
          type = 'application/json'
          break
        case 'csv':
          const headers = Object.keys(outputData.data)
          const values = Object.values(outputData.data)
          content = headers.join(',') + '\n' + values.join(',')
          filename = 'workflow_output.csv'
          type = 'text/csv'
          break
        case 'excel':
          // For Excel, we'll use CSV format but with .xlsx extension
          const excelHeaders = Object.keys(outputData.data)
          const excelValues = Object.values(outputData.data)
          content = excelHeaders.join(',') + '\n' + excelValues.join(',')
          filename = 'workflow_output.xlsx'
          type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          break
      }

      const blob = new Blob([content], { type })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: `Data exported as ${format.toUpperCase()}`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: `Failed to export as ${format.toUpperCase()}`,
      })
      console.error('Error exporting data:', error)
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

  const evaluateLogic = (block: LogicBlock, parsedInput: any, currentOutput: any) => {
    const inputValue = getNestedValue(block.input_name, parsedInput, currentOutput)
    const values = block.values || []
    
    // For 'in' operation, handle both comma-separated strings and arrays
    if (block.operation === 'in') {
      // If the first value contains commas, treat it as a comma-separated list
      const firstValue = String(values[0] || '')
      if (firstValue.includes(',')) {
        const valueList = firstValue.split(',').map((v: string) => v.trim())
        const result = valueList.includes(String(inputValue))
        return {
          result,
          debug: `"${inputValue}" in [${valueList.join(', ')}] -> ${result}`
        }
      } else {
        // Otherwise, use the array as is
        const result = values.map(String).includes(String(inputValue))
        return {
          result,
          debug: `"${inputValue}" in [${values.join(', ')}] -> ${result}`
        }
      }
    }

    // Handle other operations
    switch (block.operation) {
      case 'has': {
        const hasResult = String(inputValue).toLowerCase().includes(String(values[0] || '').toLowerCase())
        return {
          result: hasResult,
          value: hasResult ? block.output_value : (block.default_value || ""),
          debug: `"${inputValue}" has "${values[0]}" -> ${hasResult}`
        }
      }
      case 'equal': {
        const result = inputValue === values[0]
        return {
          result,
          debug: `"${inputValue}" === "${values[0]}" -> ${result}`
        }
      }
      case 'neq': {
        const result = inputValue !== values[0]
        return {
          result,
          debug: `"${inputValue}" !== "${values[0]}" -> ${result}`
        }
      }
      case 'gt': {
        const result = inputValue > values[0]
        return {
          result,
          debug: `"${inputValue}" > "${values[0]}" -> ${result}`
        }
      }
      case 'gte': {
        const result = inputValue >= values[0]
        return {
          result,
          debug: `"${inputValue}" >= "${values[0]}" -> ${result}`
        }
      }
      case 'lt': {
        const result = inputValue < values[0]
        return {
          result,
          debug: `"${inputValue}" < "${values[0]}" -> ${result}`
        }
      }
      case 'lte': {
        const result = inputValue <= values[0]
        return {
          result,
          debug: `"${inputValue}" <= "${values[0]}" -> ${result}`
        }
      }
      case 'is': {
        const result = values[0] === 'null' ? inputValue === null : inputValue !== null
        return {
          result,
          debug: `"${inputValue}" is ${values[0]} -> ${result}`
        }
      }
      case 'between': {
        const result = inputValue >= values[0] && inputValue <= values[1]
        return {
          result,
          debug: `"${values[0]}" <= "${inputValue}" <= "${values[1]}" -> ${result}`
        }
      }
      default:
        return { result: false, debug: 'Unknown operation' }
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Output</h2>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
          >
            {showDebug ? 'Hide' : 'Show'} Debug Info
          </Button>
        </div>
      </div>


      <div className="bg-muted p-4 rounded-md">
        <pre className="overflow-auto">
          {JSON.stringify(outputData.data, null, 2)}
        </pre>
      </div>

      {renderDebugSection()}
            {renderOutputSchema()}

    </div>
  )
} 