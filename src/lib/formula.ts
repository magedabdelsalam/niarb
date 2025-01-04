type FormulaValidationResult = {
  isValid: boolean
  error?: string
}

const ALLOWED_OPERATORS = ['+', '-', '*', '/', '(', ')', '.', '%']
const ALLOWED_FUNCTIONS = ['sum', 'avg', 'min', 'max', 'round', 'floor', 'ceil']

export function validateFormula(formula: string, availableVariables: string[]): FormulaValidationResult {
  if (!formula.trim()) {
    return {
      isValid: false,
      error: 'Formula cannot be empty'
    }
  }

  // Check for invalid characters
  const validChars = /^[a-zA-Z0-9\s+\-*/.()%,]+$/
  if (!validChars.test(formula)) {
    return {
      isValid: false,
      error: 'Formula contains invalid characters'
    }
  }

  // Check for balanced parentheses
  let parentheses = 0
  for (const char of formula) {
    if (char === '(') parentheses++
    if (char === ')') parentheses--
    if (parentheses < 0) {
      return {
        isValid: false,
        error: 'Unmatched closing parenthesis'
      }
    }
  }
  if (parentheses > 0) {
    return {
      isValid: false,
      error: 'Unmatched opening parenthesis'
    }
  }

  // Check for valid variable names
  const variables = formula.match(/[a-zA-Z][a-zA-Z0-9]*/g) || []
  const invalidVariables = variables.filter(v => 
    !ALLOWED_FUNCTIONS.includes(v) && !availableVariables.includes(v)
  )
  if (invalidVariables.length > 0) {
    return {
      isValid: false,
      error: `Unknown variables: ${invalidVariables.join(', ')}`
    }
  }

  // Check for valid operators
  const operators = formula.match(/[+\-*/%()]/g) || []
  const invalidOperators = operators.filter(op => !ALLOWED_OPERATORS.includes(op))
  if (invalidOperators.length > 0) {
    return {
      isValid: false,
      error: `Invalid operators: ${invalidOperators.join(', ')}`
    }
  }

  return { isValid: true }
}

export function evaluateFormula(formula: string, context: Record<string, any>): number {
  // Create a safe evaluation context with only allowed functions
  const safeContext = {
    ...context,
    sum: (...args: number[]) => args.reduce((a, b) => a + b, 0),
    avg: (...args: number[]) => args.reduce((a, b) => a + b, 0) / args.length,
    min: (...args: number[]) => Math.min(...args),
    max: (...args: number[]) => Math.max(...args),
    round: (n: number) => Math.round(n),
    floor: (n: number) => Math.floor(n),
    ceil: (n: number) => Math.ceil(n),
  }

  try {
    // Replace variable names with context access
    const processedFormula = formula.replace(
      /[a-zA-Z][a-zA-Z0-9]*/g,
      match => ALLOWED_FUNCTIONS.includes(match) ? match : `context.${match}`
    )

    // Create a function that evaluates the formula in the safe context
    const evaluator = new Function('context', `return ${processedFormula}`)
    return evaluator(safeContext)
  } catch (error) {
    console.error('Error evaluating formula:', error)
    throw new Error('Invalid formula')
  }
} 