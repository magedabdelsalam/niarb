export interface LogicBlock {
  id: string
  input_name: string
  operation: 'direct' | 'transform' | 'calculate' | 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between' | 'has'
  values: string[] | TransformValue[]
  output_name: string
  output_operator?: 'add' | 'subtract' | 'multiply' | 'divide' | 'equals'
  output_value?: string
  default_value?: string
  conditions?: Condition[]
}

export interface TransformValue {
  input_name: string
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains'
  value: string
  output_value: string
}

export interface Condition {
  input_name: string
  operator: 'and' | 'or'
  operation: 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between'
  values: string[]
}

export interface Calculation {
  id: string
  formula: string
  output_name: string
}

export type Workflow = {
  id?: string;
  name: string;
  description?: string;
  input_schema: string[];
  input_data: string;
  example_dataset?: string;
  logic_blocks: LogicBlock[];
  calculations: Calculation[];
  output_schema: Record<string, boolean>;
  ai_model?: {
    model_name: string;
    api_key?: string;
    is_auto_generated?: boolean;
  };
  version?: number;
}

export interface WorkflowVersion {
  id: string
  workflow_id: string
  version: number
  data: Partial<Workflow>
  created_at: string
  created_by: string | null
  comment: string | null
} 