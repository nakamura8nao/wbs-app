// アプリで使うドメインモデルの型定義

export type Member = {
  id: string;
  user_id: string | null;
  display_name: string;
  role: string | null;
};

export type Project = {
  id: string;
  created_by: string;
  title: string;
  group_lv1: string | null;
  group_lv2: string | null;
  group_lv3: string | null;
  priority: number;
  target_date: string | null;
  target_date_tentative: boolean;
  director_id: string | null;
  engineer_id: string | null;
  designer_id: string | null;
  status: string;
  progress: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  // JOINで取得する担当者情報
  director?: Member | null;
  engineer?: Member | null;
  designer?: Member | null;
};

export type ProjectFormData = {
  title: string;
  group_lv1: string;
  group_lv2: string;
  group_lv3: string;
  priority: number;
  target_date: string;
  target_date_tentative: boolean;
  director_id: string;
  engineer_id: string;
  designer_id: string;
  status: string;
  progress: string;
  notes: string;
};
