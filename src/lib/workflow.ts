import { LogicBlock, Workflow } from '@/types/workflow'

function evaluateCondition(
  condition: any,
  inputData: Record<string, any>
): boolean {
  const value = inputData[condition.input_name]
  console.log('Evaluating condition:', { condition, value })
  switch (condition.operator) {
    case 'equals':
      return String(value).toLowerCase() === String(condition.value).toLowerCase()
    case 'not_equals':
      return String(value).toLowerCase() !== String(condition.value).toLowerCase()
    case 'greater_than':
      return value > condition.value
    case 'less_than':
      return value < condition.value
    case 'contains':
      return value?.includes(condition.value)
    default:
      return false
  }
}

function evaluateLogicBlock(
  block: LogicBlock,
  inputData: Record<string, any>
): any {
  console.log('Evaluating block:', { block, inputData })
  
  // Check conditions if they exist
  if (block.conditions && block.conditions.length > 0) {
    const allConditionsMet = block.conditions.every(condition =>
      evaluateCondition(condition, inputData)
    )
    console.log('Conditions evaluation result:', allConditionsMet)
    if (!allConditionsMet) {
      console.log('Using default value:', block.default_value)
      return block.default_value || ''
    }
  }

  const inputValue = inputData[block.input_name]
  console.log('Input value:', inputValue)

  // Process the input value based on the operation
  switch (block.operation) {
    case 'direct':
      return inputValue
    case 'transform':
      // Apply transformation based on values array
      for (const value of block.values as any[]) {
        if (evaluateCondition(value, inputData)) {
          console.log('Transform condition met:', value)
          return value.output_value
        }
      }
      console.log('No transform conditions met, using default:', block.default_value)
      return block.default_value || ''
    case 'calculate':
      // Perform calculation based on output_operator
      const numericValue = parseFloat(inputValue)
      if (isNaN(numericValue)) {
        console.log('Invalid numeric value, using default:', block.default_value)
        return block.default_value || ''
      }
      
      const operationValue = parseFloat(block.output_value || '0')
      console.log('Calculation values:', { numericValue, operationValue })
      switch (block.output_operator) {
        case 'add':
          return numericValue + operationValue
        case 'subtract':
          return numericValue - operationValue
        case 'multiply':
          return numericValue * operationValue
        case 'divide':
          return operationValue !== 0 ? numericValue / operationValue : block.default_value || ''
        default:
          return block.default_value || ''
      }
    case 'equal':
      // Check if input value equals any of the values
      const values = block.values as string[]
      console.log('Checking equality:', { inputValue, values })
      if (values.some(v => String(inputValue).toLowerCase() === String(v).toLowerCase())) {
        return block.output_value
      }
      return block.default_value || ''
    case 'between':
      // Check if input value is between the two values
      const [min, max] = (block.values as string[]).map(Number)
      const value = Number(inputValue)
      console.log('Checking between:', { value, min, max })
      if (!isNaN(value) && !isNaN(min) && !isNaN(max) && value >= min && value <= max) {
        return block.output_value
      }
      return block.default_value || ''
    default:
      return block.default_value || ''
  }
}

export function processWorkflow(
  workflow: Workflow,
  inputData: Record<string, any>
): Record<string, any> {
  console.log('Processing workflow:', workflow)
  console.log('Input data:', inputData)
  
  const output: Record<string, any> = {}

  // Process logic blocks
  for (const block of workflow.logic_blocks) {
    output[block.output_name] = evaluateLogicBlock(block, inputData)
    console.log('Block output:', { name: block.output_name, value: output[block.output_name] })
  }

  // Process calculations
  for (const calc of workflow.calculations || []) {
    try {
      // Replace variables in formula with their values
      let formula = calc.formula
      for (const [key, value] of Object.entries(inputData)) {
        formula = formula.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), String(value))
      }
      for (const [key, value] of Object.entries(output)) {
        formula = formula.replace(new RegExp(`\\$\\{${key}\\}`, 'g'), JSON.stringify(value))
      }
      console.log('Evaluating formula:', formula)
      output[calc.output_name] = eval(formula)
      console.log('Calculation output:', { name: calc.output_name, value: output[calc.output_name] })
    } catch (error) {
      console.error('Error evaluating formula:', error)
      output[calc.output_name] = null
    }
  }

  console.log('Final output:', output)
  
  // Filter by output schema
  const filteredOutput = Object.fromEntries(
    Object.entries(output).filter(([key]) => workflow.output_schema?.[key] === true)
  )
  
  console.log('Processed output:', filteredOutput)
  return filteredOutput
} 