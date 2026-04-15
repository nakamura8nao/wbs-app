// Supabase の型定義
// supabase gen types typescript で自動生成したものに置き換え可能
// MVP時点では手書きで定義

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string;
          updated_at?: string;
        };
      };
      members: {
        Row: {
          id: string;
          user_id: string | null;
          display_name: string;
          role: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string | null;
          display_name: string;
          role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          user_id?: string | null;
          display_name?: string;
          role?: string | null;
          updated_at?: string;
        };
      };
      projects: {
        Row: {
          id: string;
          created_by: string;
          title: string;
          group_lv1: string | null;
          group_lv2: string | null;
          group_lv3: string | null;
          priority: number;
          priority_undecided: boolean;
          target_date: string | null;
          target_date_tentative: boolean;
          director_id: string | null;
          engineer_id: string | null;
          designer_id: string | null;
          status: string;
          progress: string;
          size: string | null;
          notes: string | null;
          proposed_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          created_by: string;
          title: string;
          group_lv1?: string | null;
          group_lv2?: string | null;
          group_lv3?: string | null;
          priority?: number;
          priority_undecided?: boolean;
          target_date?: string | null;
          target_date_tentative?: boolean;
          director_id?: string | null;
          engineer_id?: string | null;
          designer_id?: string | null;
          status?: string;
          progress?: string;
          size?: string | null;
          notes?: string | null;
          proposed_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          group_lv1?: string | null;
          group_lv2?: string | null;
          group_lv3?: string | null;
          priority?: number;
          priority_undecided?: boolean;
          target_date?: string | null;
          target_date_tentative?: boolean;
          director_id?: string | null;
          engineer_id?: string | null;
          designer_id?: string | null;
          status?: string;
          progress?: string;
          size?: string | null;
          notes?: string | null;
          proposed_date?: string;
          updated_at?: string;
        };
      };
      phases: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          assignee_id: string | null;
          start_date: string | null;
          end_date: string | null;
          status: string;
          sort_order: number;
          traditional_hours: number | null;
          ai_target_hours: number | null;
          actual_hours: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          assignee_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: string;
          sort_order?: number;
          traditional_hours?: number | null;
          ai_target_hours?: number | null;
          actual_hours?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          assignee_id?: string | null;
          start_date?: string | null;
          end_date?: string | null;
          status?: string;
          sort_order?: number;
          traditional_hours?: number | null;
          ai_target_hours?: number | null;
          actual_hours?: number | null;
          updated_at?: string;
        };
      };
      phase_dependencies: {
        Row: {
          id: string;
          phase_id: string;
          depends_on_phase_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          phase_id: string;
          depends_on_phase_id: string;
          created_at?: string;
        };
        Update: {
          phase_id?: string;
          depends_on_phase_id?: string;
        };
      };
    };
  };
};
