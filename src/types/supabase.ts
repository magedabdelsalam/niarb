export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type WorkflowStatus = 'draft' | 'published';

export interface Database {
  public: {
    Tables: {
      workflows: {
        Row: {
          id: string
          name: string
          input_data: string
          input_schema: Json
          logic_blocks: Json
          calculations: Json
          output_schema: Json
          ai_model: Json | null
          status: WorkflowStatus
          created_at: string
          updated_at: string
          created_by: string | null
          version: number
          is_saving_draft: boolean
        }
        Insert: {
          id?: string
          name: string
          input_data?: string
          input_schema?: Json
          logic_blocks?: Json
          calculations?: Json
          output_schema?: Json
          ai_model?: Json | null
          status?: WorkflowStatus
          created_at?: string
          updated_at?: string
          created_by?: string | null
          version?: number
          is_saving_draft?: boolean
        }
        Update: {
          id?: string
          name?: string
          input_data?: string
          input_schema?: Json
          logic_blocks?: Json
          calculations?: Json
          output_schema?: Json
          ai_model?: Json | null
          status?: WorkflowStatus
          created_at?: string
          updated_at?: string
          created_by?: string | null
          version?: number
          is_saving_draft?: boolean
        }
      }
      workflow_inputs: {
        Row: {
          id: string
          workflow_id: string
          input_data: Json
          output_data: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          workflow_id: string
          input_data: Json
          output_data?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          workflow_id?: string
          input_data?: Json
          output_data?: Json | null
          created_at?: string
        }
      }
    }
  }
} 