import type { Workflow, LogicBlock, Calculation, Condition } from '@/types/workflow'

type WorkflowData = Pick<Workflow, 'input_data' | 'logic_blocks' | 'calculations' | 'output_schema'>

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

interface ProcessResult {
  data: Record<string, any>
  debug: {
    input: Record<string, unknown>
    logicBlocks: LogicBlockDebug[]
    calculations: CalculationDebug[]
  }
}

// Helper function to get nested value
function getNestedValue(obj: any, path: string): any {
  // Log the input for debugging
  console.log('Getting nested value:', { path, obj })

  // Handle array notation in path (e.g., "items[0].name" or "items.0.name")
  const normalizedPath = path.replace(/\[(\d+)\]/g, '.$1')
  const keys = normalizedPath.split('.')

  function traverse(current: any, remainingKeys: string[]): any {
    if (remainingKeys.length === 0) return current

    const key = remainingKeys[0]
    const rest = remainingKeys.slice(1)

    if (current === null || current === undefined) {
      console.log('Path traversal stopped at:', key)
      return undefined
    }

    // If we're at an array
    if (Array.isArray(current)) {
      // If key is numeric, get that specific index
      if (/^\d+$/.test(key)) {
        return traverse(current[Number(key)], rest)
      }
      // If key is not numeric, traverse all array items and collect results
      const results = current.map(item => traverse(item, [key, ...rest]))
      return results.flat().filter(x => x !== undefined)
    }

    // If we're at an object
    if (typeof current === 'object') {
      return traverse(current[key], rest)
    }

    console.log('Cannot traverse further from:', current)
    return undefined
  }

  const result = traverse(obj, keys)
  console.log('Found value:', result)
  return result
}

export function processWorkflow(workflow: WorkflowData): ProcessResult {
  try {
    let data: Record<string, any> = {}
    let debug = {
      input: {},
      logicBlocks: [] as LogicBlockDebug[],
      calculations: [] as CalculationDebug[]
    }
    let parsedInput: Record<string, any> = {}

    // Parse input data
    if (typeof workflow.input_data === 'string') {
      parsedInput = JSON.parse(workflow.input_data)
    } else {
      parsedInput = workflow.input_data || {}
    }

    debug.input = parsedInput

    // Process all logic blocks first
    workflow.logic_blocks?.forEach((block: LogicBlock) => {
      if (!block.output_name) return

      // Evaluate primary condition using nested value access
      const inputValue = getNestedValue(parsedInput, block.input_name)
      if (inputValue === undefined) {
        data[block.output_name] = block.default_value || ""
        debug.logicBlocks.push({
          name: block.output_name,
          operation: block.operation,
          input: undefined,
          expected: block.values?.[0],
          result: false
        })
        return
      }

      let primaryResult = false
      try {
        switch (block.operation) {
          case 'equal':
            const normalizedInput = typeof inputValue === 'object' ? JSON.stringify(inputValue) : String(inputValue)
            const normalizedValue = typeof block.values?.[0] === 'object' ? JSON.stringify(block.values[0]) : String(block.values?.[0] || '')
            primaryResult = normalizedInput === normalizedValue
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'equal',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
          case 'neq':
            const neqInput = typeof inputValue === 'object' ? JSON.stringify(inputValue) : String(inputValue)
            const neqValue = typeof block.values?.[0] === 'object' ? JSON.stringify(block.values[0]) : String(block.values?.[0] || '')
            primaryResult = neqInput !== neqValue
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'neq',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
          case 'gt':
            primaryResult = Number(inputValue) > Number(block.values?.[0] || 0)
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'gt',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
          case 'gte':
            primaryResult = Number(inputValue) >= Number(block.values?.[0] || 0)
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'gte',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
          case 'lt':
            primaryResult = Number(inputValue) < Number(block.values?.[0] || 0)
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'lt',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
          case 'lte':
            primaryResult = Number(inputValue) <= Number(block.values?.[0] || 0)
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'lte',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
          case 'in':
            const listValue = block.values?.[0]
            let list: any[]
            if (Array.isArray(listValue)) {
              list = listValue
            } else if (typeof listValue === 'string') {
              list = listValue.split(',').map((v: string) => v.trim())
            } else {
              list = []
            }

            // Handle different input types
            let valuesToCheck: any[]
            if (Array.isArray(inputValue)) {
              // If input is array, check if any element matches any element in list
              valuesToCheck = inputValue
            } else if (typeof inputValue === 'object' && inputValue !== null) {
              // If input is object, check all its values
              valuesToCheck = Object.values(inputValue)
            } else {
              // Single value
              valuesToCheck = [inputValue]
            }

            primaryResult = valuesToCheck.some(value => {
              return list.some(item => {
                const normalizedItem = typeof item === 'object' ? JSON.stringify(item) : String(item)
                const normalizedValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
                return normalizedItem === normalizedValue
              })
            })

            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'in',
              input: inputValue,
              expected: list,
              result: primaryResult
            })
            break
          case 'is':
            const isNull = block.values?.[0] === 'null'
            primaryResult = isNull ? inputValue === null : inputValue !== null
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'is',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
          case 'between':
            const value = Number(inputValue)
            const min = Number(block.values?.[0] || 0)
            const max = Number(block.values?.[1] || 0)
            primaryResult = value >= min && value <= max
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'between',
              input: inputValue,
              expected: { min, max },
              result: primaryResult
            })
            break
          case 'has':
            primaryResult = String(inputValue).toLowerCase().includes(String(block.values?.[0] || '').toLowerCase())
            debug.logicBlocks.push({
              name: block.output_name,
              operation: 'has',
              input: inputValue,
              expected: block.values?.[0],
              result: primaryResult
            })
            break
        }

        // Evaluate additional conditions
        let finalResult = primaryResult
        block.conditions?.forEach((condition: Condition) => {
          const conditionValue = getNestedValue(parsedInput, condition.input_name)
          if (conditionValue === undefined) return

          let conditionResult = false
          switch (condition.operation) {
            case 'equal':
              const normalizedCondInput = typeof conditionValue === 'object' ? JSON.stringify(conditionValue) : String(conditionValue)
              const normalizedCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
              conditionResult = normalizedCondInput === normalizedCondValue
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'equal',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
            case 'neq':
              const neqCondInput = typeof conditionValue === 'object' ? JSON.stringify(conditionValue) : String(conditionValue)
              const neqCondValue = typeof condition.values?.[0] === 'object' ? JSON.stringify(condition.values[0]) : String(condition.values?.[0] || '')
              conditionResult = neqCondInput !== neqCondValue
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'neq',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
            case 'gt':
              conditionResult = Number(conditionValue) > Number(condition.values?.[0] || 0)
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'gt',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
            case 'gte':
              conditionResult = Number(conditionValue) >= Number(condition.values?.[0] || 0)
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'gte',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
            case 'lt':
              conditionResult = Number(conditionValue) < Number(condition.values?.[0] || 0)
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'lt',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
            case 'lte':
              conditionResult = Number(conditionValue) <= Number(condition.values?.[0] || 0)
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'lte',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
            case 'in':
              const condListValue = condition.values?.[0]
              let condList: any[]
              if (Array.isArray(condListValue)) {
                condList = condListValue
              } else if (typeof condListValue === 'string') {
                condList = condListValue.split(',').map((v: string) => v.trim())
              } else {
                condList = []
              }

              // Handle different input types
              let condValuesToCheck: any[]
              if (Array.isArray(conditionValue)) {
                // If input is array, check if any element matches any element in list
                condValuesToCheck = conditionValue
              } else if (typeof conditionValue === 'object' && conditionValue !== null) {
                // If input is object, check all its values
                condValuesToCheck = Object.values(conditionValue)
              } else {
                // Single value
                condValuesToCheck = [conditionValue]
              }

              conditionResult = condValuesToCheck.some(value => {
                return condList.some(item => {
                  const normalizedItem = typeof item === 'object' ? JSON.stringify(item) : String(item)
                  const normalizedValue = typeof value === 'object' ? JSON.stringify(value) : String(value)
                  return normalizedItem === normalizedValue
                })
              })

              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'in',
                input: conditionValue,
                expected: condList,
                result: conditionResult
              })
              break
            case 'is':
              const isNull = condition.values?.[0] === 'null'
              conditionResult = isNull ? conditionValue === null : conditionValue !== null
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'is',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
            case 'between':
              const value = Number(conditionValue)
              const min = Number(condition.values?.[0] || 0)
              const max = Number(condition.values?.[1] || 0)
              conditionResult = value >= min && value <= max
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'between',
                input: conditionValue,
                expected: { min, max },
                result: conditionResult
              })
              break
            case 'has':
              conditionResult = String(conditionValue).toLowerCase().includes(String(condition.values?.[0] || '').toLowerCase())
              debug.logicBlocks.push({
                name: `${block.output_name} (condition)`,
                operation: 'has',
                input: conditionValue,
                expected: condition.values?.[0],
                result: conditionResult
              })
              break
          }

          if (condition.operator === 'and') {
            finalResult = finalResult && conditionResult
          } else {
            finalResult = finalResult || conditionResult
          }
        })

        // Set the output value based on the final result
        if (finalResult) {
          data[block.output_name] = 1
        } else {
          // Use default value when logic block evaluates to false
          data[block.output_name] = block.default_value !== undefined ? block.default_value : 0
        }
      } catch (error) {
        console.error('Error evaluating logic block:', error)
        // Use default value on error
        data[block.output_name] = block.default_value !== undefined ? block.default_value : 0
      }
    })

    // Create context with all logic block results
    const context = { ...parsedInput, ...data }

    // Process calculations in order, updating context after each one
    workflow.calculations?.forEach((calc: Calculation) => {
      if (!calc.output_name) return

      try {
        // Replace variables with their values from context
        const formula = calc.formula.replace(/\${([\w.]+)}/g, (_: string, key: string) => {
          const value = getNestedValue(context, key)
          if (value === undefined || value === '') {
            console.warn(`Variable ${key} not found in context or is empty, using 0`)
            return "0"
          }
          return typeof value === 'string' ? `"${value}"` : value
        })
        
        // Convert empty strings to 0 and ensure proper numeric operations
        const normalizedFormula = formula
          // Convert empty string literals to 0
          .replace(/''\s*[\+\-\*\/]\s*/g, '0 ')
          .replace(/\s*[\+\-\*\/]\s*''/g, ' 0')
          .replace(/""\s*[\+\-\*\/]\s*/g, '0 ')
          .replace(/\s*[\+\-\*\/]\s*""/g, ' 0')
          // Handle numeric comparisons by converting string numbers to numbers
          .replace(/("[^"]*"|'[^']*')\s*(>=|<=|>|<)\s*(\d+)/g, 'Number($1) $2 $3')
          .replace(/(\d+)\s*(>=|<=|>|<)\s*("[^"]*"|'[^']*')/g, '$1 $2 Number($3)')
          // Convert remaining empty strings to 0 for boolean contexts
          .replace(/''/g, '0')
          .replace(/""/g, '0')
        
        console.log('Processing calculation:', {
          original: formula,
          normalized: normalizedFormula
        })
        
        const result = new Function(`return ${normalizedFormula}`)()
        
        // Ensure numeric result when appropriate
        const finalResult = typeof result === 'string' && /^\d+$/.test(result) 
          ? Number(result) 
          : result
        
        data[calc.output_name] = finalResult
        context[calc.output_name] = finalResult
        debug.calculations.push({
          name: calc.output_name,
          formula: normalizedFormula,
          result: finalResult
        })
      } catch (error) {
        console.error('Error processing calculation:', error)
        data[calc.output_name] = 0
        context[calc.output_name] = 0
        debug.calculations.push({
          name: calc.output_name,
          formula: calc.formula,
          result: 0
        })
      }
    })

    return { data, debug }
  } catch (error) {
    console.error('Error processing workflow:', error)
    return {
      data: {},
      debug: {
        input: {},
        logicBlocks: [],
        calculations: []
      }
    }
  }
} 