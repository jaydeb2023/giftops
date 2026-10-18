import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'

export const supabase = createClientComponentClient()

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          full_name: string | null
          avatar_url: string | null
          language: string
          created_at: string
        }
        Insert: {
          id: string
          email: string
          full_name?: string | null
          avatar_url?: string | null
          language?: string
        }
        Update: {
          full_name?: string | null
          avatar_url?: string | null
          language?: string
        }
      }
      agents: {
        Row: {
          id: string
          user_id: string
          name: string
          name_bn: string | null
          description: string
          description_bn: string | null
          category: string
          tools: string[]
          system_prompt: string
          icon: string
          color: string
          is_public: boolean
          is_featured: boolean
          use_count: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          name: string
          name_bn?: string | null
          description: string
          description_bn?: string | null
          category: string
          tools: string[]
          system_prompt: string
          icon?: string
          color?: string
          is_public?: boolean
          is_featured?: boolean
        }
        Update: {
          name?: string
          description?: string
          category?: string
          tools?: string[]
          system_prompt?: string
          is_public?: boolean
          use_count?: number
        }
      }
      conversations: {
        Row: {
          id: string
          agent_id: string
          user_id: string
          messages: Array<{ role: string; content: string; created_at: string }>
          created_at: string
          updated_at: string
        }
        Insert: {
          agent_id: string
          user_id: string
          messages?: Array<{ role: string; content: string; created_at: string }>
        }
        Update: {
          messages?: Array<{ role: string; content: string; created_at: string }>
          updated_at?: string
        }
      }
    }
  }
}
