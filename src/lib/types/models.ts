// アプリで使うドメインモデルの型定義

import type { ApprovalState, Track } from "@/lib/constants";

export type Member = {
  id: string;
  user_id: string | null;
  display_name: string;
  role: string | null;
};

// 「新規投資・構造改革」ビューの大きな塊。配下に施策（Project）が複数つく。
export type InvestmentProgram = {
  id: string;
  name: string;
  // 何が達成されたら成功と言えるか（目的）。ビュー上に常に表示する
  goal: string | null;
  // 大まかな期日。「2026年下期」「2026Q4」など自由記述
  target_period: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type InvestmentProgramFormData = {
  name: string;
  goal: string;
  target_period: string;
};

export type Project = {
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
  must_date: string | null;
  is_petit_improvement: boolean;
  is_ab_test: boolean;
  // 3分類（投資/改善/アイデア）。必ずどれか1つ
  track: Track;
  // 投資トラックの施策が属する塊（investment_programs.id）。null は未割当
  investment_program_id: string | null;
  director_id: string | null;
  engineer_id: string | null;
  designer_id: string | null;
  status: string;
  progress: string;
  size: string | null;
  notes: string | null;
  proposed_date: string;
  wf_approved: ApprovalState;
  design_approved: ApprovalState;
  release_approved: ApprovalState;
  created_at: string;
  updated_at: string;
  // JOINで取得する担当者情報
  director?: Member | null;
  engineer?: Member | null;
  designer?: Member | null;
};

export type Phase = {
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
  notes: string | null;
  created_at: string;
  updated_at: string;
  // JOINで取得
  assignee?: Member | null;
  // 依存関係
  dependencies?: { depends_on_phase_id: string }[];
};

export type PhaseFormData = {
  name: string;
  assignee_id: string;
  start_date: string;
  end_date: string;
  status: string;
  traditional_hours: string;
  ai_target_hours: string;
  actual_hours: string;
  depends_on_phase_id: string;
  notes: string;
};

export type ProjectFormData = {
  title: string;
  group_lv1: string;
  group_lv2: string;
  group_lv3: string;
  priority: number;
  target_date: string;
  target_date_tentative: boolean;
  must_date: string;
  is_petit_improvement: boolean;
  is_ab_test: boolean;
  track: Track;
  investment_program_id: string;
  director_id: string;
  engineer_id: string;
  designer_id: string;
  status: string;
  progress: string;
  size: string;
  notes: string;
  proposed_date: string;
};
