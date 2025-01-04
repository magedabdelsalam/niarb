import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import type { Workflow, LogicBlock, Calculation, Condition } from '@/types/workflow'

// Helper function to get nested value
function getNestedValue(obj: any, path: string) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined
  }, obj)
}

function processWorkflow(workflow: Workflow, inputData: any) {
  try {
    let data: Record<string, any> = {}
    let parsedInput: Record<string, any> = {}

    // Parse input data
    if (typeof inputData === 'string') {
      parsedInput = JSON.parse(inputData)
    } else {
      parsedInput = inputData
    }

    // Process logic blocks
    workflow.logic_blocks?.forEach((block: LogicBlock) => {
      if (!block.output_name) return

      // Evaluate primary condition using nested value access
      const inputValue = getNestedValue(parsedInput, block.input_name)
      if (inputValue === undefined) {
        return
      }

      let primaryResult = false
      switch (block.operation) {
        case 'equal':
          const normalizedInput = typeof inputValue === 'object' ? JSON.stringify(inputValue) : String(inputValue)
          const normalizedValue = typeof block.values?.[0] === 'object' ? JSON.stringify(block.values[0]) : String(block.values?.[0] || '')
          primaryResult = normalizedInput === normalizedValue
          break
        case 'neq':
          const neqInput = typeof inputValue === 'object' ? JSON.stringify(inputValue) : String(inputValue)
          const neqValue = typeof block.values?.[0] === 'object' ? JSON.stringify(block.values[0]) : String(block.values?.[0] || '')
          primaryResult = neqInput !== neqValue
          break
        case 'gt':
          primaryResult = Number(inputValue) > Number(block.values?.[0] || 0)
          break
        case 'gte':
          primaryResult = Number(inputValue) >= Number(block.values?.[0] || 0)
          break
        case 'lt':
          primaryResult = Number(inputValue) < Number(block.values?.[0] || 0)
          break
        case 'lte':
          primaryResult = Number(inputValue) <= Number(block.values?.[0] || 0)
          break
        case 'in':
          const listValue = block.values?.[0]
          const list = typeof listValue === 'string' ? listValue.split(',').map((v: string) => v.trim()) : []
          primaryResult = list.includes(String(inputValue))
          break
        case 'is':
          const isNull = block.values?.[0] === 'null'
          primaryResult = isNull ? inputValue === null : inputValue !== null
          break
        case 'between':
          const value = Number(inputValue)
          const min = Number(block.values?.[0] || 0)
          const max = Number(block.values?.[1] || 0)
          primaryResult = value >= min && value <= max
          break
      }

      // Evaluate additional conditions
      let finalResult = primaryResult
      block.conditions?.forEach((condition: Condition) => {
        // Use nested value access for conditions too
        const conditionValue = getNestedValue(parsedInput, condition.input_name)
        if (conditionValue === undefined) {
          return
        }

        let conditionResult = false
        switch (condition.operation) {
          case 'equal':
            const normalizedCondInput = typeof conditionValue === 'object' ? JSON.stringify(conditionValue) : String(conditionValue)
            const normalizedCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
            conditionResult = normalizedCondInput === normalizedCondValue
            break
          case 'neq':
            const neqCondInput = typeof conditionValue === 'object' ? JSON.stringify(conditionValue) : String(conditionValue)
            const neqCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
            conditionResult = neqCondInput !== neqCondValue
            break
          case 'gt':
            conditionResult = Number(conditionValue) > Number(condition.values?.[0] || 0)
            break
          case 'gte':
            conditionResult = Number(conditionValue) >= Number(condition.values?.[0] || 0)
            break
          case 'lt':
            conditionResult = Number(conditionValue) < Number(condition.values?.[0] || 0)
            break
          case 'lte':
            conditionResult = Number(conditionValue) <= Number(condition.values?.[0] || 0)
            break
          case 'in':
            const listValue = condition.values?.[0]
            const list = typeof listValue === 'string' ? listValue.split(',').map((v: string) => v.trim()) : []
            conditionResult = list.includes(String(conditionValue))
            break
          case 'is':
            const isNull = condition.values?.[0] === 'null'
            conditionResult = isNull ? conditionValue === null : conditionValue !== null
            break
          case 'between':
            const value = Number(conditionValue)
            const min = Number(condition.values?.[0] || 0)
            const max = Number(condition.values?.[1] || 0)
            conditionResult = value >= min && value <= max
            break
        }

        // Apply AND/OR operator
        if (condition.operator === 'and') {
          finalResult = finalResult && conditionResult
        } else {
          finalResult = finalResult || conditionResult
        }
      })

      data[block.output_name] = finalResult ? block.output_value : (block.default_value || "")
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
        
        // Evaluate formula with context, supporting nested paths
        const formula = calc.formula.replace(/\${([\w.]+)}/g, (_: string, key: string) => {
          const value = getNestedValue(context, key)
          if (value === undefined) {
            throw new Error(`Variable ${key} not found in context`)
          }
          return typeof value === 'string' ? `"${value}"` : value
        })
        
        const result = new Function(`return ${formula}`)()
        data[calc.output_name] = result
      } catch (error) {
        console.error('Error processing calculation:', error)
      }
    })

    // Filter by output schema
    return Object.fromEntries(
      Object.entries(data).filter(([key]) => workflow.output_schema?.[key] === true)
    )
  } catch (error) {
    console.error('Error processing workflow:', error)
    throw error
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const input_id = searchParams.get('input_id')

    if (!id) {
      return NextResponse.json(
        { error: 'Workflow ID is required' },
        { status: 400 }
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    // Get the workflow
    const { data: workflowData, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single()

    if (workflowError || !workflowData) {
      return NextResponse.json(
        { error: 'Workflow not found' },
        { status: 404 }
      )
    }

    // Parse the workflow data to ensure proper typing
    const workflow: Workflow = {
      ...workflowData,
      input_schema: workflowData.input_schema || [],
      logic_blocks: workflowData.logic_blocks || [],
      calculations: workflowData.calculations || [],
      output_schema: workflowData.output_schema || {}
    }

    // Get the input data
    const { data: inputData, error: inputError } = await supabase
      .from('workflow_inputs')
      .select('input_data')
      .eq('workflow_id', id)
      .eq('id', input_id)
      .single()

    if (inputError || !inputData) {
      return NextResponse.json(
        { error: 'Input data not found' },
        { status: 404 }
      )
    }

    // Process the workflow
    const output = processWorkflow(workflow, inputData.input_data)

    // Filter output by output schema
    const filteredOutput = Object.fromEntries(
      Object.entries(output).filter(([key]) => workflow.output_schema?.[key] === true)
    )

    return NextResponse.json({ output: filteredOutput })
  } catch (error) {
    console.error('Error processing output:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
} 