// Core entity types based on the database schema

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type CardStatus = 'In Progress' | 'Completed' | 'Paused';
export type ConnectionType = 'related' | 'prerequisite' | 'similar' | 'builds-upon';
export type TagCategory = 'algorithm' | 'data-structure' | 'pattern' | 'custom';

export interface Problem {
  id: string;
  title: string;
  description: string;
  difficulty: Difficulty;
  topic: string[];
  tags: string[];
  created_at: string;
  updated_at?: string; // Only set when actually updated
  leetcode_url?: string;
  constraints: string[];
  hints: string[];
  related_problem_ids: string[];
}

export interface Card {
  id: string;
  problem_id: string;
  card_number: number;
  code: string;
  language: string;
  notes: string;
  status: CardStatus;
  total_duration: number; // in seconds
  created_at: string;
  last_modified: string;
  parent_card_id?: string;
  is_solution?: boolean; // Optional for backward compatibility with solution cards
  _converted_at?: number; // Timestamp for React re-rendering when converting solution cards
}

export interface TimeSession {
  id: string;
  card_id: string;
  start_time: string;
  end_time?: string;
  duration?: number; // in seconds
  date: string;
  is_active: boolean;
  notes?: string;
}

export interface Recording {
  id: string;
  card_id: string;
  time_session_id?: string;
  audio_url: string;
  duration?: number;
  transcript?: string;
  created_at: string;
  filename: string;
  filepath: string;
  file_size?: number;
}

export interface Connection {
  id: string;
  source_card_id: string;
  target_card_id: string;
  connection_type: ConnectionType;
  notes?: string;
  created_at: string;
}

export interface Tag {
  id: string;
  name: string;
  color?: string;
  category: TagCategory;
}

// Image type for problem images
export interface ProblemImage {
  id: string;
  problem_id: string;
  image_path: string;
  caption?: string;
  position: number;
  created_at: string;
}

export interface CardImage {
  id: string;
  card_id: string;
  image_path: string;
  caption?: string;
  position: number;
  created_at: string;
}

// Frontend-specific types
export interface ProblemWithCards extends Problem {
  cards: Card[];
  total_time: number;
  last_worked_at?: string;
}

export interface CardWithDetails extends Card {
  problem: Problem;
  time_sessions: TimeSession[];
  recordings: Recording[];
  connections: Connection[];
  tags: Tag[];
}

export interface TimerState {
  isRunning: boolean;
  isPaused: boolean;
  currentSessionId?: string;
  sessionStartTime?: Date;
  elapsedTime: number; // in seconds
}

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  currentRecordingId?: string;
  recordingStartTime?: Date;
  elapsedRecordingTime: number; // in seconds
}

export interface AudioPlayerState {
  isVisible: boolean;
  recording: Recording | null;
  isPlaying: boolean;
  isPaused: boolean;
  savedPosition: number;
  audioUrl: string;
  isLoading: boolean;
  error: string;
  shouldAutoPlay: boolean;
  playbackSpeed: number;
}

export interface AppSettings {
  theme: 'light' | 'dark' | 'system';
  defaultLanguage: string;
  autoSave: boolean;
  autoSaveInterval: number; // in milliseconds
  showLineNumbers: boolean;
  fontFamily: string;
  fontSize: number;
  recordingQuality: 'low' | 'medium' | 'high';
  shortcuts: Record<string, string>;
}

// API Response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Recording info returned from Tauri
export interface RecordingInfo {
  filename: string;
  filepath: string;
}

// Analytics types
export interface StudyAnalytics {
  totalProblems: number;
  completedProblems: number;
  totalStudyTime: number; // in seconds
  averageSessionTime: number; // in seconds
  problemsByDifficulty: Record<Difficulty, number>;
  studyStreakDays: number;
  mostProductiveHour: number;
  weeklyProgress: {
    date: string;
    studyTime: number;
    problemsSolved: number;
  }[];
  topTags: {
    tag: string;
    count: number;
    successRate: number;
  }[];
}

// Filter and sort types
export interface ProblemFilter {
  difficulty?: Difficulty[];
  tags?: string[];
  status?: CardStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  hasRecordings?: boolean;
  minTime?: number; // minimum time spent in seconds
  maxTime?: number; // maximum time spent in seconds
}

export type ProblemSort = 
  | 'recent'
  | 'timeSpent'
  | 'difficulty'
  | 'title'
  | 'created'
  | 'sessions';

export interface SearchOptions {
  query: string;
  filter: ProblemFilter;
  sort: ProblemSort;
  sortDirection: 'asc' | 'desc';
}

// Tagging system interfaces
export interface TagModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (tags: Tag[]) => void;
  problemId: string;
  problemIds?: string[]; // For bulk operations
}

export interface ProblemContextMenuProps {
  isOpen: boolean;
  onClose: () => void;
  onManageTags: () => void;
  onEditProblem: () => void;
  onDeleteProblem: () => void;
  position: { x: number; y: number };
  problemId: string;
}

export interface AddProblemTagRequest {
  problem_id: string;
  tag_name: string;
  color?: string;
  category?: TagCategory;
}

export interface RemoveProblemTagRequest {
  problem_id: string;
  tag_id: string;
}

export interface GetTagSuggestionsRequest {
  query: string;
  limit?: number;
}

// Request types for problem operations
export interface CreateProblemRequest {
  title: string;
  description: string;
  difficulty: string;
  topic: string[];
  leetcode_url?: string;
  constraints: string[];
  hints: string[];
  related_problem_ids?: string[];
}

export interface UpdateProblemRequest {
  id: string;
  title?: string;
  description?: string;
  difficulty?: string;
  topic?: string[];
  leetcode_url?: string;
  constraints?: string[];
  hints?: string[];
  related_problem_ids?: string[];
}

// Problem connection request types
export interface SearchProblemsForConnectionRequest {
  query: string;
  limit?: number;
  exclude_id?: string;
}

export interface AddProblemRelationRequest {
  problem_id: string;
  related_problem_id: string;
}

export interface RemoveProblemRelationRequest {
  problem_id: string;
  related_problem_id: string;
}

export interface GetRelatedProblemsRequest {
  problem_id: string;
}

// Search-related types for the Name/Topic/Tags search system
export type SearchType = 'name' | 'topic' | 'tags';

export interface SearchState {
  query: string;
  searchType: SearchType;
  isSearching: boolean;
}

export interface SearchWithAutocompleteProps {
  onSearch: (query: string, searchType: SearchType) => void;
  onSuggestionSelect?: (suggestion: string) => void;
  placeholder?: string;
  className?: string;
}

export interface SearchSuggestion {
  value: string;
  type: SearchType;
  count?: number; // Number of problems matching this suggestion
}

// Problem deletion types
export interface ProblemDeleteStats {
  total_cards: number;
  main_cards: number;
  child_cards: number;
  recordings_count: number;
  images_count: number;
  total_duration: number; // in seconds
}

export interface DeleteProblemDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  problemTitle: string;
  deleteStats: ProblemDeleteStats | null;
  isLoading: boolean;
}

// Dashboard statistics types
export interface DashboardStats {
  total_problems: number;
  total_study_time: number; // in seconds
  problems_worked_today: number;
  completed_problems: number;
}

export interface ProblemsWorkedTodayResponse {
  count: number;
  date: string; // ISO date string (YYYY-MM-DD)
}

export interface DailyWorkStats {
  problems_worked: number;
  total_study_time_today: number; // in seconds
  date: string; // ISO date string (YYYY-MM-DD)
}