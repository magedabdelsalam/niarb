import { createClient } from '@/utils/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { Database, Json } from '@/types/supabase'

type Workflow = Database['public']['Tables']['workflows']['Row']
type WorkflowInput = Database['public']['Tables']['workflow_inputs']['Row']

interface LogicBlock {
  id?: string
  output_name: string
  output_value: string | boolean | number
  default_value?: string | boolean | number
  conditions?: Array<{
    input_name?: string
    operation?: 'equal' | 'lte' | 'gte' | 'has' | 'in'
    operator?: 'and' | 'or'
    values?: any[]
    value?: any
  }>
  values?: any[]
  operation?: 'equal' | 'lte' | 'gte' | 'has' | 'in'
  input_name?: string
}

interface Calculation {
  id?: string
  output_name: string
  formula: string
}

// Function to get value from nested path
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
}

// Function to process workflow logic and calculate output
function processWorkflow(workflow: Workflow, inputData: Json) {
  try {
    let data: Record<string, any> = {}
    let parsedInput: Record<string, any> = {}

    // Parse input data
    if (typeof inputData === 'string') {
      parsedInput = JSON.parse(inputData)
    } else if (typeof inputData === 'object' && inputData !== null) {
      parsedInput = inputData
    } else {
      throw new Error('Invalid input data format')
    }

    // Process logic blocks
    const logicBlocks = (workflow.logic_blocks as unknown as LogicBlock[]) || []
    console.log('Processing logic blocks:', logicBlocks)
    
    logicBlocks.forEach((block) => {
      if (!block.output_name) return
      console.log('Processing block:', block)

      try {
        let finalResult = true

        // Get input value - check both parsedInput and data (previous outputs)
        const inputValue = block.input_name?.startsWith('is_') || block.input_name?.startsWith('valid_')
          ? data[block.input_name || '']
          : getNestedValue(parsedInput, block.input_name || '')

        console.log('Input value:', {
          name: block.input_name,
          value: inputValue,
          source: block.input_name?.startsWith('is_') || block.input_name?.startsWith('valid_') ? 'previous_output' : 'input_data'
        })

        // Process main operation first
        if (block.operation && block.values) {
          console.log('Processing main operation:', {
            operation: block.operation,
            input: inputValue,
            values: block.values
          })

          switch (block.operation) {
            case 'equal':
              finalResult = String(inputValue).toLowerCase() === String(block.values[0]).toLowerCase()
              break
            case 'lte':
              finalResult = Number(inputValue) <= Number(block.values[0])
              break
            case 'gte':
              finalResult = Number(inputValue) >= Number(block.values[0])
              break
            case 'has':
              if (Array.isArray(inputValue)) {
                finalResult = inputValue.some(item => {
                  if (typeof item === 'object') {
                    return Object.values(item).some(val =>
                      block.values!.some(value =>
                        String(val).toLowerCase().includes(String(value).toLowerCase())
                      )
                    )
                  }
                  return block.values!.some(value =>
                    String(item).toLowerCase().includes(String(value).toLowerCase())
                  )
                })
              }
              break
            case 'in':
              if (Array.isArray(inputValue)) {
                finalResult = inputValue.some(item =>
                  block.values!.includes(item)
                )
              }
              break
            default:
              finalResult = false
          }

          console.log('Operation result:', {
            operation: block.operation,
            input: inputValue,
            expected: block.values[0],
            result: finalResult
          })
        }

        // Process conditions if they exist and main operation passed
        if (finalResult && block.conditions && block.conditions.length > 0) {
          finalResult = block.conditions.every(condition => {
            // Get condition value from previous outputs
            const conditionValue = data[condition.input_name || '']
            console.log('Condition check:', {
              input: condition.input_name,
              value: conditionValue,
              expected: condition.values?.[0],
              operator: condition.operator,
              operation: condition.operation
            })
            
            let conditionResult = false
            switch (condition.operation) {
              case 'equal':
                conditionResult = Number(conditionValue) === Number(condition.values?.[0])
                break
              case 'lte':
                conditionResult = Number(conditionValue) <= Number(condition.values?.[0])
                break
              case 'gte':
                conditionResult = Number(conditionValue) >= Number(condition.values?.[0])
                break
              default:
                conditionResult = false
            }

            console.log('Individual condition result:', {
              input: condition.input_name,
              value: conditionValue,
              expected: condition.values?.[0],
              operation: condition.operation,
              result: conditionResult
            })

            return conditionResult
          })

          console.log('All conditions result:', {
            conditions: block.conditions,
            result: finalResult
          })
        }

        // Set the output value based on the final result
        const outputValue = finalResult ? block.output_value : (block.default_value ?? false)
        data[block.output_name] = outputValue
        console.log(`Logic block result for ${block.output_name}:`, {
          finalResult,
          output: outputValue,
          input: block.input_name,
          operation: block.operation,
          conditions: block.conditions
        })
      } catch (error) {
        console.error('Error processing logic block:', error)
        data[block.output_name] = block.default_value ?? false
      }
    })

    // Process calculations
    const calculations = (workflow.calculations as unknown as Calculation[]) || []
    calculations.forEach((calc) => {
      if (!calc.output_name) return

      try {
        // Create a context with logic block results
        const context = { ...data }
        
        // Evaluate formula with context
        const formula = calc.formula.replace(/\${([\w.]+)}/g, (_: string, key: string) => {
          const value = context[key]
          if (value === undefined) {
            throw new Error(`Variable ${key} not found in context`)
          }
          return typeof value === 'string' ? `"${value}"` : value
        })
        
        console.log('Evaluating formula:', {
          formula,
          context
        })
        
        const result = new Function(`return ${formula}`)()
        data[calc.output_name] = result
        console.log(`Calculation result for ${calc.output_name}:`, result)
      } catch (error) {
        console.error('Error processing calculation:', error)
        data[calc.output_name] = null
      }
    })

    console.log('Final processed data:', data)
    return data
  } catch (error) {
    console.error('Error processing workflow:', error)
    throw error
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { searchParams } = new URL(request.url)
    const inputId = searchParams.get('input_id')
    const { id } = await params

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    if (!inputId) {
      return NextResponse.json(
        { error: 'Input ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Get the workflow
    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (workflowError || !workflow) {
      console.error('Workflow error:', workflowError)
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    console.log('Found workflow:', {
      id: workflow.id,
      name: workflow.name,
      logic_blocks: workflow.logic_blocks,
      calculations: workflow.calculations,
      output_schema: workflow.output_schema
    })

    // Get the workflow input
    const { data: input, error: inputError } = await supabase
      .from('workflow_inputs')
      .select('*')
      .eq('id', inputId)
      .eq('workflow_id', id)
      .single()

    if (inputError || !input) {
      console.error('Input error:', inputError)
      return NextResponse.json(
        { error: 'Input not found' },
        { status: 404 }
      )
    }

    console.log('Found input:', {
      id: input.id,
      workflow_id: input.workflow_id,
      input_data: input.input_data
    })

    // Process the workflow
    console.log('Starting workflow processing...')
    console.log('Input data:', input.input_data)
    console.log('Workflow configuration:', {
      logic_blocks: workflow.logic_blocks,
      calculations: workflow.calculations,
      output_schema: workflow.output_schema
    })
    
    // Always reprocess the workflow to get fresh output
    const output = processWorkflow(workflow, input.input_data)
    console.log('Processed output:', output)

    try {
      // Save the output and logic to the database
      const { error: updateError } = await supabase
        .from('workflow_inputs')
        .update({
          output_data: output,
          logic_data: {
            logic_blocks: workflow.logic_blocks,
            calculations: workflow.calculations
          }
        })
        .eq('id', inputId)

      if (updateError) {
        console.error('Error saving output:', updateError)
        return NextResponse.json(
          { error: 'Failed to save output' },
          { status: 500 }
        )
      }

      // Return the processed output
      return NextResponse.json({
        output,
        debug: {
          input_data: input.input_data,
          logic_blocks: workflow.logic_blocks,
          calculations: workflow.calculations
        }
      })
    } catch (error: any) {
      console.error('Error saving output:', error)
      return NextResponse.json(
        { error: error.message || 'Failed to save output' },
        { status: 500 }
      )
    }
  } catch (error: any) {
    console.error('Error processing workflow:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to process workflow' },
      { status: 500 }
    )
  }
} 