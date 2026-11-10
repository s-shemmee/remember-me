export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      occasions: {
        Row: {
          created_at: string;
          day: number;
          id: string;
          kind: Database["public"]["Enums"]["occasion_kind"];
          month: number;
          owner_id: string;
          person_id: string | null;
          recurring: boolean;
          title: string | null;
          year: number | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          day: number;
          id?: string;
          kind?: Database["public"]["Enums"]["occasion_kind"];
          month: number;
          owner_id?: string;
          person_id?: string | null;
          recurring?: boolean;
          title?: string | null;
          year?: number | null;
        };
        Update: {
          created_at?: string;
          day?: number;
          id?: string;
          kind?: Database["public"]["Enums"]["occasion_kind"];
          month?: number;
          owner_id?: string;
          person_id?: string | null;
          recurring?: boolean;
          title?: string | null;
          year?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "occasions_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "occasions_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
        ];
      };
      people: {
        Row: {
          archived_at: string | null;
          color: string;
          created_at: string;
          group: Database["public"]["Enums"]["person_group"];
          id: string;
          linked_profile_id: string | null;
          little_things: string[];
          name: string;
          owner_id: string;
          relation: string | null;
          relation_kind: string | null;
        };
        ComputedFields: never;
        Insert: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          group?: Database["public"]["Enums"]["person_group"];
          id?: string;
          linked_profile_id?: string | null;
          little_things?: string[];
          name: string;
          owner_id?: string;
          relation?: string | null;
          relation_kind?: string | null;
        };
        Update: {
          archived_at?: string | null;
          color?: string;
          created_at?: string;
          group?: Database["public"]["Enums"]["person_group"];
          id?: string;
          linked_profile_id?: string | null;
          little_things?: string[];
          name?: string;
          owner_id?: string;
          relation?: string | null;
          relation_kind?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "people_linked_profile_id_fkey";
            columns: ["linked_profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "people_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_character: string | null;
          avatar_color: string | null;
          avatar_kind: Database["public"]["Enums"]["avatar_kind"];
          avatar_path: string | null;
          bio: string | null;
          birth_year: number | null;
          birthday_day: number | null;
          birthday_month: number | null;
          city: string | null;
          created_at: string;
          first_name: string | null;
          handle: string | null;
          id: string;
          last_name: string | null;
          onboarded_at: string | null;
          timezone: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_character?: string | null;
          avatar_color?: string | null;
          avatar_kind?: Database["public"]["Enums"]["avatar_kind"];
          avatar_path?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          birthday_day?: number | null;
          birthday_month?: number | null;
          city?: string | null;
          created_at?: string;
          first_name?: string | null;
          handle?: string | null;
          id: string;
          last_name?: string | null;
          onboarded_at?: string | null;
          timezone?: string;
        };
        Update: {
          avatar_character?: string | null;
          avatar_color?: string | null;
          avatar_kind?: Database["public"]["Enums"]["avatar_kind"];
          avatar_path?: string | null;
          bio?: string | null;
          birth_year?: number | null;
          birthday_day?: number | null;
          birthday_month?: number | null;
          city?: string | null;
          created_at?: string;
          first_name?: string | null;
          handle?: string | null;
          id?: string;
          last_name?: string | null;
          onboarded_at?: string | null;
          timezone?: string;
        };
        Relationships: [];
      };
      reminder_settings: {
        Row: {
          email: boolean;
          offsets_days: number[];
          profile_id: string;
          push: boolean;
          remind_my_people: boolean;
          send_time: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          email?: boolean;
          offsets_days?: number[];
          profile_id?: string;
          push?: boolean;
          remind_my_people?: boolean;
          send_time?: string;
          updated_at?: string;
        };
        Update: {
          email?: boolean;
          offsets_days?: number[];
          profile_id?: string;
          push?: boolean;
          remind_my_people?: boolean;
          send_time?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reminder_settings_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      complete_onboarding: {
        Args: {
          p_avatar_character?: string;
          p_avatar_color?: string;
          p_avatar_kind?: Database["public"]["Enums"]["avatar_kind"];
          p_avatar_path?: string;
          p_birth_year?: number;
          p_birthday_day: number;
          p_birthday_month: number;
          p_first_name: string;
          p_person_birthday_day?: number;
          p_person_birthday_month?: number;
          p_person_birthday_year?: number;
          p_person_color?: string;
          p_person_description?: string;
          p_person_little_thing?: string;
          p_person_name?: string;
          p_person_relation?: string;
          p_reminder_email?: boolean;
          p_reminder_offsets?: number[];
          p_reminder_push?: boolean;
          p_timezone?: string;
        };
        Returns: string;
      };
      health_check: { Args: Record<PropertyKey, never>; Returns: boolean };
      save_person: {
        Args: {
          p_birthday_day?: number;
          p_birthday_month?: number;
          p_birthday_year?: number;
          p_color?: string;
          p_days?: Json;
          p_id?: string;
          p_little_things?: string[];
          p_name?: string;
          p_relation?: string;
          p_relation_kind?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      avatar_kind: "initials" | "photo" | "character";
      occasion_kind: "birthday" | "anniversary" | "graduation" | "other";
      person_group: "family" | "friends" | "work" | "other";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      avatar_kind: ["initials", "photo", "character"],
      occasion_kind: ["birthday", "anniversary", "graduation", "other"],
      person_group: ["family", "friends", "work", "other"],
    },
  },
} as const;
