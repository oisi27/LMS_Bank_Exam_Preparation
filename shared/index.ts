import { z } from 'zod';

// ==========================================
// User & Role Contracts
// ==========================================
export type UserRole = 'STUDENT' | 'INSTRUCTOR' | 'ADMIN';

export interface UserProfile {
  id: string;
  email: string;
  phone?: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  targetExam?: string;
  targetDate?: string;
  targetBank?: string;
  targetPosition?: string;
  createdAt: string;
}

// ==========================================
// Question Bank Contracts (Phase 3)
// ==========================================
export type QuestionType =
  | 'SINGLE_MCQ'
  | 'MULTI_SELECT'
  | 'TRUE_FALSE'
  | 'NUMERIC'
  | 'FILL_BLANK';

export type QuestionDifficulty = 'EASY' | 'MEDIUM' | 'HARD';
export type QuestionLanguage = 'EN' | 'BN' | 'BOTH';

export interface QuestionOption {
  id: string;
  questionId: string;
  optionKey: string;
  text: string;
  textBangla?: string | null;
  isCorrect: boolean;
  sortOrder: number;
}

export interface QuestionModel {
  id: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  prompt: string;
  promptBangla?: string | null;
  explanation?: string | null;
  explanationBangla?: string | null;
  defaultMarks: number;
  defaultNegativeMarks: number;
  isApproved: boolean;
  authorId?: string | null;
  createdAt: string;
  options: QuestionOption[];
}

export interface QuestionFilters {
  subject?: string;
  chapter?: string;
  topic?: string;
  difficulty?: QuestionDifficulty;
  type?: QuestionType;
  isApproved?: boolean;
  search?: string;
}

export interface CreateQuestionInput {
  subject: string;
  chapter: string;
  topic: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  prompt: string;
  promptBangla?: string;
  explanation?: string;
  explanationBangla?: string;
  defaultMarks?: number;
  defaultNegativeMarks?: number;
  isApproved?: boolean;
  options: {
    optionKey: string;
    text: string;
    textBangla?: string;
    isCorrect: boolean;
  }[];
}

// Safe client question payload for students (no correct answers exposed)
export interface QuestionClientPayload {
  id: string;
  questionNumber: number;
  sectionName?: string;
  subject: string;
  chapter: string;
  topic: string;
  difficulty: QuestionDifficulty;
  type: QuestionType;
  prompt: string;
  promptBangla?: string;
  options: { id: string; optionKey: string; text: string; textBangla?: string }[];
  marks: number;
  negativeMarks: number;
}

// ==========================================
// Exam & Attempt Contracts (Phase 4 & 5)
// ==========================================
export type ExamType = 'CHAPTER_QUIZ' | 'MODEL_TEST';

export type ExamStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'LIVE'
  | 'CLOSED'
  | 'RESULTS_PUBLISHED';

export type AttemptStatus =
  | 'IN_PROGRESS'
  | 'SUBMITTED'
  | 'AUTO_SUBMITTED'
  | 'GRADED';

export type ResultReleaseMode = 'INSTANT' | 'SCHEDULED' | 'MANUAL';

export interface ExamModel {
  id: string;
  title: string;
  titleBangla?: string;
  description?: string;
  category: string;
  type: ExamType;
  status: ExamStatus;
  durationMinutes: number;
  totalMarks: number;
  passMarks: number;
  negativeMarkingRate: number;
  allowedAttempts: number;
  startsAt: string;
  endsAt: string;
  resultReleaseMode: ResultReleaseMode;
  integrityEnabled: boolean;
  maxViolationsAllowed: number;
  createdBy?: string;
  createdAt: string;
  questionCount?: number;
}

export interface ExamDetailModel extends ExamModel {
  questions: {
    questionId: string;
    sectionName: string;
    marks: number;
    negativeMarks: number;
    orderIndex: number;
    prompt: string;
    promptBangla?: string;
    type: QuestionType;
  }[];
}

export interface ExamSessionPayload {
  attemptId: string;
  examId: string;
  examTitle: string;
  sessionToken: string;
  serverNow: string;
  expiresAt: string;
  durationMinutes: number;
  integrityConfig: {
    enabled: boolean;
    maxViolations: number;
  };
  questions: QuestionClientPayload[];
}

export interface AutoSavePayload {
  attemptId: string;
  questionId: string;
  selectedOptionIds?: string[];
  numericAnswer?: number;
  textAnswer?: string;
  isMarkedForReview?: boolean;
  clientSequence: number;
}

export type PaletteState = 'CURRENT' | 'ANSWERED' | 'UNANSWERED' | 'MARKED';

export type ViolationType =
  | 'FULLSCREEN_EXIT'
  | 'TAB_SWITCH'
  | 'BLUR'
  | 'SHORTCUT_ATTEMPT'
  | 'CONTEXT_MENU';

export interface ExamViolationEvent {
  attemptId: string;
  type: ViolationType;
  occurredAt: string;
  details?: Record<string, any>;
}

// ==========================================
// Result & Grading Contracts
// ==========================================
export interface GradeSummary {
  attemptId: string;
  examId: string;
  userId: string;
  score: number;
  totalMarks: number;
  correctCount: number;
  wrongCount: number;
  skippedCount: number;
  accuracyPercentage: number;
  timeSpentSeconds: number;
  rank?: number;
  isPassed: boolean;
  status: AttemptStatus;
}

// ==========================================
// Course & CMS Contracts (Phase 6)
// ==========================================
export type CourseStatus = 'DRAFT' | 'PUBLISHED';
export type ResourceFileType = 'PDF' | 'NOTES' | 'SLIDES' | 'DOC';

export interface CategoryContract {
  id: string;
  name: string;
  nameBangla?: string;
  slug: string;
  sortOrder: number;
  createdAt?: string;
}

export interface CourseContract {
  id: string;
  categoryId: string;
  categoryName?: string;
  categoryNameBangla?: string;
  title: string;
  titleBangla?: string;
  slug: string;
  description?: string;
  coverImageUrl?: string;
  instructorId?: string;
  instructorName?: string;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface LessonResourceContract {
  id: string;
  lessonId: string;
  title: string;
  filePath: string;
  fileType: ResourceFileType;
  fileSizeBytes: number;
  createdAt: string;
}

export interface LessonContract {
  id: string;
  moduleId: string;
  title: string;
  titleBangla?: string;
  content?: string;
  videoUrl?: string;
  durationMinutes: number;
  isFreePreview: boolean;
  sortOrder: number;
  createdAt: string;
  resources?: LessonResourceContract[];
}

export interface CourseModuleContract {
  id: string;
  courseId: string;
  title: string;
  titleBangla?: string;
  sortOrder: number;
  createdAt: string;
  lessons?: LessonContract[];
}
