import { NextResponse } from 'next/server'
import type { LogicBlock, Calculation } from '@/types/workflow'
import { getLogicBlockPaths } from '@/lib/utils'

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

    // Extract input schema using the same function as input-section
    function extractAllKeys(data: any, prefix = ''): string[] {
      let keys: string[] = [];
      
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) {
          // For arrays, add both the array itself and its first item's structure
          keys.push(prefix);
          if (data.length > 0) {
            keys = keys.concat(extractAllKeys(data[0], prefix));
          }
        } else {
          for (const key in data) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            keys.push(fullKey);
            
            if (data[key] && typeof data[key] === 'object') {
              keys = keys.concat(extractAllKeys(data[key], fullKey));
            }
          }
        }
      }
      
      return [...new Set(keys)];
    }

    const inputSchema = extractAllKeys(parsedInput)

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

IMPORTANT RULES FOR HANDLING DATA:
1. For nested fields, use dot notation (e.g., 'vitalSigns.temperature' not just 'temperature')
2. For array items, use array notation with index (e.g., 'symptoms[0].severity')
3. When comparing numbers:
   - Remove units before comparison (e.g., '101.2°F' should be compared as 101.2)
   - Use appropriate numeric operations (gt, lt, gte, lte)
4. When comparing strings:
   - Use 'equal' for exact matches
   - Use 'has' for substring checks
   - Use 'in' for array membership
5. Don't repeat logic blocks with different inputs - combine them using conditions instead

Generate a workflow that processes this data according to the description.
Return a JSON object (without any markdown formatting, code blocks, or explanation) that has these fields:
1. logic_blocks: Array of logic blocks that process the input data
2. calculations: Array of calculations that compute new values

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

    // Add validation functions
    const VALID_OPERATIONS = ['equal', 'neq', 'gt', 'gte', 'lt', 'lte', 'in', 'is', 'between', 'has'];

    function validateLogicBlock(block: LogicBlock): void {
      if (!block.input_name || typeof block.input_name !== 'string') {
        throw new Error(`Invalid input_name in logic block: ${JSON.stringify(block)}`);
      }
      if (!block.output_name || typeof block.output_name !== 'string') {
        throw new Error(`Invalid output_name in logic block: ${JSON.stringify(block)}`);
      }
      if (!block.operation || !VALID_OPERATIONS.includes(block.operation)) {
        throw new Error(`Invalid operation in logic block: ${JSON.stringify(block)}`);
      }
      if (!Array.isArray(block.values)) {
        throw new Error(`Invalid values in logic block: ${JSON.stringify(block)}`);
      }
      if (block.output_value !== undefined && typeof block.output_value !== 'number' && typeof block.output_value !== 'string') {
        throw new Error(`Invalid output_value in logic block: ${JSON.stringify(block)}`);
      }
      if (block.default_value !== undefined && typeof block.default_value !== 'number' && typeof block.default_value !== 'string') {
        throw new Error(`Invalid default_value in logic block: ${JSON.stringify(block)}`);
      }
      
      // Validate conditions if present
      if (block.conditions) {
        if (!Array.isArray(block.conditions)) {
          throw new Error(`Invalid conditions array in logic block: ${JSON.stringify(block)}`);
        }
        block.conditions.forEach((condition, index) => {
          if (!condition.operator || !['and', 'or'].includes(condition.operator)) {
            throw new Error(`Invalid operator in condition ${index}: ${JSON.stringify(condition)}`);
          }
          if (!condition.input_name || typeof condition.input_name !== 'string') {
            throw new Error(`Invalid input_name in condition ${index}: ${JSON.stringify(condition)}`);
          }
          if (!condition.operation || !VALID_OPERATIONS.includes(condition.operation)) {
            throw new Error(`Invalid operation in condition ${index}: ${JSON.stringify(condition)}`);
          }
          if (!Array.isArray(condition.values)) {
            throw new Error(`Invalid values in condition ${index}: ${JSON.stringify(condition)}`);
          }
        });
      }
    }

    function validateCalculation(calc: Calculation): void {
      if (!calc.output_name || typeof calc.output_name !== 'string') {
        throw new Error(`Invalid output_name in calculation: ${JSON.stringify(calc)}`);
      }
      if (!calc.formula || typeof calc.formula !== 'string') {
        throw new Error(`Invalid formula in calculation: ${JSON.stringify(calc)}`);
      }
      
      // Basic formula validation
      const formula = calc.formula;
      let parenCount = 0;
      
      // Check parentheses balance
      for (const char of formula) {
        if (char === '(') parenCount++;
        if (char === ')') parenCount--;
        if (parenCount < 0) {
          throw new Error(`Unbalanced parentheses in formula: ${formula}`);
        }
      }
      if (parenCount !== 0) {
        throw new Error(`Unbalanced parentheses in formula: ${formula}`);
      }
      
      // Check for valid variable references
      const varRefs = formula.match(/\${[^}]+}/g) || [];
      if (varRefs.length === 0) {
        throw new Error(`Formula contains no variable references: ${formula}`);
      }
    }

    // Validate each logic block and calculation
    try {
      // First validate all logic blocks
      const availableVariables = new Set<string>();
      
      // Add all input paths to available variables
      const inputPaths = getLogicBlockPaths(parsedInput);
      inputPaths.forEach((path: string) => availableVariables.add(path));

      // Log available paths for debugging
      console.log('Available input paths:', [...availableVariables]);

      // Validate logic blocks and collect their output names
      generatedWorkflow.logic_blocks.forEach((block: LogicBlock, index: number) => {
        validateLogicBlock(block);
        if (block.output_name) {
          availableVariables.add(block.output_name);
        }
      });

      // Then validate calculations and ensure they only use available variables
      generatedWorkflow.calculations.forEach((calc: Calculation, index: number) => {
        validateCalculation(calc);
        
        // Extract all variable references from the formula
        const varRefs = calc.formula.match(/\${([^}]+)}/g) || [];
        const variables = varRefs.map((ref: string) => ref.slice(2, -1));
        
        // Check if all referenced variables exist
        variables.forEach((variable: string) => {
          if (!availableVariables.has(variable)) {
            throw new Error(`Calculation "${calc.output_name}" references undefined variable "${variable}". Available variables: ${[...availableVariables].join(', ')}`);
          }
        });
        
        // Add calculation output to available variables for subsequent calculations
        availableVariables.add(calc.output_name);
      });
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Workflow validation failed: ${error.message}`);
      }
      throw new Error('Workflow validation failed: Unknown error');
    }

    // Remove output_schema if present as it's generated later
    delete generatedWorkflow.output_schema;

    return NextResponse.json(generatedWorkflow)
  } catch (error: any) {
    console.error('Error in workflow generation:', error)
    return NextResponse.json(
      { message: error.message || 'Failed to generate workflow' },
      { status: 500 }
    )
  }
} 