import { Json } from "./supabase"

export interface WorkflowOutput {
  data: OutputData;
  debug: string[];
  error?: string;
  isLoading: boolean;
}

export interface OutputData {
  [key: string]: unknown;
}

export interface Condition {
  operator: 'and' | 'or';
  operation: string;
  input_name: string;
  values: (string | number)[];
}

export interface LogicBlock {
  id: string;
  input_name: string;
  output_name: string;
  operation: string;
  values?: (string | number)[];
  default_value?: string | number;
  output_value?: string;
  output_operator?: 'add' | 'subtract' | 'multiply' | 'divide';
  conditions?: Condition[];
}

export interface Calculation {
  id?: string;
  input_name?: string;
  output_name: string;
  formula: string;
  default_value?: unknown;
}

export interface WorkflowData {
  id: string;
  name: string;
  version?: number;
  input_schema?: string[];
  logic_blocks?: LogicBlock[];
  calculations?: Calculation[];
  updated_at?: string;
}

export interface Workflow {
  id: string;
  name: string;
  version?: number;
  input?: Record<string, unknown>;
  input_schema?: string[];
  input_data?: Record<string, unknown> | string;
  logic_blocks?: LogicBlock[];
  calculations?: Calculation[];
  output_schema?: Record<string, boolean>;
} 