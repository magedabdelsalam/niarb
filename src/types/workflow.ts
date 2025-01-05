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

export interface LogicBlock {
  input_name: string;
  output_name: string;
  operation: string;
  values?: unknown[];
  default_value?: unknown;
  output_value?: unknown;
  conditions?: Array<{
    operator: 'and' | 'or';
    operation: string;
    input_name: string;
    values: unknown[];
  }>;
}

export interface Calculation {
  input_name: string;
  output_name: string;
  formula: string;
  default_value?: unknown;
}

export interface Workflow {
  id: string;
  version?: number;
  input?: Record<string, unknown>;
  input_data?: Record<string, unknown>;
  logic_blocks?: LogicBlock[];
  calculations?: Calculation[];
  output_schema?: Record<string, boolean>;
} 