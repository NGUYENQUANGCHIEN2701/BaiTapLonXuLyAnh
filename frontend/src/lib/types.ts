export type Role = "admin" | "teacher";

export interface User {
  id: number;
  username: string;
  full_name: string;
  role: Role;
  created_at?: string;
}

export interface Exam {
  id: number;
  name: string;
  subject: string;
  exam_date: string;
  description: string;
  num_questions: number;
  num_options: number;
  max_score: number;
  pass_score: number;
  owner_id: number | null;
  created_at?: string;
  num_keys: number;
  num_students: number;
  num_submissions: number;
  num_review: number;
  avg_score: number | null;
  owner_name: string;
}

export type ExamInput = Pick<
  Exam,
  "name" | "subject" | "exam_date" | "description" | "num_questions" | "num_options" | "max_score" | "pass_score"
>;

export interface AnswerKey {
  id: number;
  exam_id: number;
  code: string;
  answers: string[];
}

export interface Student {
  id: number;
  exam_id: number;
  sbd: string;
  full_name: string;
  dob: string;
  class_name: string;
  room: string;
  submission_id?: number | null;
  score?: number | null;
  status?: SubStatus | null;
}

export type SubStatus = "graded" | "review" | "error";

export interface Flag {
  field: string;
  kind: string;
  message: string;
}

export interface SubmissionBrief {
  id: number;
  exam_id: number;
  student_id: number | null;
  status: SubStatus;
  source_name: string;
  sbd: string;
  exam_code: string;
  num_correct: number | null;
  score: number | null;
  confidence: number;
  error: string;
  flags: Flag[];
  reviewed: boolean;
  created_at?: string;
  updated_at?: string;
  student_name: string;
  class_name: string;
}

export interface OmrItem {
  block: string;
  key: string;
  labels: string[];
  values: number[];
  centers: [number, number][];
  radius: number;
  threshold: number;
  marked: boolean[];
  uncertain: boolean;
}

export interface OmrDetail {
  ppm?: number;
  width?: number;
  height?: number;
  global_threshold?: number;
  global_jump?: number;
  verify_score?: number;
  shifts?: Record<string, [number, number, number]>;
  qr?: Record<string, number> | null;
  flags?: Flag[];
  resolved?: string[];
  items?: OmrItem[];
}

export interface Submission extends SubmissionBrief {
  answers: string[];
  omr_sbd: string;
  omr_exam_code: string;
  omr_answers: string[];
  omr_detail: OmrDetail;
  align_method: string;
  rotation: number;
  elapsed_ms: number;
  key: string[] | null;
  has_images: Record<"original" | "warped" | "annotated", boolean>;
}

export interface ItemStat {
  q: number;
  key: string;
  p: number;
  difficulty: string;
  d: number | null;
  discrimination: string | null;
  options: Record<string, number>;
  blank: number;
  multi: number;
  top_distractor: string | null;
}

export interface ExamStats {
  overview: {
    total: number;
    graded: number;
    review: number;
    error: number;
    scored: number;
    roster: number;
    absent: number;
    mean: number | null;
    median: number | null;
    stdev: number | null;
    min: number | null;
    max: number | null;
    pass_rate: number | null;
    max_score: number;
    pass_score: number;
  };
  histogram: { range: string; from: number; count: number }[];
  by_class: { name: string; count: number; mean: number; pass_rate: number }[];
  by_code: { code: string; count: number; mean: number }[];
  item_code: string | null;
  codes: string[];
  items: ItemStat[];
  top: { submission_id: number; sbd: string; score: number; num_correct: number; name: string; class_name: string }[];
}

export interface Activity {
  id: number;
  action: string;
  detail: Record<string, unknown>;
  exam_id?: number;
  submission_id: number | null;
  user: string;
  created_at: string;
}

export interface Dashboard {
  exams: number;
  submissions: number;
  review: number;
  errors: number;
  avg_score: number | null;
  avg_ms: number | null;
  per_exam: { id: number; name: string; subject: string; count: number; avg: number | null }[];
  recent: {
    id: number;
    exam_id: number;
    exam_name: string;
    sbd: string;
    score: number | null;
    status: SubStatus;
    name: string;
    created_at: string;
  }[];
  activity: Activity[];
}

export interface LabStep {
  key: string;
  title: string;
  description: string;
  image: string | null;
  ms: number;
  sorted_values?: number[];
  threshold?: number;
  jump?: number;
  shifts?: Record<string, [number, number, number]>;
  homography?: number[][];
  qr?: Record<string, number> | null;
  sbd?: string;
  exam_code?: string;
  answers?: string[];
  flags?: Flag[];
  verify_score?: number;
  method?: string;
}

export interface LabResult {
  ok: boolean;
  error?: string;
  steps: LabStep[];
  summary?: Record<string, unknown>;
}
