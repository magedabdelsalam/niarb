import { Json } from "./supabase"

export interface Workflow {
  id?: string
  name: string
  input_schema?: Json
  input_data?: Json
  logic_blocks?: LogicBlock[]
  calculations?: Calculation[]
  output_schema?: Json
  version?: number
}

export interface LogicBlock {
  id: string
  output_name: string
  output_value: string
  default_value?: string
  conditions?: Condition[]
  values: string[]
  operation: 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between' | 'has'
  input_name: string
}

export interface Condition {
  operator: 'and' | 'or'
  operation: 'equal' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'between'
  input_name: string
  values: string[]
}

export interface Calculation {
  id: string
  output_name: string
  formula: string
} 