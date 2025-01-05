export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      workflow_inputs: {
        Row: {
          id: string
          created_at: string
          workflow_id: string
          input_data: Json | null
          logic_data: Json | null
          output_data: Json | null
          workflow_version: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          workflow_id: string
          input_data?: Json | null
          logic_data?: Json | null
          output_data?: Json | null
          workflow_version?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          workflow_id?: string
          input_data?: Json | null
          logic_data?: Json | null
          output_data?: Json | null
          workflow_version?: number | null
        }
      }
      workflow_versions: {
        Row: {
          id: string
          created_at: string
          workflow_id: string
          version: number
          name: string
          input_schema: Json | null
          input_data: Json | null
          logic_blocks: Json | null
          calculations: Json | null
          output_schema: Json | null
        }
        Insert: {
          id?: string
          created_at?: string
          workflow_id: string
          version: number
          name: string
          input_schema?: Json | null
          input_data?: Json | null
          logic_blocks?: Json | null
          calculations?: Json | null
          output_schema?: Json | null
        }
        Update: {
          id?: string
          created_at?: string
          workflow_id?: string
          version?: number
          name?: string
          input_schema?: Json | null
          input_data?: Json | null
          logic_blocks?: Json | null
          calculations?: Json | null
          output_schema?: Json | null
        }
      }
      workflows: {
        Row: {
          id: string
          created_at: string
          name: string
          input_schema: Json | null
          input_data: Json | null
          logic_blocks: Json | null
          calculations: Json | null
          output_schema: Json | null
          version: number | null
        }
        Insert: {
          id?: string
          created_at?: string
          name: string
          input_schema?: Json | null
          input_data?: Json | null
          logic_blocks?: Json | null
          calculations?: Json | null
          output_schema?: Json | null
          version?: number | null
        }
        Update: {
          id?: string
          created_at?: string
          name?: string
          input_schema?: Json | null
          input_data?: Json | null
          logic_blocks?: Json | null
          calculations?: Json | null
          output_schema?: Json | null
          version?: number | null
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
} 