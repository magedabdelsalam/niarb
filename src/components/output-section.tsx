'use client'

import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { type OutputData, type WorkflowOutput, type Workflow, type LogicBlock, type Calculation } from '@/types/workflow'
import { useEffect, useState } from 'react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle } from "lucide-react"
import { processWorkflow } from '@/lib/workflow'

interface OutputSectionProps {
  workflowId?: string;
  workflow: Workflow;
  version?: number;
  onChange?: (output: Partial<Workflow>) => void;
}

interface LogicBlockDebug {
  name: string
  operation: string
  input: unknown
  expected: unknown
  result: boolean
}

interface CalculationDebug {
  name: string
  formula: string
  result: number
}

interface OutputState {
  data: OutputData
  debug: {
    input: Record<string, unknown>
    logicBlocks: LogicBlockDebug[]
    calculations: CalculationDebug[]
  }
  error?: string
  isLoading: boolean
}

// Helper function to get nested value
function getNestedValue(obj: Record<string, unknown>, path: string, outputData: Record<string, unknown> = {}) {
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
    let result: unknown = obj;
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
      } else if (typeof result === 'object' && result !== null) {
        const record = result as Record<string, unknown>;
        result = record[key];
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
function getAllPaths(obj: Record<string, unknown>, prefix = ''): string[] {
  if (!obj || typeof obj !== 'object') return [];
  
  return Object.entries(obj).reduce((paths: string[], [key, value]) => {
    const currentPath = prefix ? `${prefix}.${key}` : key;
    
    if (Array.isArray(value)) {
      // Add array paths with indices
      const arrayPaths = value.map((_, index) => {
        const arrayPath = `${currentPath}[${index}]`;
        if (typeof value[index] === 'object') {
          return [arrayPath, ...getAllPaths(value[index] as Record<string, unknown>, arrayPath)];
        }
        return arrayPath;
      }).flat();
      return [...paths, currentPath, ...arrayPaths];
    } else if (value && typeof value === 'object') {
      return [...paths, currentPath, ...getAllPaths(value as Record<string, unknown>, currentPath)];
    }
    return [...paths, currentPath];
  }, []);
}

const getOutputData = async (workflowId: string, version?: number): Promise<OutputState> => {
  try {
    let data: OutputData = {}
    let debug: OutputState['debug'] = {
      input: {},
      logicBlocks: [] as LogicBlockDebug[],
      calculations: [] as CalculationDebug[]
    }
    
    // Get workflow data
    const response = await fetch(`/api/workflow/${workflowId}${version ? `/version/${version}` : ''}`)
    const workflowData = await response.json()
    
    if (!response.ok) {
      throw new Error(workflowData.error || 'Failed to fetch workflow')
    }
    
    const workflow = workflowData.workflow as Workflow
    
    // Parse input data
    let parsedInput: Record<string, unknown> = {}
    if (workflow.input_data) {
      try {
        // If it's already an object, use it directly
        if (typeof workflow.input_data === 'object' && workflow.input_data !== null) {
          parsedInput = workflow.input_data as Record<string, unknown>;
        } else {
          const inputStr = String(workflow.input_data);
          if (inputStr.trim()) {
            // If it's a string, try to parse it
            const cleanedInput = inputStr.trim().replace(/^\uFEFF/, '');
            const parsed = JSON.parse(cleanedInput);
            parsedInput = parsed as Record<string, unknown>;
          }
        }
        
        // Log the parsed input for debugging
        console.log('Parsed input:', parsedInput);
      } catch (error) {
        // If JSON parsing fails, try CSV
        const inputStr = String(workflow.input_data);
        if (inputStr.includes(',')) {
          const lines = inputStr.split('\n').filter(Boolean);
          if (lines.length >= 2) {
            const headers = lines[0].split(',');
            const values = lines[1].split(',');
            
            // Build nested object structure from dot notation
            headers.forEach((header: string, index: number) => {
              const path = header.trim().split('.');
              let current = parsedInput;
              
              path.forEach((key, i) => {
                if (i === path.length - 1) {
                  current[key] = values[index]?.trim();
                } else {
                  current[key] = current[key] || {};
                  current = current[key] as Record<string, unknown>;
                }
              });
            });
          }
        }
      }
    }
    debug.input = parsedInput

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
        debug.logicBlocks.push({
          name: block.output_name,
          operation: 'equal',
          input: undefined,
          expected: undefined,
          result: false
        })
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
            case 'equal': {
              let comparisonValue = value;
              if (typeof value === 'object') {
                // Extract just the field value for comparison
                const fieldName = block.input_name.split('.').pop();
                comparisonValue = value[fieldName as keyof typeof value];
              }
              const normalizedInput = typeof comparisonValue === 'object' ? JSON.stringify(comparisonValue) : String(comparisonValue)
              const normalizedValue = typeof block.values?.[0] === 'object' ? JSON.stringify(block.values[0]) : String(block.values?.[0] || '')
              primaryResult = normalizedInput === normalizedValue
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'equal',
                input: comparisonValue,
                expected: block.values?.[0],
                result: primaryResult
              })
              break
            }
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
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'neq',
                input: neqComparisonValue,
                expected: block.values?.[0],
                result: primaryResult
              })
              break
            case 'gt':
              primaryResult = Number(value) > Number(block.values?.[0] || 0)
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'gt',
                input: value,
                expected: block.values?.[0],
                result: primaryResult
              })
              break
            case 'gte':
              primaryResult = Number(value) >= Number(block.values?.[0] || 0)
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'gte',
                input: value,
                expected: block.values?.[0],
                result: primaryResult
              })
              break
            case 'lt':
              primaryResult = Number(value) < Number(block.values?.[0] || 0)
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'lt',
                input: value,
                expected: block.values?.[0],
                result: primaryResult
              })
              break
            case 'lte':
              primaryResult = Number(value) <= Number(block.values?.[0] || 0)
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'lte',
                input: value,
                expected: block.values?.[0],
                result: primaryResult
              })
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
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'in',
                input: inComparisonValue,
                expected: block.values?.[0],
                result: primaryResult
              })
              break
            case 'is':
              const isNull = block.values?.[0] === 'null'
              primaryResult = isNull ? value === null : value !== null
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'is',
                input: value,
                expected: block.values?.[0],
                result: primaryResult
              })
              break
            case 'between':
              const numValue = Number(value)
              const min = Number(block.values?.[0] || 0)
              const max = Number(block.values?.[1] || 0)
              primaryResult = numValue >= min && numValue <= max
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'between',
                input: value,
                expected: { min, max },
                result: primaryResult
              })
              break
            case 'has':
              const hasResult = String(value).toLowerCase().includes(String(block.values?.[0] || '').toLowerCase())
              debug.logicBlocks.push({
                name: block.output_name,
                operation: 'has',
                input: value,
                expected: block.values?.[0],
                result: hasResult
              })
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
              debug.logicBlocks.push({
                name: block.output_name,
                operation: condition.operation,
                input: undefined,
                expected: undefined,
                result: false
              })
              return
            }

            // Handle array condition values
            const conditionValues = Array.isArray(conditionValue) ? conditionValue : [conditionValue];
            const condValue = conditionValues[index] || conditionValues[0];
            
            let conditionResult = false;
            switch (condition.operation) {
              case 'equal': {
                const normalizedCondInput = typeof condValue === 'object' ? JSON.stringify(condValue) : String(condValue)
                const normalizedCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
                conditionResult = normalizedCondInput === normalizedCondValue
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'equal',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              }
              case 'neq':
                const neqCondInput = typeof condValue === 'object' ? JSON.stringify(condValue) : String(condValue)
                const neqCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
                conditionResult = neqCondInput !== neqCondValue
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'neq',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              case 'gt':
                conditionResult = Number(condValue) > Number(condition.values?.[0] || 0)
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'gt',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              case 'gte':
                conditionResult = Number(condValue) >= Number(condition.values?.[0] || 0)
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'gte',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              case 'lt':
                conditionResult = Number(condValue) < Number(condition.values?.[0] || 0)
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'lt',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              case 'lte':
                conditionResult = Number(condValue) <= Number(condition.values?.[0] || 0)
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'lte',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              case 'in':
                const listValue = condition.values?.[0]
                const list = typeof listValue === 'string' ? listValue.split(',').map((v: string) => v.trim()) : []
                conditionResult = list.includes(String(condValue))
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'in',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              case 'is':
                const isNull = condition.values?.[0] === 'null'
                conditionResult = isNull ? condValue === null : condValue !== null
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'is',
                  input: condValue,
                  expected: condition.values?.[0],
                  result: conditionResult
                })
                break
              case 'between':
                const value = Number(condValue)
                const min = Number(condition.values?.[0] || 0)
                const max = Number(condition.values?.[1] || 0)
                conditionResult = value >= min && value <= max
                debug.logicBlocks.push({
                  name: block.output_name,
                  operation: 'between',
                  input: value,
                  expected: { min, max },
                  result: conditionResult
                })
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
        // Add previous calculation results
        Object.entries(data).forEach(([key, value]) => {
          context[key] = value
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
          // Handle different types to ensure string output
          if (typeof value === 'boolean') {
            return value ? '1' : '0'
          }
          if (typeof value === 'string') {
            // Handle string booleans
            if (value.toLowerCase() === 'true') return '1'
            if (value.toLowerCase() === 'false') return '0'
            // Try to convert to number
            const num = Number(value)
            return isNaN(num) ? `"${value}"` : String(num)
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
          } catch (syntaxError) {
            throw new Error(`Invalid formula syntax: ${syntaxError}`)
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
          debug.calculations.push({
            name: calc.output_name,
            formula: formula,
            result: result
          })
        } catch (evalError) {
          console.error('Error evaluating formula:', {
            original_formula: rawFormula,
            replaced_formula: formula,
            error: evalError,
            context,
            stack: evalError instanceof Error ? evalError.stack : undefined
          })
          data[calc.output_name] = 0 // Default to 0 on error
          debug.calculations.push({
            name: calc.output_name,
            formula: formula,
            result: 0
          })
        }
      } catch (error) {
        console.error(`Error processing calculation ${calc.output_name}:`, error)
        data[calc.output_name] = 0 // Default to 0 on error
        debug.calculations.push({
          name: calc.output_name,
          formula: calc.formula,
          result: 0
        })
      }
    })

    return { data, debug, error: undefined, isLoading: false }
  } catch (error) {
    console.error('Error in getOutputData:', error)
    return {
      data: {},
      debug: {
        input: {},
        logicBlocks: [] as LogicBlockDebug[],
        calculations: [] as CalculationDebug[]
      },
      error: String(error),
      isLoading: false
    }
  }
}

export function OutputSection({ workflowId, workflow, version, onChange }: OutputSectionProps) {
  const { toast } = useToast()
  const [showDebug, setShowDebug] = useState(false)
  const [isLoadingVersion, setIsLoadingVersion] = useState(false)
  const [totalVersions, setTotalVersions] = useState(workflow?.version || 1)
  const [outputData, setOutputData] = useState<OutputState>({ 
    data: {}, 
    debug: {
      input: {},
      logicBlocks: [] as LogicBlockDebug[],
      calculations: [] as CalculationDebug[]
    }, 
    error: undefined, 
    isLoading: false 
  })

  // Update output data when workflow changes
  useEffect(() => {
    try {
      // Process workflow locally
      const { data: result, debug } = processWorkflow({
        input_data: workflow.input_data,
        logic_blocks: workflow.logic_blocks || [],
        calculations: workflow.calculations || [],
        output_schema: workflow.output_schema || {}
      })
      
      // Filter by output schema if it exists
      const filteredData = workflow.output_schema
        ? Object.fromEntries(
            Object.entries(result).filter(([key]) => workflow.output_schema?.[key] !== false)
          )
        : result

      setOutputData({
        data: filteredData,
        debug: {
          input: debug.input,
          logicBlocks: debug.logicBlocks,
          calculations: debug.calculations
        },
        error: undefined,
        isLoading: false
      })
    } catch (error) {
      console.error('Error processing workflow:', error)
      setOutputData(prev => ({
        ...prev,
        error: String(error),
        isLoading: false
      }))
    }
  }, [workflow.input_data, workflow.logic_blocks, workflow.calculations, workflow.output_schema])

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

      {outputData.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{outputData.error}</AlertDescription>
        </Alert>
      )}

      <div className="bg-muted p-4 rounded-md">
        <pre className="overflow-auto">
          {JSON.stringify(outputData.data, null, 2)}
        </pre>
      </div>

      {showDebug && outputData.debug.logicBlocks.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Logic Blocks</h3>
            <pre className="bg-muted p-4 rounded-md overflow-auto whitespace-pre-wrap">
              {JSON.stringify(outputData.debug.logicBlocks, null, 2)}
            </pre>
          </div>
        </div>
      )}

      {showDebug && outputData.debug.calculations.length > 0 && (
        <div className="space-y-4">
          <div>
            <h3 className="font-medium mb-2">Calculations</h3>
            <pre className="bg-muted p-4 rounded-md overflow-auto whitespace-pre-wrap">
              {JSON.stringify(outputData.debug.calculations, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
} 