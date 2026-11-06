export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      alunos: {
        Row: {
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco_bairro: string | null
          endereco_cep: string | null
          endereco_cidade: string | null
          endereco_numero: string | null
          endereco_rua: string | null
          endereco_uf: string | null
          faixa: string
          graus: number
          id: string
          id_responsavel: string | null
          nome: string
          observacoes: string | null
          telefone: string | null
          titular_id: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          faixa?: string
          graus?: number
          id?: string
          id_responsavel?: string | null
          nome: string
          observacoes?: string | null
          telefone?: string | null
          titular_id?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco_bairro?: string | null
          endereco_cep?: string | null
          endereco_cidade?: string | null
          endereco_numero?: string | null
          endereco_rua?: string | null
          endereco_uf?: string | null
          faixa?: string
          graus?: number
          id?: string
          id_responsavel?: string | null
          nome?: string
          observacoes?: string | null
          telefone?: string | null
          titular_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alunos_id_responsavel_fkey"
            columns: ["id_responsavel"]
            isOneToOne: false
            referencedRelation: "responsaveis"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alunos_titular_id_fkey"
            columns: ["titular_id"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      checkins: {
        Row: {
          created_at: string
          data_hora: string
          id: string
          id_aluno: string
          observacao: string | null
          origem: string
        }
        Insert: {
          created_at?: string
          data_hora?: string
          id?: string
          id_aluno: string
          observacao?: string | null
          origem?: string
        }
        Update: {
          created_at?: string
          data_hora?: string
          id?: string
          id_aluno?: string
          observacao?: string | null
          origem?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkins_id_aluno_fkey"
            columns: ["id_aluno"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      contratos: {
        Row: {
          created_at: string
          data_fim: string
          data_inicio: string
          dia_vencimento: number
          id: string
          id_aluno: string
          id_plano: string
          status: Database["public"]["Enums"]["contrato_status"]
          titular_contrato_id: string | null
          valor_total: number
        }
        Insert: {
          created_at?: string
          data_fim: string
          data_inicio: string
          dia_vencimento: number
          id?: string
          id_aluno: string
          id_plano: string
          status?: Database["public"]["Enums"]["contrato_status"]
          titular_contrato_id?: string | null
          valor_total: number
        }
        Update: {
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dia_vencimento?: number
          id?: string
          id_aluno?: string
          id_plano?: string
          status?: Database["public"]["Enums"]["contrato_status"]
          titular_contrato_id?: string | null
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "contratos_id_aluno_fkey"
            columns: ["id_aluno"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_id_plano_fkey"
            columns: ["id_plano"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contratos_titular_contrato_id_fkey"
            columns: ["titular_contrato_id"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
      perfis: {
        Row: {
          created_at: string
          email: string | null
          id: string
          nome: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string
          email?: string | null
          id: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          nome?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      planos: {
        Row: {
          cobranca: Database["public"]["Enums"]["plano_cobranca"]
          created_at: string
          duracao_meses: number
          id: string
          max_dependentes: number
          nome: string
          tipo: Database["public"]["Enums"]["plano_tipo"]
          valor_padrao: number
        }
        Insert: {
          cobranca?: Database["public"]["Enums"]["plano_cobranca"]
          created_at?: string
          duracao_meses: number
          id?: string
          max_dependentes?: number
          nome: string
          tipo?: Database["public"]["Enums"]["plano_tipo"]
          valor_padrao: number
        }
        Update: {
          cobranca?: Database["public"]["Enums"]["plano_cobranca"]
          created_at?: string
          duracao_meses?: number
          id?: string
          max_dependentes?: number
          nome?: string
          tipo?: Database["public"]["Enums"]["plano_tipo"]
          valor_padrao?: number
        }
        Relationships: []
      }
      responsaveis: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          id: string
          nome: string
          telefone: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome: string
          telefone?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          telefone?: string | null
        }
        Relationships: []
      }
      transacoes: {
        Row: {
          categoria: string
          created_at: string
          data_pagamento: string | null
          data_vencimento: string
          descricao: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          id_aluno: string | null
          id_contrato: string | null
          status: Database["public"]["Enums"]["transacao_status"]
          tipo: Database["public"]["Enums"]["transacao_tipo"]
          valor: number
        }
        Insert: {
          categoria: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          id_aluno?: string | null
          id_contrato?: string | null
          status?: Database["public"]["Enums"]["transacao_status"]
          tipo: Database["public"]["Enums"]["transacao_tipo"]
          valor: number
        }
        Update: {
          categoria?: string
          created_at?: string
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          id_aluno?: string | null
          id_contrato?: string | null
          status?: Database["public"]["Enums"]["transacao_status"]
          tipo?: Database["public"]["Enums"]["transacao_tipo"]
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "transacoes_id_aluno_fkey"
            columns: ["id_aluno"]
            isOneToOne: false
            referencedRelation: "alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transacoes_id_contrato_fkey"
            columns: ["id_contrato"]
            isOneToOne: false
            referencedRelation: "contratos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_owner: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "owner" | "admin" | "instructor"
      contrato_status: "ativo" | "cancelado"
      forma_pagamento:
        | "dinheiro"
        | "pix"
        | "cartao_credito"
        | "cartao_debito"
        | "boleto"
        | "transferencia"
        | "outro"
      plano_cobranca: "recorrente" | "a_vista"
      plano_tipo: "mensal" | "semestral" | "anual" | "amigo" | "familia"
      transacao_status: "pago" | "pendente"
      transacao_tipo: "receita" | "despesa"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["owner", "admin", "instructor"],
      contrato_status: ["ativo", "cancelado"],
      forma_pagamento: [
        "dinheiro",
        "pix",
        "cartao_credito",
        "cartao_debito",
        "boleto",
        "transferencia",
        "outro",
      ],
      plano_cobranca: ["recorrente", "a_vista"],
      plano_tipo: ["mensal", "semestral", "anual", "amigo", "familia"],
      transacao_status: ["pago", "pendente"],
      transacao_tipo: ["receita", "despesa"],
    },
  },
} as const
