export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      connections: {
        Row: {
          created_at: string;
          id: string;
          user_high: string;
          user_low: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          user_high: string;
          user_low: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          user_high?: string;
          user_low?: string;
        };
        Relationships: [
          {
            foreignKeyName: "connections_user_high_fkey";
            columns: ["user_high"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "connections_user_low_fkey";
            columns: ["user_low"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      invites: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          inviter_id: string;
          person_id: string | null;
          revoked_at: string | null;
          token_hash: string;
          used_at: string | null;
          used_by: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          inviter_id: string;
          person_id?: string | null;
          revoked_at?: string | null;
          token_hash: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          inviter_id?: string;
          person_id?: string | null;
          revoked_at?: string | null;
          token_hash?: string;
          used_at?: string | null;
          used_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invites_inviter_id_fkey";
            columns: ["inviter_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_person_id_fkey";
            columns: ["person_id"];
            isOneToOne: false;
            referencedRelation: "people";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invites_used_by_fkey";
            columns: ["used_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notices: {
        Row: {
          actor_id: string | null;
          actor_name: string;
          created_at: string;
          id: string;
          kind: string;
          read_at: string | null;
          user_id: string;
          wish_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          actor_id?: string | null;
          actor_name: string;
          created_at?: string;
          id?: string;
          kind: string;
          read_at?: string | null;
          user_id: string;
          wish_id?: string | null;
        };
        Update: {
          actor_id?: string | null;
          actor_name?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          read_at?: string | null;
          user_id?: string;
          wish_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "notices_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notices_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notices_wish_id_fkey";
            columns: ["wish_id"];
            isOneToOne: false;
            referencedRelation: "wishes";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_log: {
        Row: {
          attempts: number;
          batch_id: string | null;
          channel: string;
          claimed_at: string;
          created_at: string;
          id: string;
          kind: string;
          occasion_id: string | null;
          occurs_on: string | null;
          offset_days: number | null;
          profile_id: string;
          provider_id: string | null;
          sent_at: string | null;
          status: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          batch_id?: string | null;
          channel?: string;
          claimed_at?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          occasion_id?: string | null;
          occurs_on?: string | null;
          offset_days?: number | null;
          profile_id: string;
          provider_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          attempts?: number;
          batch_id?: string | null;
          channel?: string;
          claimed_at?: string;
          created_at?: string;
          id?: string;
          kind?: string;
          occasion_id?: string | null;
          occurs_on?: string | null;
          offset_days?: number | null;
          profile_id?: string;
          provider_id?: string | null;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_log_occasion_id_fkey";
            columns: ["occasion_id"];
            isOneToOne: false;
            referencedRelation: "occasions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "notification_log_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
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
          in_memory: boolean;
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
          in_memory?: boolean;
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
          in_memory?: boolean;
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
          share_birthday: boolean;
          theme: string;
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
          share_birthday?: boolean;
          theme?: string;
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
          share_birthday?: boolean;
          theme?: string;
          timezone?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          auth: string;
          created_at: string;
          device_label: string;
          endpoint: string;
          id: string;
          last_used_at: string | null;
          p256dh: string;
          profile_id: string;
        };
        ComputedFields: never;
        Insert: {
          auth: string;
          created_at?: string;
          device_label?: string;
          endpoint: string;
          id?: string;
          last_used_at?: string | null;
          p256dh: string;
          profile_id?: string;
        };
        Update: {
          auth?: string;
          created_at?: string;
          device_label?: string;
          endpoint?: string;
          id?: string;
          last_used_at?: string | null;
          p256dh?: string;
          profile_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      reservations: {
        Row: {
          cancelled_at: string | null;
          created_at: string;
          reserver_id: string;
          wish_id: string;
        };
        ComputedFields: never;
        Insert: {
          cancelled_at?: string | null;
          created_at?: string;
          reserver_id?: string;
          wish_id: string;
        };
        Update: {
          cancelled_at?: string | null;
          created_at?: string;
          reserver_id?: string;
          wish_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reservations_reserver_id_fkey";
            columns: ["reserver_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reservations_wish_id_fkey";
            columns: ["wish_id"];
            isOneToOne: true;
            referencedRelation: "wishes";
            referencedColumns: ["id"];
          },
        ];
      };
      wishes: {
        Row: {
          created_at: string;
          currency: string;
          id: string;
          image_path: string | null;
          note: string | null;
          owner_id: string;
          position: number;
          price_amount: number | null;
          priority: Database["public"]["Enums"]["wish_priority"];
          removed_at: string | null;
          title: string;
          url: string | null;
          wishlist_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          currency?: string;
          id?: string;
          image_path?: string | null;
          note?: string | null;
          owner_id?: string;
          position?: number;
          price_amount?: number | null;
          priority?: Database["public"]["Enums"]["wish_priority"];
          removed_at?: string | null;
          title: string;
          url?: string | null;
          wishlist_id: string;
        };
        Update: {
          created_at?: string;
          currency?: string;
          id?: string;
          image_path?: string | null;
          note?: string | null;
          owner_id?: string;
          position?: number;
          price_amount?: number | null;
          priority?: Database["public"]["Enums"]["wish_priority"];
          removed_at?: string | null;
          title?: string;
          url?: string | null;
          wishlist_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wishes_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wishes_wishlist_id_fkey";
            columns: ["wishlist_id"];
            isOneToOne: false;
            referencedRelation: "wishlists";
            referencedColumns: ["id"];
          },
        ];
      };
      wishlists: {
        Row: {
          created_at: string;
          id: string;
          kind: Database["public"]["Enums"]["wishlist_kind"];
          owner_id: string;
          title: string;
          visibility: Database["public"]["Enums"]["wishlist_visibility"];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          kind: Database["public"]["Enums"]["wishlist_kind"];
          owner_id?: string;
          title: string;
          visibility?: Database["public"]["Enums"]["wishlist_visibility"];
        };
        Update: {
          created_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["wishlist_kind"];
          owner_id?: string;
          title?: string;
          visibility?: Database["public"]["Enums"]["wishlist_visibility"];
        };
        Relationships: [
          {
            foreignKeyName: "wishlists_owner_id_fkey";
            columns: ["owner_id"];
            isOneToOne: false;
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
      accept_invite: { Args: { p_token: string }; Returns: string };
      allow_test: { Args: { p_channel: string; p_profile_id: string }; Returns: boolean };
      are_connected: { Args: { p_a: string; p_b: string }; Returns: boolean };
      call_edge_function: { Args: { p_name: string }; Returns: number };
      can_view_avatar: { Args: { p_name: string }; Returns: boolean };
      can_view_wish_image: { Args: { p_name: string }; Returns: boolean };
      claim_reminders: {
        Args: { p_batch_id: string; p_channel: string; p_keys: string[]; p_profile_id: string };
        Returns: string[];
      };
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
      create_invite: { Args: { p_person_id?: string }; Returns: string };
      finish_reminders: { Args: { p_batch_id: string; p_provider_id: string }; Returns: undefined };
      friend_wishes: {
        Args: Record<PropertyKey, never>;
        Returns: {
          currency: string;
          id: string;
          image_path: string;
          note: string;
          owner_id: string;
          price_amount: number;
          priority: Database["public"]["Enums"]["wish_priority"];
          status: string;
          title: string;
          url: string;
        }[];
      };
      health_check: { Args: Record<PropertyKey, never>; Returns: boolean };
      invite_preview: {
        Args: { p_token: string };
        Returns: {
          inviter_name: string;
          status: string;
        }[];
      };
      is_push_endpoint: { Args: { p_endpoint: string }; Returns: boolean };
      link_person: { Args: { p_person_id: string; p_profile_id: string }; Returns: undefined };
      my_connections: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_character: string;
          avatar_color: string;
          avatar_kind: Database["public"]["Enums"]["avatar_kind"];
          avatar_path: string;
          connected_at: string;
          connection_id: string;
          first_name: string;
          linked_person_id: string;
          linked_person_name: string;
          profile_id: string;
        }[];
      };
      my_friends: {
        Args: Record<PropertyKey, never>;
        Returns: {
          avatar_character: string;
          avatar_color: string;
          avatar_kind: Database["public"]["Enums"]["avatar_kind"];
          avatar_path: string;
          birthday_day: number;
          birthday_month: number;
          first_name: string;
          linked_person_id: string;
          name: string;
          profile_id: string;
        }[];
      };
      name_for: { Args: { p_profile: string; p_viewer: string }; Returns: string };
      prepare_account_deletion: { Args: { p_user_id: string }; Returns: undefined };
      reclaim_stuck_reminders: {
        Args: Record<PropertyKey, never>;
        Returns: {
          batch_id: string;
          channel: string;
          keys: string[];
          profile_id: string;
        }[];
      };
      release_reminders: { Args: { p_batch_id: string }; Returns: undefined };
      reminder_candidates: {
        Args: Record<PropertyKey, never>;
        Returns: {
          day: number;
          email: string;
          email_on: boolean;
          first_name: string;
          in_memory: boolean;
          kind: string;
          little_thing: string;
          month: number;
          occasion_id: string;
          offsets: number[];
          person_color: string;
          person_id: string;
          person_name: string;
          profile_id: string;
          push_on: boolean;
          recurring: boolean;
          send_time: string;
          timezone: string;
          title: string;
          wishlist_friend_id: string;
          year: number;
        }[];
      };
      reminder_log_keys: {
        Args: Record<PropertyKey, never>;
        Returns: {
          channel: string;
          key: string;
          profile_id: string;
        }[];
      };
      reminder_push_devices: {
        Args: Record<PropertyKey, never>;
        Returns: {
          auth: string;
          endpoint: string;
          id: string;
          p256dh: string;
          profile_id: string;
        }[];
      };
      remove_connection: { Args: { p_connection_id: string }; Returns: undefined };
      reorder_wishes: { Args: { p_ids: string[]; p_wishlist_id: string }; Returns: undefined };
      reserve_wish: { Args: { p_wish_id: string }; Returns: undefined };
      revoke_invite: { Args: { p_invite_id: string }; Returns: undefined };
      run_cleanup: { Args: Record<PropertyKey, never>; Returns: Json };
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
      save_push_subscription: {
        Args: { p_auth: string; p_device_label: string; p_endpoint: string; p_p256dh: string };
        Returns: string;
      };
      unlink_person: { Args: { p_person_id: string }; Returns: undefined };
      wish_is_shared: { Args: { p_wishlist_id: string }; Returns: boolean };
    };
    Enums: {
      avatar_kind: "initials" | "photo" | "character";
      occasion_kind:
        "birthday" | "anniversary" | "graduation" | "work_milestone" | "remembrance" | "other";
      person_group: "family" | "friends" | "work" | "other";
      wish_priority: "love" | "like" | "nice";
      wishlist_kind: "birthday" | "treat" | "other";
      wishlist_visibility: "private" | "connections" | "selected";
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
      occasion_kind: [
        "birthday",
        "anniversary",
        "graduation",
        "work_milestone",
        "remembrance",
        "other",
      ],
      person_group: ["family", "friends", "work", "other"],
      wish_priority: ["love", "like", "nice"],
      wishlist_kind: ["birthday", "treat", "other"],
      wishlist_visibility: ["private", "connections", "selected"],
    },
  },
} as const;
