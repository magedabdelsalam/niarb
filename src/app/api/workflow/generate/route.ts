import { NextResponse } from 'next/server'
import type { LogicBlock, Calculation } from '@/types/workflow'

export async function POST(request: Request) {
  try {
    const { description, input_data, model_name, api_key } = await request.json()

    // Validate required fields
    if (!description || !input_data || !model_name || !api_key) {
      return NextResponse.json(
        { message: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Parse input data
    let parsedInput
    try {
      parsedInput = JSON.parse(input_data)
    } catch (e) {
      return NextResponse.json(
        { message: 'Invalid input data format' },
        { status: 400 }
      )
    }

    // Get input schema from the parsed input
    const inputSchema = Object.keys(parsedInput)

    // Prepare the prompt for the AI
    const prompt = `Given this description of what the workflow should do:
${description}

And this example input data:
${JSON.stringify(parsedInput, null, 2)}

The available input fields that you can use creatively are:
${inputSchema.map((field: string) => `- ${field}`).join('\n')}

Think creatively about how to use these fields to solve the problem. For example:
- Look for patterns in nested objects and arrays
- Check for keywords in text fields
- Compare dates and calculate durations
- Count occurrences of specific values
- Combine multiple fields to make complex decisions
- Use array operations to find relevant items
- Check for specific values in nested structures

Generate a workflow that processes this data according to the description.
Return a JSON object (without any markdown formatting, code blocks, or explanation) that has these fields:
1. logic_blocks: Array of logic blocks that process the input data
2. calculations: Array of calculations that compute new values
3. output_schema: Object specifying which fields should be included in the output

Each logic block should have:
- input_name: One of the available input fields listed above (can include array indices and nested paths like 'work_experience[0].job_title')
- operation: the operation to perform (see detailed operation list below)
- values: the values to compare against (can be arrays, numbers, or strings)
- output_name: a descriptive name for the output field
- output_value: a number (like 25) if being used in calculations, or any other value if not
- default_value: a number (like 0) if being used in calculations, or any other value if not
- conditions: Array of additional conditions that must be met (optional)

Complex Conditions:
Each logic block can have additional conditions that must be met. Each condition has:
- operator: 'and' or 'or' (how this condition combines with the previous ones)
- input_name: The field to check
- operation: Same operations as main logic block
- values: Values to compare against

Examples of complex conditions:
1. Check if someone is a senior designer AND has 5+ years experience:
   {
     "input_name": "job_title",
     "operation": "has",
     "values": ["Senior"],
     "output_name": "is_senior_designer",
     "output_value": 100,
     "default_value": 0,
     "conditions": [{
       "operator": "and",
       "input_name": "years_experience",
       "operation": "gte",
       "values": ["5"]
     }]
   }

2. Check if someone knows either React OR Angular:
   {
     "input_name": "skills",
     "operation": "in",
     "values": ["React"],
     "output_name": "knows_modern_frontend",
     "output_value": 100,
     "default_value": 0,
     "conditions": [{
       "operator": "or",
       "input_name": "skills",
       "operation": "in",
       "values": ["Angular"]
     }]
   }

3. Multiple conditions with mixed operators:
   {
     "input_name": "department",
     "operation": "equal",
     "values": ["Engineering"],
     "output_name": "is_senior_engineer",
     "output_value": 100,
     "default_value": 0,
     "conditions": [{
       "operator": "and",
       "input_name": "years_experience",
       "operation": "gte",
       "values": ["5"]
     }, {
       "operator": "and",
       "input_name": "level",
       "operation": "gte",
       "values": ["3"]
     }, {
       "operator": "or",
       "input_name": "is_team_lead",
       "operation": "equal",
       "values": ["true"]
     }]
   }

IMPORTANT: When using conditions:
1. Use 'and' when all conditions must be true
2. Use 'or' when any condition can be true
3. Conditions are evaluated in order
4. Each condition can use any available operation
5. Earlier logic block results can be used in later conditions
6. All output_values should be numbers if used in calculations

Available operations and their specific uses:
- equal: Exact match comparison (e.g., status === "active")
- neq: Not equal comparison (e.g., status !== "inactive")
- gt: Greater than for numbers (e.g., age > 18)
- gte: Greater than or equal for numbers (e.g., experience >= 5)
- lt: Less than for numbers (e.g., errors < 3)
- lte: Less than or equal for numbers (e.g., price <= 100)
- in: Check if a value exists in a list (e.g., "javascript" in ["javascript", "python"])
- is: Check if a value is null or not null
- between: Check if a number is within a range (inclusive)
- has: Check if a string contains a substring (case-insensitive)

IMPORTANT: Choose the correct operation based on the data type and comparison needed:
- For exact matches (equality): use 'equal'
- For checking if a value exists in an array: use 'in'
- For checking if text contains a substring: use 'has'
- For numeric comparisons: use 'gt', 'gte', 'lt', 'lte'
- For range checks: use 'between'
- For null checks: use 'is'

Each calculation should have:
- formula: a JavaScript expression as a string that evaluates to a number, using input fields and logic block results (wrapped in \${})
  Examples:
  - Simple addition: "\${score1} + \${score2}"
  - With number conversion: "Number(\${score1}) + Number(\${score2})"
  - With boolean conversion: "\${has_experience} ? 50 : 0"
  - Complex scoring: "(Number(\${experience_score}) + Number(\${skill_score})) * (\${is_qualified} ? 1 : 0.5)"
  IMPORTANT: The formula must be a string containing a JavaScript expression that evaluates to a number
  INCORRECT: { "match_score": "some_value" }
  INCORRECT: "\${match_score}"
  INCORRECT: "(\${score1} + \${score2"  // Missing closing parenthesis
  INCORRECT: "Number(\${score1} + Number(\${score2})"  // Mismatched parentheses
  CORRECT: "Number(\${design_experience_score}) + Number(\${leadership_score})"
  CORRECT: "\${has_experience} ? 100 : 0"
  CORRECT: "(Number(\${score1}) + Number(\${score2})) * 0.5"  // Balanced parentheses
- output_name: a descriptive name for the calculated field

The output_schema should include all relevant input fields and computed results.

IMPORTANT: 
1. All logic block output_values and default_values used in calculations must be numbers
2. All formulas must be valid JavaScript expressions that evaluate to numbers
3. Formulas must be strings containing expressions that evaluate to numbers
4. Each formula must perform some mathematical operation or comparison
5. All parentheses in formulas must be properly balanced
6. Return ONLY valid JSON without any explanation or formatting`

    console.log('Sending prompt to AI:')
    console.log(prompt)
    console.log('\nInput data:', input_data)
    console.log('\nDescription:', description)

    // Call the AI API
    const aiResponse = await fetch(`https://api.openai.com/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`
      },
      body: JSON.stringify({
        model: model_name,
        messages: [{
          role: 'system',
          content: 'You are a workflow generation assistant. Always respond with raw JSON only, no markdown, no code blocks, no explanation.'
        }, {
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 2000
      })
    })

    if (!aiResponse.ok) {
      const error = await aiResponse.json()
      console.error('AI API error:', error)
      throw new Error(error.error?.message || 'Failed to generate workflow')
    }

    const aiResult = await aiResponse.json()
    console.log('\nAI Response:', aiResult.choices[0].message.content)
    
    let generatedWorkflow
    try {
      const content = aiResult.choices[0].message.content.trim()
      // Remove any potential markdown code block formatting
      const jsonStr = content.replace(/^```json\n|\n```$/g, '').trim()
      console.log('\nParsing JSON:', jsonStr)
      generatedWorkflow = JSON.parse(jsonStr)
    } catch (error) {
      console.error('Failed to parse AI response:', aiResult.choices[0].message.content)
      throw new Error('AI returned invalid JSON format')
    }

    // Validate the generated workflow structure
    if (!generatedWorkflow.logic_blocks || !Array.isArray(generatedWorkflow.logic_blocks)) {
      throw new Error('Invalid workflow structure: missing or invalid logic_blocks')
    }
    if (!generatedWorkflow.calculations || !Array.isArray(generatedWorkflow.calculations)) {
      throw new Error('Invalid workflow structure: missing or invalid calculations')
    }
    if (!generatedWorkflow.output_schema || typeof generatedWorkflow.output_schema !== 'object') {
      throw new Error('Invalid workflow structure: missing or invalid output_schema')
    }

    // Add validation for calculations
    for (const calc of generatedWorkflow.calculations) {
      if (typeof calc.formula !== 'string') {
        // Convert non-string formulas to strings
        calc.formula = String(calc.formula)
      }
      
      // Ensure formula is not an empty object
      if (calc.formula === '{}' || calc.formula === 'undefined') {
        throw new Error('Invalid calculation: formula cannot be empty or undefined')
      }

      // Check for JSON objects in formula
      if (calc.formula.includes('{') && !calc.formula.includes('${')) {
        throw new Error('Invalid calculation: formula contains invalid JSON object or incorrect variable syntax')
      }

      // Validate formula structure
      try {
        // Remove ${var} placeholders for validation
        const testFormula = calc.formula.replace(/\${[\w.]+}/g, '1')
        
        // Test if it's a valid JavaScript expression
        new Function(`return ${testFormula}`)
        
        // Check if formula contains at least one operator
        if (!/[+\-*/%<>=!?:]/.test(testFormula)) {
          throw new Error('Formula must contain at least one mathematical or logical operator')
        }

        // Check if formula evaluates to a number
        const result = eval(testFormula)
        if (typeof result !== 'number' || isNaN(result)) {
          throw new Error('Formula must evaluate to a number')
        }
      } catch (error: any) {
        throw new Error(`Invalid formula "${calc.formula}": ${error.message}`)
      }
    }

    // Add IDs to logic blocks and calculations if they don't have them
    const logic_blocks = generatedWorkflow.logic_blocks.map((block: LogicBlock) => ({
      ...block,
      id: block.id || crypto.randomUUID()
    }))

    const calculations = generatedWorkflow.calculations.map((calc: Calculation) => ({
      ...calc,
      id: calc.id || crypto.randomUUID()
    }))

    return NextResponse.json({
      logic_blocks,
      calculations,
      output_schema: generatedWorkflow.output_schema
    })
  } catch (error: any) {
    console.error('Error in workflow generation:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to generate workflow' },
      { status: 500 }
    )
  }
} 