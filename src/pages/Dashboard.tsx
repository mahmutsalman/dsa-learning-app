import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { PlusIcon, ClockIcon, AcademicCapIcon, TagIcon, ArrowUpTrayIcon, CheckIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, CalendarDaysIcon, SparklesIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { Tooltip } from '../components/Tooltip';
import { Problem, Difficulty, Card, Tag, SearchState, SearchType, ProblemDeleteStats } from '../types';
import ProblemContextMenu from '../components/ProblemContextMenu';
import TagModal from '../components/TagModal';
import TagFilterModal from '../components/TagFilterModal';
import NewProblemModal from '../components/NewProblemModal';
import SearchWithAutocomplete from '../components/SearchWithAutocomplete';
import { ProblemImporter } from '../components/ProblemImporter/ProblemImporter';
import BulkDeleteDialog from '../components/BulkDeleteDialog';
import DeleteProblemDialog from '../components/DeleteProblemDialog';
import { ImportResult } from '../components/ProblemImporter/types';
import { useDashboardHeight } from '../hooks/useDashboardHeight';
import { useStats } from '../contexts/StatsContext';
import TodaysWorkCard from '../components/Dashboard/TodaysWorkCard';
import { useWorkedTodayFilter } from '../hooks/useWorkedTodayFilter';

const difficultyColors = {
  'Easy': 'bg-difficulty-easy text-green-800',
  'Medium': 'bg-difficulty-medium text-yellow-800',
  'Hard': 'bg-difficulty-hard text-red-800'
};

const DASHBOARD_RETURN_STATE_KEY = 'dashboard:returnState';
const DAILY_ACTIVE_STORAGE_KEY = 'dashboard:activeDailySet';
const DAILY_STUDY_SIZE_STORAGE_KEY = 'dashboard:dailyStudySize';
const DAILY_REVIEW_SIZE_STORAGE_KEY = 'dashboard:dailyReviewSize';

interface ProblemWithStudyTime extends Problem {
  totalStudyTime: number; // in seconds
  cardCount: number;
  problemTags?: Tag[]; // Optional tags for the problem
  lastUpdatedAt?: string; // Most recent card modification date
}

const DAILY_STUDY_SET_SIZE = 4;
const DAILY_REVIEW_SET_SIZE = 5;
const DAILY_STUDY_MIN_SECONDS = 600; // 10 minutes

const STUDY_SIZE_OPTIONS = [4, 8, 12, 16, 20] as const;
const REVIEW_SIZE_OPTIONS = [5, 10, 15, 20] as const;

const DAILY_STUDY_STORAGE_PREFIX = 'dashboard-daily-study-';
const DAILY_REVIEW_STORAGE_PREFIX = 'dashboard-daily-review-';
const DAILY_COMPLETED_STORAGE_PREFIX = 'dashboard-daily-completed-';
const DAILY_STUDY_FINISHED_PREFIX = 'dashboard-daily-study-finished-';
const DAILY_REVIEW_FINISHED_PREFIX = 'dashboard-daily-review-finished-';
const DAILY_REVIEW_COMPLETED_PREFIX = 'dashboard-daily-review-completed-';
const DAILY_REVIEW_ORIGINAL_PREFIX = 'dashboard-daily-review-original-';
const DAILY_REVIEW_TIMESTAMPS_PREFIX = 'dashboard-daily-review-timestamps-';

function stringToSeed(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) {
    hash = Math.imul(31, hash) + str.charCodeAt(i);
    hash |= 0; // Force 32-bit integer
  }
  return hash >>> 0;
}

function createSeededRandom(seedString: string): () => number {
  let seed = stringToSeed(seedString) || 1;
  return () => {
    seed += 0x6D2B79F5;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickRandomProblemIds(
  problems: ProblemWithStudyTime[],
  count: number,
  seedKey: string
): string[] {
  if (problems.length === 0) return [];
  if (problems.length <= count) {
    return problems.map((p) => p.id);
  }

  const rng = createSeededRandom(seedKey);
  const pool = [...problems].sort((a, b) => a.id.localeCompare(b.id));
  const selected: string[] = [];

  while (selected.length < count && pool.length > 0) {
    const index = Math.floor(rng() * pool.length);
    const [problem] = pool.splice(index, 1);
    selected.push(problem.id);
  }

  return selected;
}

function readDailySet(storageKey: string): string[] | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is string => typeof id === 'string');
    }
  } catch (error) {
    console.warn('Failed to read daily set from storage', error);
  }
  return null;
}

function saveDailySet(storageKey: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(ids));
  } catch (error) {
    console.warn('Failed to store daily set', error);
  }
}

function arraysEqual(a: string[], b: string[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i += 1) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

function readStoredSize<T extends readonly number[]>(key: string, fallback: number, options: T): number {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = parseInt(raw, 10);
    if (options.includes(parsed as T[number])) {
      return parsed;
    }
  } catch (error) {
    console.warn('Failed to read size preference', key, error);
  }
  return fallback;
}

function readCompletedTodayIds(today: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${DAILY_COMPLETED_STORAGE_PREFIX}${today}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.warn('Failed to read completed today problems', error);
    return [];
  }
}

function saveCompletedTodayIds(today: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DAILY_COMPLETED_STORAGE_PREFIX}${today}`;
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch (error) {
    console.warn('Failed to save completed today problems', error);
  }
}

function markDailyStudyCompleted(date: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DAILY_STUDY_FINISHED_PREFIX}${date}`;
    window.localStorage.setItem(key, 'true');
  } catch (error) {
    console.warn('Failed to mark daily study completed', error);
  }
}

function isDailyStudyCompleted(date: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `${DAILY_STUDY_FINISHED_PREFIX}${date}`;
    return window.localStorage.getItem(key) === 'true';
  } catch (error) {
    console.warn('Failed to check daily study completion', error);
    return false;
  }
}

function getPreviousDate(date: string): string {
  const d = new Date(date);
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

function markDailyReviewCompleted(date: string): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DAILY_REVIEW_FINISHED_PREFIX}${date}`;
    window.localStorage.setItem(key, 'true');
  } catch (error) {
    console.warn('Failed to mark daily review completed', error);
  }
}

function isDailyReviewCompleted(date: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const key = `${DAILY_REVIEW_FINISHED_PREFIX}${date}`;
    return window.localStorage.getItem(key) === 'true';
  } catch (error) {
    console.warn('Failed to check daily review completion', error);
    return false;
  }
}

function readCompletedReviewTodayIds(today: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${DAILY_REVIEW_COMPLETED_PREFIX}${today}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.warn('Failed to read completed review today problems', error);
    return [];
  }
}

function saveCompletedReviewTodayIds(today: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DAILY_REVIEW_COMPLETED_PREFIX}${today}`;
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch (error) {
    console.warn('Failed to save completed review today problems', error);
  }
}

function readOriginalDailyReviewIds(today: string): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const key = `${DAILY_REVIEW_ORIGINAL_PREFIX}${today}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : [];
  } catch (error) {
    console.warn('Failed to read original daily review problems', error);
    return [];
  }
}

function saveOriginalDailyReviewIds(today: string, ids: string[]): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DAILY_REVIEW_ORIGINAL_PREFIX}${today}`;
    window.localStorage.setItem(key, JSON.stringify(ids));
  } catch (error) {
    console.warn('Failed to save original daily review problems', error);
  }
}

function readDailyReviewTimestamps(today: string): Record<string, string> {
  if (typeof window === 'undefined') return {};
  try {
    const key = `${DAILY_REVIEW_TIMESTAMPS_PREFIX}${today}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (error) {
    console.warn('Failed to read daily review timestamps', error);
    return {};
  }
}

function saveDailyReviewTimestamps(today: string, timestamps: Record<string, string>): void {
  if (typeof window === 'undefined') return;
  try {
    const key = `${DAILY_REVIEW_TIMESTAMPS_PREFIX}${today}`;
    window.localStorage.setItem(key, JSON.stringify(timestamps));
  } catch (error) {
    console.warn('Failed to save daily review timestamps', error);
  }
}

function cleanupOldDailyData(): void {
  if (typeof window === 'undefined') return;
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 30); // Keep 30 days
    const cutoffString = cutoffDate.toISOString().split('T')[0];

    const keys = Object.keys(localStorage);
    const dailyKeys = keys.filter(key =>
      key.startsWith(DAILY_STUDY_STORAGE_PREFIX) ||
      key.startsWith(DAILY_REVIEW_STORAGE_PREFIX) ||
      key.startsWith(DAILY_COMPLETED_STORAGE_PREFIX) ||
      key.startsWith(DAILY_STUDY_FINISHED_PREFIX) ||
      key.startsWith(DAILY_REVIEW_FINISHED_PREFIX) ||
      key.startsWith(DAILY_REVIEW_COMPLETED_PREFIX) ||
      key.startsWith(DAILY_REVIEW_ORIGINAL_PREFIX) ||
      key.startsWith(DAILY_REVIEW_TIMESTAMPS_PREFIX)
    );

    for (const key of dailyKeys) {
      const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})$/);
      if (dateMatch && dateMatch[1] < cutoffString) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn('Failed to cleanup old daily data', error);
  }
}

export type SortOption = 'created_at' | 'lastUpdatedAt' | 'title' | 'studyTime';
export type SortDirection = 'asc' | 'desc';

export default function Dashboard() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<ProblemWithStudyTime[]>([]);
  const [filteredProblems, setFilteredProblems] = useState<ProblemWithStudyTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Search state
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    searchType: 'name',
    isSearching: false
  });
  
  // Sorting state
  const [sortBy, setSortBy] = useState<SortOption>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  
  // Tag filtering state
  const [selectedFilterTags, setSelectedFilterTags] = useState<Tag[]>([]);
  const [showTagFilterModal, setShowTagFilterModal] = useState(false);
  
  // Worked today filter state
  const workedTodayFilter = useWorkedTodayFilter();
  
  // Use stats context
  const { showStats } = useStats();
  
  // Calculate dashboard height for proper scrolling
  const { containerHeight } = useDashboardHeight({
    headerHeight: showStats ? 200 : 120, // Adjust based on stats visibility
    paddingTotal: 80,  // Container padding
    minimumHeight: 500,
    maximumHeight: 1200,
  });

  // Calculate number of problems with study time > 0
  const studiedProblemsCount = filteredProblems.filter(p => p.totalStudyTime && p.totalStudyTime > 0).length;
  
  // Context menu and tag modal state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNewProblemModal, setShowNewProblemModal] = useState(false);
  const [showEditProblemModal, setShowEditProblemModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [problemToEdit, setProblemToEdit] = useState<ProblemWithStudyTime | null>(null);

  // Multi-selection state
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedProblemIds, setSelectedProblemIds] = useState<Set<string>>(new Set());
  const [isBulkTagModal, setIsBulkTagModal] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);

  // Single problem delete state
  const [showDeleteProblemDialog, setShowDeleteProblemDialog] = useState(false);
  const [problemToDelete, setProblemToDelete] = useState<ProblemWithStudyTime | null>(null);
  const [deleteStats, setDeleteStats] = useState<ProblemDeleteStats | null>(null);
  const [isLoadingDeleteStats, setIsLoadingDeleteStats] = useState(false);

  const [dailyStudyIds, setDailyStudyIds] = useState<string[]>([]);
  const [dailyReviewIds, setDailyReviewIds] = useState<string[]>([]);
  const [completedTodayIds, setCompletedTodayIds] = useState<string[]>([]);
  const [completedReviewTodayIds, setCompletedReviewTodayIds] = useState<string[]>([]);
  const [originalDailyReviewIds, setOriginalDailyReviewIds] = useState<string[]>([]);
  const [activeDailySet, setActiveDailySet] = useState<'study' | 'review' | null>(null);
  const [dailyStudySize, setDailyStudySize] = useState(() => readStoredSize(DAILY_STUDY_SIZE_STORAGE_KEY, DAILY_STUDY_SET_SIZE, STUDY_SIZE_OPTIONS));
  const [dailyReviewSize, setDailyReviewSize] = useState(() => readStoredSize(DAILY_REVIEW_SIZE_STORAGE_KEY, DAILY_REVIEW_SET_SIZE, REVIEW_SIZE_OPTIONS));
  const hasInitializedActiveSetRef = useRef(false);
  const [dailyMenu, setDailyMenu] = useState<{ type: 'study' | 'review'; x: number; y: number } | null>(null);

  const problemMap = useMemo(() => {
    const map = new Map<string, ProblemWithStudyTime>();
    problems.forEach(problem => {
      map.set(problem.id, problem);
    });
    return map;
  }, [problems]);

  const dailyStudyProblems = useMemo(() => (
    dailyStudyIds
      .map(id => problemMap.get(id))
      .filter(Boolean) as ProblemWithStudyTime[]
  ), [dailyStudyIds, problemMap]);

  const dailyReviewProblems = useMemo(() => (
    dailyReviewIds
      .map(id => problemMap.get(id))
      .filter(Boolean) as ProblemWithStudyTime[]
  ), [dailyReviewIds, problemMap]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const problemsSectionRef = useRef<HTMLDivElement>(null);
  const [highlightedProblemId, setHighlightedProblemId] = useState<string | null>(null);
  const [pendingReturnState, setPendingReturnState] = useState<{ problemId: string; scrollTop: number; dailySet?: 'study' | 'review' | null } | null>(null);

  const scrollProblemsIntoView = useCallback(() => {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      problemsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const stored = window.sessionStorage.getItem(DASHBOARD_RETURN_STATE_KEY);
    if (!stored) return;

    try {
      const parsed = JSON.parse(stored) as { problemId?: string; scrollTop?: number; timestamp?: number; activeDailySet?: 'study' | 'review' | null };
      window.sessionStorage.removeItem(DASHBOARD_RETURN_STATE_KEY);

      if (!parsed?.problemId || typeof parsed.scrollTop !== 'number') return;

      const isFresh = !parsed.timestamp || Date.now() - parsed.timestamp < 5 * 60 * 1000;
      if (isFresh) {
        if (parsed.activeDailySet === 'study' || parsed.activeDailySet === 'review' || parsed.activeDailySet === null) {
          setActiveDailySet(parsed.activeDailySet ?? null);
        }
        setPendingReturnState({ problemId: parsed.problemId, scrollTop: parsed.scrollTop, dailySet: parsed.activeDailySet });
      }
    } catch (error) {
      console.warn('Failed to parse dashboard return state', error);
      window.sessionStorage.removeItem(DASHBOARD_RETURN_STATE_KEY);
    }
  }, []);

  useEffect(() => {
    if (hasInitializedActiveSetRef.current) return;
    if (typeof window === 'undefined') return;

    const stored = window.sessionStorage.getItem(DAILY_ACTIVE_STORAGE_KEY);
    if (stored === 'study' || stored === 'review') {
      const list = stored === 'study' ? dailyStudyIds : dailyReviewIds;
      if (list.length > 0) {
        setActiveDailySet(stored);
      }
    }

    hasInitializedActiveSetRef.current = true;
  }, [dailyStudyIds, dailyReviewIds]);

  useEffect(() => {
    if (!pendingReturnState) return;
    if (loading) return;
    if (pendingReturnState.dailySet && activeDailySet !== pendingReturnState.dailySet) {
      setActiveDailySet(pendingReturnState.dailySet);
      return;
    }
    if ((pendingReturnState.dailySet === null || pendingReturnState.dailySet === undefined) && activeDailySet) {
      setActiveDailySet(null);
      return;
    }
    if (filteredProblems.length === 0) return;

    const hasProblem = filteredProblems.some(problem => problem.id === pendingReturnState.problemId);
    if (!hasProblem) {
      setPendingReturnState(null);
      return;
    }

    const container = scrollContainerRef.current;
    if (!container) return;

    requestAnimationFrame(() => {
      if (pendingReturnState.dailySet) {
        scrollProblemsIntoView();
        requestAnimationFrame(() => {
          container.scrollTo({ top: pendingReturnState.scrollTop, behavior: 'auto' });
        });
      } else {
        container.scrollTo({ top: pendingReturnState.scrollTop, behavior: 'auto' });
      }
      setHighlightedProblemId(pendingReturnState.problemId);
      setPendingReturnState(null);
    });
  }, [pendingReturnState, loading, filteredProblems, activeDailySet]);

  useEffect(() => {
    if (!highlightedProblemId) return;

    const timeoutId = window.setTimeout(() => {
      setHighlightedProblemId(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [highlightedProblemId]);

  useEffect(() => {
    if (!dailyMenu) return;

    const handleClick = () => setDailyMenu(null);
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDailyMenu(null);
    };

    document.addEventListener('click', handleClick);
    document.addEventListener('contextmenu', handleClick);
    document.addEventListener('keydown', handleKey);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [dailyMenu]);

  // Sort problems based on selected criteria
  const sortProblems = (problemsToSort: ProblemWithStudyTime[], sortOption: SortOption, direction: SortDirection): ProblemWithStudyTime[] => {
    return [...problemsToSort].sort((a, b) => {
      let aValue: string | undefined;
      let bValue: string | undefined;
      
      switch (sortOption) {
        case 'created_at':
          aValue = a.created_at;
          bValue = b.created_at;
          break;
        case 'lastUpdatedAt':
          aValue = a.lastUpdatedAt;
          bValue = b.lastUpdatedAt;
          break;
        case 'title':
          aValue = a.title;
          bValue = b.title;
          break;
        case 'studyTime':
          // For study time, we'll use numeric comparison directly
          const aTime = a.totalStudyTime || 0;
          const bTime = b.totalStudyTime || 0;
          return direction === 'asc' ? aTime - bTime : bTime - aTime;
        default:
          aValue = a.created_at;
          bValue = b.created_at;
      }
      
      // Handle undefined values (put them at the end)
      if (!aValue && !bValue) return 0;
      if (!aValue) return 1;
      if (!bValue) return -1;
      
      // For date fields, parse as dates
      if (sortOption !== 'title') {
        const aDate = new Date(aValue).getTime();
        const bDate = new Date(bValue).getTime();
        return direction === 'asc' ? aDate - bDate : bDate - aDate;
      }
      
      // For title, use string comparison
      const comparison = aValue.localeCompare(bValue);
      return direction === 'asc' ? comparison : -comparison;
    });
  };

  // Helper function to format time display
  const formatTimeDisplay = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else if (minutes > 0) {
      return `${minutes}m`;
    } else if (seconds > 0) {
      return `${seconds}s`;
    } else {
      return '0h';
    }
  };

  // Helper function to format dates for display with detailed time info
  const formatDateDisplay = (dateString: string): string => {
    // Parse the UTC date string and convert to local timezone
    const date = new Date(dateString);
    
    // Format time in local timezone (Istanbul GMT+3)
    const timeString = date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit',
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use system timezone
    });
    
    const now = new Date();
    
    // Compare dates in local timezone by getting just the date part
    const dateOnly = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffTime = nowOnly.getTime() - dateOnly.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
      return `Today ${timeString}`;
    } else if (diffDays === 1) {
      return `Yesterday ${timeString}`;
    } else if (diffDays < 7) {
      return `${diffDays} days ago ${timeString}`;
    } else if (diffDays < 30) {
      const weeks = Math.floor(diffDays / 7);
      const weekText = weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
      return `${weekText} ${timeString}`;
    } else if (diffDays < 365) {
      const months = Math.floor(diffDays / 30);
      const monthText = months === 1 ? '1 month ago' : `${months} months ago`;
      return `${monthText} ${timeString}`;
    } else {
      const dateStr = date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone // Use system timezone
      });
      return `${dateStr} ${timeString}`;
    }
  };

  // Heat map intensity calculation functions
  const getStudyTimeIntensity = (studyTime: number, allStudyTimes: number[]): number => {
    // If no study time, return 0 (no styling)
    if (studyTime === 0 || allStudyTimes.length === 0) return 0;
    
    // Filter out zero values for ranking
    const nonZeroTimes = allStudyTimes.filter(t => t > 0);
    if (nonZeroTimes.length === 0) return 0;
    
    // Handle case with only one non-zero value
    if (nonZeroTimes.length === 1) return 2;
    
    // Sort times to get ranking (ascending order)
    const sortedTimes = [...nonZeroTimes].sort((a, b) => a - b);
    
    // Find position of current study time
    const position = sortedTimes.filter(t => t < studyTime).length;
    const percentile = position / sortedTimes.length;
    
    // Assign intensity based on percentile ranges
    // Ensures any non-zero time gets at least level 1
    if (percentile <= 0.25) return 1;      // Bottom 25%
    else if (percentile <= 0.5) return 2;  // 25-50%
    else if (percentile <= 0.75) return 3; // 50-75%
    else return 4;                         // Top 25%
  };

  const getRecencyIntensity = (lastUpdated: string | undefined, allDates: (string | undefined)[]): number => {
    if (!lastUpdated) return 0;
    
    const validDates = allDates.filter(date => date) as string[];
    if (validDates.length === 0) return 0;
    
    // Handle case with only one valid date
    if (validDates.length === 1) return 2;
    
    const currentTime = new Date(lastUpdated).getTime();
    
    // Sort dates by age (most recent first)
    const sortedDates = validDates
      .map(d => new Date(d).getTime())
      .sort((a, b) => b - a); // Descending order (newest first)
    
    // Find position of current date in sorted array
    const position = sortedDates.findIndex(d => d <= currentTime);
    const percentile = position / sortedDates.length;
    
    // Assign intensity based on percentile ranges
    // More recent dates get higher intensity
    if (percentile <= 0.25) return 4;      // Top 25% most recent
    else if (percentile <= 0.5) return 3;  // 25-50% recent
    else if (percentile <= 0.75) return 2; // 50-75% older
    else return 1;                         // Bottom 25% oldest
  };

  // Get heat map classes based on intensity level - with improved dark mode
  const getHeatMapClasses = (intensity: number): string => {
    if (intensity === 0) return '';
    
    switch (intensity) {
      case 1:
        return 'border-l-4 border-l-blue-300 dark:border-l-blue-400 bg-blue-50 dark:bg-blue-900/30';
      case 2:
        return 'border-l-4 border-l-blue-400 dark:border-l-blue-300 bg-blue-100 dark:bg-blue-800/40';
      case 3:
        return 'border-l-4 border-l-blue-500 dark:border-l-blue-200 bg-blue-200 dark:bg-blue-700/50';
      case 4:
        return 'border-l-4 border-l-blue-600 dark:border-l-blue-100 bg-blue-300 dark:bg-blue-600/60';
      default:
        return '';
    }
  };

  // Handle sorting change
  const handleSortChange = (newSortBy: SortOption, newSortDirection?: SortDirection) => {
    const direction = newSortDirection || (newSortBy === sortBy ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'desc');
    setSortBy(newSortBy);
    setSortDirection(direction);
    
    // Apply sorting to current problems
    const sortedProblems = sortProblems(problems, newSortBy, direction);
    setProblems(sortedProblems);
    
    // Apply sorting to filtered problems as well
    const sortedFilteredProblems = sortProblems(filteredProblems, newSortBy, direction);
    setFilteredProblems(sortedFilteredProblems);
  };

  useEffect(() => {
    loadProblems();

    // Initialize completed today IDs and cleanup old data
    const today = new Date().toISOString().split('T')[0];
    const completedIds = readCompletedTodayIds(today);
    const completedReviewIds = readCompletedReviewTodayIds(today);
    const originalReviewIds = readOriginalDailyReviewIds(today);
    setCompletedTodayIds(completedIds);
    setCompletedReviewTodayIds(completedReviewIds);
    setOriginalDailyReviewIds(originalReviewIds);

    // Cleanup old data periodically
    cleanupOldDailyData();
  }, []);

  useEffect(() => {
    if (problems.length === 0) {
      setDailyStudyIds(prev => (prev.length === 0 ? prev : []));
      setDailyReviewIds(prev => (prev.length === 0 ? prev : []));
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    const yesterday = getPreviousDate(today);

    const studyStorageKey = `${DAILY_STUDY_STORAGE_PREFIX}${today}`;
    const reviewStorageKey = `${DAILY_REVIEW_STORAGE_PREFIX}${today}`;

    const yesterdayStudyKey = `${DAILY_STUDY_STORAGE_PREFIX}${yesterday}`;
    const yesterdayReviewKey = `${DAILY_REVIEW_STORAGE_PREFIX}${yesterday}`;

    const isUnstudied = (problem: ProblemWithStudyTime) => {
      const total = problem.totalStudyTime || 0;
      return total < DAILY_STUDY_MIN_SECONDS;
    };

    // Smart daily set resolution with carry-over logic
    const resolveSmartDailyIds = (): { studyIds: string[], reviewIds: string[] } => {
      // Check if today's sets already exist (app reopened same day)
      const existingStudyIds = readDailySet(studyStorageKey);
      const existingReviewIds = readDailySet(reviewStorageKey);

      // Handle Daily Study validation independently
      let finalStudyIds: string[] = [];
      if (existingStudyIds) {
        // Validate existing Daily Study against current problems
        const validStudyIds = existingStudyIds.filter(id => {
          const problem = problemMap.get(id);
          return problem && isUnstudied(problem);
        });
        finalStudyIds = validStudyIds;
      }

      // Handle Daily Review validation independently
      let finalReviewIds: string[] = [];
      if (existingReviewIds) {
        // Validate existing Daily Review against current problems
        const validReviewIds = existingReviewIds.filter(id => {
          const problem = problemMap.get(id);
          return problem && (problem.totalStudyTime || 0) > 0 && !finalStudyIds.includes(id);
        });
        finalReviewIds = validReviewIds;
      }

      // If both sets exist and are valid, return them
      if (finalStudyIds.length > 0 && finalReviewIds.length > 0) {
        return { studyIds: finalStudyIds, reviewIds: finalReviewIds };
      }

      // If only Daily Study exists and is valid, continue with carry-over logic for Review
      if (finalStudyIds.length > 0 && finalReviewIds.length === 0) {
        // Keep the valid study set, but need to resolve review through carry-over or creation
      } else if (finalStudyIds.length === 0 && finalReviewIds.length > 0) {
        // Keep the valid review set, but need to resolve study through carry-over or creation
      }
      // If neither exists or both are invalid, continue with full carry-over logic

      // Check if yesterday's daily study was completed
      const yesterdayCompleted = isDailyStudyCompleted(yesterday);
      const yesterdayStudyIds = readDailySet(yesterdayStudyKey);
      const yesterdayReviewIds = readDailySet(yesterdayReviewKey);

      // Check if yesterday's daily review was also completed
      const yesterdayReviewCompleted = isDailyReviewCompleted(yesterday);

      // Carry over logic for incomplete previous day (only if we don't have valid existing sets)
      if (finalStudyIds.length === 0 && !yesterdayCompleted && yesterdayStudyIds && yesterdayStudyIds.length > 0) {
        // Carry over yesterday's incomplete study set, but validate problems still exist
        const validCarryOverIds = yesterdayStudyIds.filter(id => {
          const problem = problemMap.get(id);
          return problem && isUnstudied(problem);
        });

        if (validCarryOverIds.length > 0) {
          finalStudyIds = validCarryOverIds;

          // Also carry over yesterday's completed IDs to maintain progress
          const yesterdayCompletedIds = readCompletedTodayIds(yesterday);
          if (yesterdayCompletedIds.length > 0) {
            saveCompletedTodayIds(today, yesterdayCompletedIds);
            setCompletedTodayIds(yesterdayCompletedIds);
          }

          // Carry over review set too if it exists (only if we don't have valid existing review)
          if (finalReviewIds.length === 0 && yesterdayReviewIds && yesterdayReviewIds.length > 0) {
            const validReviewCarryOver = yesterdayReviewIds.filter(id => {
              const problem = problemMap.get(id);
              return problem && (problem.totalStudyTime || 0) > 0 && !finalStudyIds.includes(id);
            });
            finalReviewIds = validReviewCarryOver;

            // Also carry over yesterday's completed review IDs to maintain progress
            const yesterdayCompletedReviewIds = readCompletedReviewTodayIds(yesterday);
            if (yesterdayCompletedReviewIds.length > 0) {
              saveCompletedReviewTodayIds(today, yesterdayCompletedReviewIds);
              setCompletedReviewTodayIds(yesterdayCompletedReviewIds);
            }
          }
        }
      }

      // Carry over logic for incomplete review from previous day (independent of study)
      if (!yesterdayReviewCompleted && yesterdayReviewIds && yesterdayReviewIds.length > 0 && finalReviewIds.length === 0) {
        // Carry over yesterday's incomplete review set, but validate problems still exist
        const validReviewCarryOverIds = yesterdayReviewIds.filter(id => {
          const problem = problemMap.get(id);
          return problem && (problem.totalStudyTime || 0) > 0 && !finalStudyIds.includes(id);
        });

        if (validReviewCarryOverIds.length > 0) {
          finalReviewIds = validReviewCarryOverIds;

          // Also carry over yesterday's completed review IDs to maintain progress
          const yesterdayCompletedReviewIds = readCompletedReviewTodayIds(yesterday);
          if (yesterdayCompletedReviewIds.length > 0) {
            saveCompletedReviewTodayIds(today, yesterdayCompletedReviewIds);
            setCompletedReviewTodayIds(yesterdayCompletedReviewIds);
          }

          // Carry over or create the original Daily Review IDs tracking
          const yesterdayOriginalIds = readOriginalDailyReviewIds(yesterday);
          if (yesterdayOriginalIds.length > 0) {
            saveOriginalDailyReviewIds(today, yesterdayOriginalIds);

            // Carry over timestamps
            const yesterdayTimestamps = readDailyReviewTimestamps(yesterday);
            saveDailyReviewTimestamps(today, yesterdayTimestamps);
          } else {
            // If no original IDs from yesterday, use the carried over IDs as original
            saveOriginalDailyReviewIds(today, validReviewCarryOverIds);

            // Create new timestamps for carried over problems
            const currentTime = new Date().toISOString();
            const timestamps: Record<string, string> = {};
            validReviewCarryOverIds.forEach(id => {
              timestamps[id] = currentTime;
            });
            saveDailyReviewTimestamps(today, timestamps);
          }
        }
      }

      // If no carry-over or carry-over is empty, create new sets
      if (finalStudyIds.length === 0) {
        const completedToday = readCompletedTodayIds(today);
        const completedSet = new Set(completedToday);

        // Create new study set
        const eligibleForStudy = problems.filter(p => isUnstudied(p) && !completedSet.has(p.id));
        if (eligibleForStudy.length > 0) {
          const selectedForStudy = pickRandomProblemIds(
            eligibleForStudy,
            dailyStudySize,
            `${studyStorageKey}-${eligibleForStudy.length}`
          );
          finalStudyIds = selectedForStudy.slice(0, dailyStudySize);
        }

      }

      // Create new review set if not carried over and not already created
      if (finalReviewIds.length === 0) {
        const completedReviewToday = readCompletedReviewTodayIds(today);
        const completedReviewSet = new Set(completedReviewToday);

        const eligibleForReview = problems.filter(p =>
          (p.totalStudyTime || 0) > 0 && !finalStudyIds.includes(p.id) && !completedReviewSet.has(p.id)
        );
        if (eligibleForReview.length > 0) {
          const selectedForReview = pickRandomProblemIds(
            eligibleForReview,
            dailyReviewSize,
            `${reviewStorageKey}-${eligibleForReview.length}`
          );
          finalReviewIds = selectedForReview.slice(0, dailyReviewSize);
        }
      }

      // Save the resolved sets
      saveDailySet(studyStorageKey, finalStudyIds);
      saveDailySet(reviewStorageKey, finalReviewIds);

      // Save original Daily Review IDs for accurate completion tracking
      if (finalReviewIds.length > 0) {
        const existingOriginal = readOriginalDailyReviewIds(today);
        if (existingOriginal.length === 0) {
          saveOriginalDailyReviewIds(today, finalReviewIds);

          // Store timestamps for when each problem was added to Daily Review
          const currentTime = new Date().toISOString();
          const timestamps: Record<string, string> = {};
          finalReviewIds.forEach(id => {
            timestamps[id] = currentTime;
          });
          saveDailyReviewTimestamps(today, timestamps);
        }
      }

      return { studyIds: finalStudyIds, reviewIds: finalReviewIds };
    };

    const { studyIds, reviewIds } = resolveSmartDailyIds();

    setDailyStudyIds(prev => (arraysEqual(prev, studyIds) ? prev : studyIds));
    setDailyReviewIds(prev => (arraysEqual(prev, reviewIds) ? prev : reviewIds));

    // Update original Daily Review IDs when they are loaded
    const currentOriginalIds = readOriginalDailyReviewIds(today);
    setOriginalDailyReviewIds(prev => (arraysEqual(prev, currentOriginalIds) ? prev : currentOriginalIds));
  }, [problems, problemMap, dailyStudySize, dailyReviewSize]);

  // Effect to monitor study progress and remove completed problems from daily study
  useEffect(() => {
    if (dailyStudyIds.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    let hasChanges = false;
    let newCompletedIds = [...completedTodayIds];
    let newDailyStudyIds = [...dailyStudyIds];

    // Check each problem in daily study to see if it's completed (≥10 minutes)
    for (const problemId of dailyStudyIds) {
      const problem = problemMap.get(problemId);
      if (problem && problem.totalStudyTime >= DAILY_STUDY_MIN_SECONDS) {
        // Problem is completed - remove from daily study and mark as completed today
        if (!completedTodayIds.includes(problemId)) {
          newCompletedIds.push(problemId);
          hasChanges = true;
        }

        // Remove from daily study set
        const studyIndex = newDailyStudyIds.indexOf(problemId);
        if (studyIndex > -1) {
          newDailyStudyIds.splice(studyIndex, 1);
          hasChanges = true;
        }
      }
    }

    if (hasChanges) {
      // Update state
      setCompletedTodayIds(newCompletedIds);
      setDailyStudyIds(newDailyStudyIds);

      // Persist to localStorage
      saveCompletedTodayIds(today, newCompletedIds);
      const studyStorageKey = `${DAILY_STUDY_STORAGE_PREFIX}${today}`;
      saveDailySet(studyStorageKey, newDailyStudyIds);

      // Check if daily study is now complete (all problems finished)
      if (newDailyStudyIds.length === 0 && newCompletedIds.length > 0) {
        markDailyStudyCompleted(today);
      }
    }
  }, [problems, problemMap, dailyStudyIds, completedTodayIds]);

  // Effect to monitor daily review progress and remove updated problems
  useEffect(() => {
    if (dailyReviewIds.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    let hasChanges = false;
    let newCompletedReviewIds = [...completedReviewTodayIds];
    let newDailyReviewIds = [...dailyReviewIds];

    // Get timestamps for when problems were added to Daily Review
    const reviewTimestamps = readDailyReviewTimestamps(today);

    // Check each problem in daily review to see if it has been updated
    for (const problemId of dailyReviewIds) {
      const problem = problemMap.get(problemId);
      const reviewAddedTime = reviewTimestamps[problemId];

      if (problem && reviewAddedTime && problem.lastUpdatedAt) {
        // Check if problem was updated after it was added to Daily Review
        const addedDate = new Date(reviewAddedTime);
        const updatedDate = new Date(problem.lastUpdatedAt);

        if (updatedDate > addedDate) {
          // Problem has been updated - remove from daily review and mark as completed today
          if (!completedReviewTodayIds.includes(problemId)) {
            newCompletedReviewIds.push(problemId);
            hasChanges = true;
          }

          // Remove from daily review set
          const reviewIndex = newDailyReviewIds.indexOf(problemId);
          if (reviewIndex > -1) {
            newDailyReviewIds.splice(reviewIndex, 1);
            hasChanges = true;
          }
        }
      }
    }

    if (hasChanges) {
      // Update state
      setCompletedReviewTodayIds(newCompletedReviewIds);
      setDailyReviewIds(newDailyReviewIds);

      // Persist to localStorage
      saveCompletedReviewTodayIds(today, newCompletedReviewIds);
      const reviewStorageKey = `${DAILY_REVIEW_STORAGE_PREFIX}${today}`;
      saveDailySet(reviewStorageKey, newDailyReviewIds);

      // Check if daily review is now complete (all problems finished)
      if (newDailyReviewIds.length === 0 && newCompletedReviewIds.length > 0) {
        markDailyReviewCompleted(today);
      }
    }
  }, [problems, problemMap, dailyReviewIds, completedReviewTodayIds]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (activeDailySet) {
      window.sessionStorage.setItem(DAILY_ACTIVE_STORAGE_KEY, activeDailySet);
    } else {
      window.sessionStorage.removeItem(DAILY_ACTIVE_STORAGE_KEY);
    }
  }, [activeDailySet]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DAILY_STUDY_SIZE_STORAGE_KEY, String(dailyStudySize));
  }, [dailyStudySize]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(DAILY_REVIEW_SIZE_STORAGE_KEY, String(dailyReviewSize));
  }, [dailyReviewSize]);

  // Listen to worked today filter changes and update filtered problems
  useEffect(() => {
    if (problems.length > 0) {
      applyAllFilters(problems);
    }
  }, [workedTodayFilter.isFiltered, workedTodayFilter.problemIds, activeDailySet, dailyStudyIds, dailyReviewIds]);

  useEffect(() => {
    if (activeDailySet === 'study' && dailyStudyIds.length === 0) {
      setActiveDailySet(null);
    } else if (activeDailySet === 'review' && dailyReviewIds.length === 0) {
      setActiveDailySet(null);
    }
  }, [activeDailySet, dailyStudyIds, dailyReviewIds]);

  const loadProblems = async () => {
    try {
      setLoading(true);
      const baseProblems = await invoke<Problem[]>('get_problems');
      
      // For each problem, get its cards, tags, time sessions and calculate additional fields
      const problemsWithStudyTime = await Promise.all(
        baseProblems.map(async (problem) => {
          try {
            const [cards, tags] = await Promise.all([
              invoke<Card[]>('get_cards_for_problem', { problemId: problem.id }),
              invoke<Tag[]>('get_problem_tags', { problemId: problem.id })
            ]);
            
            // Sum up total_duration from all cards for this problem
            const totalStudyTime = cards.reduce((sum, card) => sum + (card.total_duration || 0), 0);
            
            // Use problem.updated_at as the last updated timestamp (simplified)
            const lastUpdatedAt = problem.updated_at;
            
            return {
              ...problem,
              totalStudyTime,
              cardCount: cards.length,
              problemTags: tags,
              lastUpdatedAt
            } as ProblemWithStudyTime;
          } catch (err) {
            console.error(`Failed to load data for problem ${problem.id}:`, err);
            return {
              ...problem,
              totalStudyTime: 0,
              cardCount: 0,
              problemTags: [],
              lastUpdatedAt: undefined
            } as ProblemWithStudyTime;
          }
        })
      );
      
      const sortedProblems = sortProblems(problemsWithStudyTime, sortBy, sortDirection);
      setProblems(sortedProblems);
      setFilteredProblems(sortedProblems); // Initialize filtered problems
      setError(null);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load problems:', err);
    } finally {
      setLoading(false);
    }
  };

  const createNewProblem = () => {
    setShowNewProblemModal(true);
  };

  const openImportModal = () => {
    setShowImportModal(true);
  };

  const handleImportComplete = async (result: ImportResult) => {
    if (result.success && result.importedCount > 0) {
      // Reload problems to show newly imported ones
      await loadProblems();
    }
  };

  // Handle right-click context menu
  const handleRightClick = (e: React.MouseEvent, problemId: string) => {
    e.preventDefault(); // Prevent default browser context menu
    e.stopPropagation(); // Stop event from bubbling up
    
    setContextMenuPosition({
      x: e.clientX,
      y: e.clientY,
    });
    setSelectedProblemId(problemId);
    setShowContextMenu(true);
  };

  // Handle card click for navigation or selection
  const handleCardClick = (e: React.MouseEvent, problemId: string) => {
    // Only handle left click
    if (e.button !== 0) return;

    e.preventDefault();
    
    // Ctrl/Cmd + Click: Toggle individual selection
    if (e.ctrlKey || e.metaKey) {
      if (!isSelectionMode) {
        enterSelectionMode(problemId);
      } else {
        toggleSelection(problemId);
      }
      return;
    }
    
    // In selection mode, toggle selection instead of navigating
    if (isSelectionMode) {
      toggleSelection(problemId);
    } else {
      if (typeof window !== 'undefined') {
        const scrollTop = scrollContainerRef.current?.scrollTop ?? 0;
        const payload = JSON.stringify({
          problemId,
          scrollTop,
          activeDailySet,
          timestamp: Date.now(),
        });
        try {
          window.sessionStorage.setItem(DASHBOARD_RETURN_STATE_KEY, payload);
        } catch (error) {
          console.warn('Failed to store dashboard return state', error);
        }
      }
      navigate(`/problem/${problemId}`);
    }
  };

  // Handle checkbox click
  const handleCheckboxClick = (e: React.MouseEvent, problemId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isSelectionMode) {
      enterSelectionMode(problemId);
    } else {
      toggleSelection(problemId);
    }
  };

  // Handle manage tags action
  const handleManageTags = () => {
    setShowTagModal(true);
  };

  // Handle tag save
  const handleTagSave = async () => {
    // Reload problems to get updated tags
    await loadProblems();
    
    // If it was a bulk operation, clear selection and exit selection mode
    if (isBulkTagModal) {
      setIsBulkTagModal(false);
      clearSelection();
    }
  };

  // Handle new problem save
  const handleNewProblemSave = async () => {
    // Reload problems to show the new problem
    await loadProblems();
  };

  // Handle edit problem action
  const handleEditProblem = async () => {
    const selectedProblem = problems.find(p => p.id === selectedProblemId);
    if (selectedProblem) {
      try {
        // Fetch the complete problem data from backend
        const fullProblem = await invoke<Problem>('get_problem_by_id', { id: selectedProblemId });
        if (fullProblem) {
          // Convert Problem to ProblemWithStudyTime for consistency
          const problemWithStudyTime = {
            ...fullProblem,
            totalStudyTime: selectedProblem.totalStudyTime,
            cardCount: selectedProblem.cardCount,
            problemTags: selectedProblem.problemTags
          };
          setProblemToEdit(problemWithStudyTime);
          setShowEditProblemModal(true);
        }
      } catch (error) {
        console.error('Failed to fetch problem for editing:', error);
        // Could add toast notification here
      }
    }
  };

  // Handle edit problem save
  const handleEditProblemSave = async () => {
    // Reload problems to show the updated problem
    await loadProblems();
    setProblemToEdit(null);
  };

  // Handle delete problem action
  const handleDeleteProblem = async () => {
    const selectedProblem = problems.find(p => p.id === selectedProblemId);
    if (!selectedProblem) {
      console.error('Selected problem not found');
      return;
    }

    setProblemToDelete(selectedProblem);
    setIsLoadingDeleteStats(true);
    setDeleteStats(null);
    setShowDeleteProblemDialog(true);

    try {
      // Load deletion stats
      const stats = await invoke<ProblemDeleteStats | null>('get_problem_delete_stats', { 
        problemId: selectedProblemId 
      });
      setDeleteStats(stats);
    } catch (error) {
      console.error('Failed to load delete stats:', error);
      // Still show dialog even if stats fail to load
      setDeleteStats(null);
    } finally {
      setIsLoadingDeleteStats(false);
    }
  };

  // Handle delete problem confirmation
  const handleDeleteProblemConfirm = async () => {
    if (!problemToDelete) return;

    try {
      await invoke('delete_problem', { id: problemToDelete.id });
      
      // Reload problems to reflect changes
      await loadProblems();
      
      // Close dialog and reset state
      setShowDeleteProblemDialog(false);
      setProblemToDelete(null);
      setDeleteStats(null);
      
      // Show success notification (you can add a toast notification system if desired)
      console.log(`Problem "${problemToDelete.title}" deleted successfully`);
      
    } catch (error) {
      console.error('Failed to delete problem:', error);
      // You might want to show an error message to the user here
      alert(`Failed to delete problem: ${error}`);
    }
  };

  // Handle delete problem cancel
  const handleDeleteProblemCancel = () => {
    setShowDeleteProblemDialog(false);
    setProblemToDelete(null);
    setDeleteStats(null);
    setIsLoadingDeleteStats(false);
  };

  // Handle search functionality
  const handleSearch = async (query: string, searchType: SearchType) => {
    console.log('DEBUG: handleSearch called with:', { query, searchType, stackTrace: new Error().stack });
    
    if (!query.trim()) {
      // If empty query, show all problems
      setFilteredProblems(problems);
      setSearchState({ query: '', searchType, isSearching: false });
      return;
    }

    setSearchState({ query, searchType, isSearching: true });
    console.log('DEBUG: Updated searchState:', { query, searchType, isSearching: true });

    try {
      let searchResults: Problem[] = [];
      
      switch (searchType) {
        case 'name':
          console.log('DEBUG: Executing name search');
          searchResults = await invoke<Problem[]>('search_problems_by_name', { query });
          break;
        case 'topic':
          console.log('DEBUG: Executing topic search');
          searchResults = await invoke<Problem[]>('search_problems_by_topic', { query });
          break;
        case 'tags':
          console.log('DEBUG: Executing tags search');
          searchResults = await invoke<Problem[]>('search_problems_by_tags', { query });
          break;
        default:
          console.error('Invalid search type:', searchType);
          return;
      }
      
      console.log('DEBUG: Search results received:', searchResults.length);

      // Convert search results to ProblemWithStudyTime format by finding matches in current problems
      const searchResultIds = new Set(searchResults.map(p => p.id));
      const filteredProblemsWithStudyTime = problems.filter(p => searchResultIds.has(p.id));
      
      setFilteredProblems(filteredProblemsWithStudyTime);
      setSearchState({ query, searchType, isSearching: false });
    } catch (error) {
      console.error('Search failed:', error);
      setSearchState({ query, searchType, isSearching: false });
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    console.log('DEBUG: handleSuggestionSelect called with:', { suggestion, searchStateType: searchState.searchType });
    handleSearch(suggestion, searchState.searchType);
  };

  // Handle tag filtering
  const handleTagFilter = async (tags: Tag[]) => {
    setSelectedFilterTags(tags);
    
    if (tags.length === 0) {
      // No tags selected, show all problems (respecting search if any)
      if (searchState.query) {
        // If there's a search query, keep the search results
        return;
      } else {
        setFilteredProblems(problems);
      }
      return;
    }

    try {
      console.log('DEBUG: Filtering by tags:', tags.map(t => t.name));
      const tagIds = tags.map(tag => tag.id);
      const filteredProblemsData = await invoke<Problem[]>('filter_problems_by_tags', { tagIds });
      
      // Convert to ProblemWithStudyTime format by finding matches in current problems
      const filteredProblemIds = new Set(filteredProblemsData.map(p => p.id));
      let filteredProblemsWithStudyTime = problems.filter(p => filteredProblemIds.has(p.id));
      
      // If there's also a search query, further filter the results
      if (searchState.query) {
        const searchResultIds = new Set(filteredProblems.map(p => p.id));
        filteredProblemsWithStudyTime = filteredProblemsWithStudyTime.filter(p => searchResultIds.has(p.id));
      }
      
      // Apply current sorting
      const sortedResults = sortProblems(filteredProblemsWithStudyTime, sortBy, sortDirection);
      setFilteredProblems(sortedResults);
      
      console.log('DEBUG: Tag filter applied, found', filteredProblemsWithStudyTime.length, 'problems');
    } catch (error) {
      console.error('Tag filtering failed:', error);
      // Show error or fallback to showing all problems
    }
  };

  // Clear tag filter
  const clearTagFilter = () => {
    setSelectedFilterTags([]);
    if (searchState.query) {
      // If there's a search, rerun the search without tag filtering
      handleSearch(searchState.query, searchState.searchType);
    } else {
      // No search, show all problems
      applyAllFilters(problems);
    }
  };

  // Apply all active filters (search, tags, worked today) to the problems
  const applyAllFilters = (sourceProblems: ProblemWithStudyTime[]) => {
    let filteredProblems = [...sourceProblems];
    
    // Apply search filter
    if (searchState.query) {
      // Keep current search results if search is active
      // This function is called when other filters change, not when search changes
      const currentSearchResultIds = new Set(filteredProblems.map(p => p.id));
      filteredProblems = filteredProblems.filter(p => currentSearchResultIds.has(p.id));
    }
    
    // Apply tag filter
    if (selectedFilterTags.length > 0) {
      // Note: This is simplified for now. In a real implementation, you'd want to
      // call the backend API again or maintain a local cache of tag-filtered results
      console.log('Tag filter active, need to reapply');
    }
    
    // Apply worked today filter
    if (workedTodayFilter.isFiltered) {
      const workedTodayIds = new Set(workedTodayFilter.problemIds);
      filteredProblems = filteredProblems.filter(p => workedTodayIds.has(p.id));
    }
    
    // Apply daily study/review sets when active
    if (activeDailySet === 'study') {
      const studySet = new Set(dailyStudyIds);
      filteredProblems = filteredProblems.filter(p => studySet.has(p.id));
    } else if (activeDailySet === 'review') {
      const reviewSet = new Set(dailyReviewIds);
      filteredProblems = filteredProblems.filter(p => reviewSet.has(p.id));
    }

    // Apply sorting
    const sortedResults = sortProblems(filteredProblems, sortBy, sortDirection);
    setFilteredProblems(sortedResults);
  };

  // Handle worked today filter toggle
  const handleWorkedTodayToggle = () => {
    if (activeDailySet) {
      setActiveDailySet(null);
    }
    workedTodayFilter.toggleFilter();
    scrollProblemsIntoView();
  };

  const handleDailySetToggle = (setType: 'study' | 'review') => {
    const targetIds = setType === 'study' ? dailyStudyIds : dailyReviewIds;
    if (targetIds.length === 0) return;

    if (workedTodayFilter.isFiltered) {
      workedTodayFilter.clearFilter();
    }

    const next = activeDailySet === setType ? null : setType;
    setActiveDailySet(next);
    scrollProblemsIntoView();
  };

  const handleSizeSelection = (setType: 'study' | 'review', size: number) => {
    if (setType === 'study') {
      setDailyStudySize(size);
    } else {
      setDailyReviewSize(size);
    }
    setDailyMenu(null);
    scrollProblemsIntoView();
  };

  const renderSizeMenu = () => {
    if (!dailyMenu) return null;
    const options = dailyMenu.type === 'study' ? STUDY_SIZE_OPTIONS : REVIEW_SIZE_OPTIONS;
    const activeSize = dailyMenu.type === 'study' ? dailyStudySize : dailyReviewSize;
    const viewportWidth = typeof window !== 'undefined' ? window.innerWidth : 0;
    const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 0;
    const menuWidth = 160;
    const menuHeight = options.length * 32 + 16;
    const left = Math.min(dailyMenu.x, Math.max(0, viewportWidth - menuWidth - 8));
    const top = Math.min(dailyMenu.y, Math.max(0, viewportHeight - menuHeight - 8));

    return (
      <div className="fixed inset-0 pointer-events-none z-50">
        <div
          className="absolute pointer-events-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md shadow-lg py-2"
          style={{ left, top, width: menuWidth }}
        >
          <div className="px-3 pb-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
            {dailyMenu.type === 'study' ? 'Daily Study Size' : 'Daily Review Size'}
          </div>
          <div className="space-y-1">
            {options.map((option) => (
              <button
                key={option}
                onClick={() => handleSizeSelection(dailyMenu.type, option)}
                className={`w-full flex items-center justify-between px-3 py-1 text-sm hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                  activeSize === option ? 'text-primary-600 dark:text-primary-400 font-medium' : 'text-gray-700 dark:text-gray-200'
                }`}
              >
                <span>{option} problems</span>
                {activeSize === option && (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const renderDailySetCard = (setType: 'study' | 'review') => {
    const problemsList = setType === 'study' ? dailyStudyProblems : dailyReviewProblems;
    const hasProblems = problemsList.length > 0;
    const isActive = activeDailySet === setType;
    const title = setType === 'study' ? 'Daily Study' : 'Daily Review';
    const description = setType === 'study'
      ? 'Complete 10 minutes of study for each problem to finish your daily goal.'
      : 'Previously studied problems to reinforce.';
    const accentTextClass = setType === 'study' ? 'text-indigo-500' : 'text-amber-500';
    const accentDotClass = setType === 'study' ? 'bg-indigo-400' : 'bg-amber-400';
    const icon = setType === 'study'
      ? <SparklesIcon className="h-6 w-6" />
      : <ArrowPathIcon className="h-6 w-6" />;
    const countLabel = problemsList.length === 1 ? 'problem' : 'problems';
    const targetSize = setType === 'study' ? dailyStudySize : dailyReviewSize;

    // Create tooltip content explaining the carry-over rules
    const tooltipContent = setType === 'study'
      ? "📚 Daily Study Rules:\n\n• Study each problem for 10+ minutes to complete it\n• Unfinished problems carry over to the next day\n• Your progress is saved and continues where you left off\n• Complete all problems to finish your daily goal"
      : "🔄 Daily Review Rules:\n\n• Review previously studied problems to reinforce learning\n• Update any card to mark as reviewed and remove from today's list\n• Card must be updated to count as completed review\n• Finished reviews get closer to your daily review goal\n• Problems that need more review stay in rotation";

    // Filter completed count to only include problems that were in the original Daily Review set
    const relevantCompletedCount = setType === 'review'
      ? completedReviewTodayIds.filter(id => originalDailyReviewIds.includes(id)).length
      : completedTodayIds.length;

    const handleClick = () => {
      if (!hasProblems) return;
      handleDailySetToggle(setType);
    };

    const handleKeyPress = (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (!hasProblems) return;
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        handleDailySetToggle(setType);
      }
    };

    const handleContextMenu = (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const x = Math.min(event.clientX, window.innerWidth - 20);
      const y = Math.min(event.clientY, window.innerHeight - 20);
      setDailyMenu({ type: setType, x, y });
    };

    return (
      <Tooltip
        content={tooltipContent}
        delay={500}
        maxWidth="350px"
        followCursor={true}
      >
        <div
          key={setType}
          className={`
            bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700
            transition-all duration-200
            ${hasProblems ? 'cursor-pointer hover:border-primary-300 dark:hover:border-primary-600 hover:shadow-md' : 'opacity-60'}
            ${isActive ? 'border-primary-400 dark:border-primary-500 ring-2 ring-primary-400/40 dark:ring-primary-500/50' : ''}
          `}
          onClick={hasProblems ? handleClick : undefined}
          role={hasProblems ? 'button' : undefined}
          tabIndex={hasProblems ? 0 : undefined}
          onKeyPress={hasProblems ? handleKeyPress : undefined}
          aria-disabled={!hasProblems}
          onContextMenu={handleContextMenu}
        >
        <div className="flex items-start justify-between">
          <div className={`h-8 w-8 ${accentTextClass} flex-shrink-0`}>{icon}</div>
          {isActive && (
            <span className="text-xs font-medium text-primary-500 dark:text-primary-300 bg-primary-50 dark:bg-primary-900/30 px-2 py-0.5 rounded-full">
              Active
            </span>
          )}
        </div>

        <div className="mt-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{title}</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
        </div>

        <div className="mt-4 flex items-baseline space-x-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white">{problemsList.length}</span>
          <span className="text-sm text-gray-500 dark:text-gray-400">{countLabel}</span>
          {setType === 'study' && completedTodayIds.length > 0 && (
            <span className="text-sm text-green-600 dark:text-green-400">
              ({completedTodayIds.length} completed)
            </span>
          )}
          {setType === 'review' && relevantCompletedCount > 0 && (
            <span className="text-sm text-green-600 dark:text-green-400">
              ({relevantCompletedCount} completed)
            </span>
          )}
        </div>
        <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          {setType === 'study' ? (
            completedTodayIds.length > 0
              ? `Progress: ${completedTodayIds.length}/${completedTodayIds.length + problemsList.length} completed`
              : `Target: ${targetSize} ${targetSize === 1 ? 'problem' : 'problems'} (right-click to change)`
          ) : setType === 'review' ? (
            relevantCompletedCount > 0
              ? `Progress: ${relevantCompletedCount}/${relevantCompletedCount + problemsList.length} completed`
              : `Target: ${targetSize} ${targetSize === 1 ? 'problem' : 'problems'} (right-click to change)`
          ) : (
            `Target: ${targetSize} ${targetSize === 1 ? 'problem' : 'problems'} (right-click to change)`
          )}
        </div>

        {/* Progress bar for daily study */}
        {setType === 'study' && (completedTodayIds.length > 0 || problemsList.length > 0) && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-indigo-500 to-indigo-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${completedTodayIds.length / (completedTodayIds.length + problemsList.length) * 100}%`
                }}
              ></div>
            </div>
          </div>
        )}

        {/* Progress bar for daily review */}
        {setType === 'review' && (relevantCompletedCount > 0 || problemsList.length > 0) && (
          <div className="mt-3">
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-amber-500 to-amber-600 h-2 rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${relevantCompletedCount / (relevantCompletedCount + problemsList.length) * 100}%`
                }}
              ></div>
            </div>
          </div>
        )}

        <div className="mt-4">
          {hasProblems ? (
            <ul className="space-y-1">
              {problemsList.slice(0, 3).map((problem) => (
                <li key={problem.id} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${accentDotClass}`} aria-hidden="true"></span>
                  <span className="truncate">{problem.title}</span>
                </li>
              ))}
              {problemsList.length > 3 && (
                <li className="text-xs text-gray-500 dark:text-gray-400">
                  +{problemsList.length - 3} more ready to go
                </li>
              )}
            </ul>
          ) : setType === 'study' && completedTodayIds.length > 0 ? (
            // Congratulations message for completed daily study
            <div className="text-center py-4">
              <SparklesIcon className="h-8 w-8 text-yellow-500 mx-auto mb-3" />
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                🎉 Congratulations! 🎉
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                You completed today's study goal!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {completedTodayIds.length} problem{completedTodayIds.length !== 1 ? 's' : ''} studied for 10+ minutes
              </p>
            </div>
          ) : setType === 'review' && relevantCompletedCount > 0 ? (
            // Congratulations message for completed daily review
            <div className="text-center py-4">
              <SparklesIcon className="h-8 w-8 text-amber-500 mx-auto mb-3" />
              <h4 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                🌟 Excellent! 🌟
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-1">
                You completed today's review goal!
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {relevantCompletedCount} problem{relevantCompletedCount !== 1 ? 's' : ''} reviewed for 10+ minutes
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {setType === 'study'
                ? "Add more problems to build this daily set."
                : "Add more problems to build this daily set."
              }
            </p>
          )}
        </div>
        </div>
      </Tooltip>
    );
  };

  // Multi-selection handlers
  const toggleSelection = (problemId: string) => {
    setSelectedProblemIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(problemId)) {
        newSet.delete(problemId);
      } else {
        newSet.add(problemId);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    setSelectedProblemIds(new Set(filteredProblems.map(p => p.id)));
  };

  const clearSelection = () => {
    setSelectedProblemIds(new Set());
    setIsSelectionMode(false);
  };

  const enterSelectionMode = (problemId?: string) => {
    setIsSelectionMode(true);
    if (problemId) {
      setSelectedProblemIds(new Set([problemId]));
    }
  };

  const handleBulkAddTags = () => {
    setIsBulkTagModal(true);
    setShowTagModal(true);
  };

  const handleBulkDelete = () => {
    setShowBulkDeleteDialog(true);
  };

  const handleBulkDeleteConfirm = async () => {
    try {
      const problemIds = Array.from(selectedProblemIds);
      await invoke('delete_problems_bulk', { problemIds });
      
      // Reload problems to reflect changes
      await loadProblems();
      
      // Clear selection and exit selection mode
      clearSelection();
    } catch (error) {
      console.error('Bulk delete failed:', error);
      throw error; // Re-throw to let dialog handle it
    }
  };

  // Close context menu when clicking elsewhere
  useEffect(() => {
    const handleClickOutside = () => {
      setShowContextMenu(false);
    };

    if (showContextMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showContextMenu]);

  // Keyboard shortcuts for multi-selection
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check if we're in an input field
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.contentEditable === 'true') {
        return;
      }

      // Ctrl/Cmd + A: Select all visible problems
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault();
        if (!isSelectionMode) {
          setIsSelectionMode(true);
        }
        selectAll();
      }

      // Escape: Exit selection mode and clear selection
      if (e.key === 'Escape' && isSelectionMode) {
        clearSelection();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isSelectionMode, filteredProblems]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading problems: {error}</p>
          <button 
            onClick={loadProblems}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-800">
      {renderSizeMenu()}
      {/* Header */}
      <div className="flex-shrink-0 p-6 pb-4">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Track your DSA learning progress
            </p>
          </div>
          
          <div className="flex items-center space-x-3">
            <button
              onClick={createNewProblem}
              className="flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              <PlusIcon className="h-5 w-5 mr-2" />
              New Problem
            </button>
            
            <button
              onClick={openImportModal}
              className="flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
            >
              <ArrowUpTrayIcon className="h-5 w-5 mr-2" />
              Import from TXT
            </button>
          </div>
        </div>

        {/* Stats */}
        {showStats && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <AcademicCapIcon className="h-8 w-8 text-primary-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {problems.length}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">Total Problems</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <ClockIcon className="h-8 w-8 text-green-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {formatTimeDisplay(problems.reduce((sum, p) => sum + p.totalStudyTime, 0))}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">Time Studied</p>
                  </div>
                </div>
              </div>
              
              <TodaysWorkCard onClick={handleWorkedTodayToggle} />
              
              <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700">
                <div className="flex items-center">
                  <AcademicCapIcon className="h-8 w-8 text-yellow-500" />
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">0</h3>
                    <p className="text-gray-600 dark:text-gray-400">Completed</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              {renderDailySetCard('study')}
              {renderDailySetCard('review')}
            </div>
          </>
        )}

        {/* Search Interface */}
        <div ref={problemsSectionRef} className="mb-6">
          <SearchWithAutocomplete
            onSearch={handleSearch}
            onSuggestionSelect={handleSuggestionSelect}
            className="mb-4"
          />
          
          {/* Sorting Controls */}
          <div className="flex items-center justify-center space-x-4 mb-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
            
            <button
              onClick={() => handleSortChange('created_at')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sortBy === 'created_at' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Creation Date
              {sortBy === 'created_at' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="ml-1 h-4 w-4" />
                  : <ChevronDownIcon className="ml-1 h-4 w-4" />
              )}
            </button>
            
            <button
              onClick={() => handleSortChange('lastUpdatedAt')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sortBy === 'lastUpdatedAt' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Last Updated
              {sortBy === 'lastUpdatedAt' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="ml-1 h-4 w-4" />
                  : <ChevronDownIcon className="ml-1 h-4 w-4" />
              )}
            </button>
            
            <button
              onClick={() => handleSortChange('title')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sortBy === 'title' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Title
              {sortBy === 'title' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="ml-1 h-4 w-4" />
                  : <ChevronDownIcon className="ml-1 h-4 w-4" />
              )}
            </button>
            
            <button
              onClick={() => setShowTagFilterModal(true)}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                selectedFilterTags.length > 0 
                  ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300' 
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <TagIcon className="h-4 w-4 mr-1" />
              Tags
              {selectedFilterTags.length > 0 && (
                <span className="ml-1 bg-primary-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {selectedFilterTags.length}
                </span>
              )}
            </button>
            
            <button
              onClick={() => handleSortChange('studyTime')}
              className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                sortBy === 'studyTime' 
                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <ClockIcon className="h-4 w-4 mr-1" />
              Study Time
              {sortBy === 'studyTime' && studiedProblemsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.5 bg-blue-200 dark:bg-blue-800 text-blue-900 dark:text-blue-100 text-xs rounded-full font-semibold">
                  {studiedProblemsCount} studied
                </span>
              )}
              {sortBy === 'studyTime' && (
                sortDirection === 'asc' 
                  ? <ChevronUpIcon className="ml-1 h-4 w-4" />
                  : <ChevronDownIcon className="ml-1 h-4 w-4" />
              )}
            </button>
          </div>
          
          {/* Search Results Info */}
          {searchState.query && (
            <div className="text-sm text-gray-600 dark:text-gray-400 text-center">
              {searchState.isSearching ? (
                <span className="flex items-center justify-center">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2"></div>
                  Searching...
                </span>
              ) : (
                <span>
                  Found {filteredProblems.length} result{filteredProblems.length !== 1 ? 's' : ''} for "{searchState.query}" in {searchState.searchType}
                  {filteredProblems.length !== problems.length && (
                    <button
                      onClick={() => handleSearch('', searchState.searchType)}
                      className="ml-2 text-blue-500 hover:text-blue-600 underline"
                    >
                      Clear search
                    </button>
                  )}
                </span>
              )}
            </div>
          )}
          
          {/* Active Tag Filters */}
          {selectedFilterTags.length > 0 && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
              <span className="text-gray-600 dark:text-gray-400">Filtered by:</span>
              {selectedFilterTags.map(tag => (
                <span
                  key={tag.id}
                  className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 rounded-full"
                >
                  <TagIcon className="h-3 w-3" />
                  {tag.name}
                  <button
                    onClick={() => {
                      const newTags = selectedFilterTags.filter(t => t.id !== tag.id);
                      handleTagFilter(newTags);
                    }}
                    className="ml-1 hover:bg-primary-200 dark:hover:bg-primary-800 rounded-full p-0.5"
                  >
                    <XMarkIcon className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                onClick={clearTagFilter}
                className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 underline"
              >
                Clear all filters
              </button>
            </div>
          )}
          
          {/* Worked Today Filter */}
          {workedTodayFilter.isFiltered && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm mt-2">
              <span className="text-gray-600 dark:text-gray-400">Showing:</span>
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                <CalendarDaysIcon className="h-3 w-3" />
                Problems worked today ({workedTodayFilter.problemIds.length})
                <button
                  onClick={handleWorkedTodayToggle}
                  className="ml-1 hover:bg-blue-200 dark:hover:bg-blue-800 rounded-full p-0.5"
                  title="Clear worked today filter"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
              {workedTodayFilter.problemIds.length === 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  No problems worked today
                </span>
              )}
            </div>
          )}

          {activeDailySet && (
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm mt-2">
              <span className="text-gray-600 dark:text-gray-400">Showing:</span>
              <span
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full ${
                  activeDailySet === 'study'
                    ? 'bg-indigo-100 dark:bg-indigo-900 text-indigo-800 dark:text-indigo-200'
                    : 'bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200'
                }`}
              >
                {activeDailySet === 'study' ? (
                  <SparklesIcon className="h-3 w-3" />
                ) : (
                  <ArrowPathIcon className="h-3 w-3" />
                )}
                {activeDailySet === 'study' ? 'Daily study' : 'Daily review'} ({
                  activeDailySet === 'study' ? dailyStudyIds.length : dailyReviewIds.length
                })
                <button
                  onClick={() => setActiveDailySet(null)}
                  className="ml-1 hover:bg-black/10 dark:hover:bg-white/10 rounded-full p-0.5"
                  title="Clear daily set filter"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable Problems Grid Container */}
      <div 
        className="flex-1 px-6 pb-6"
        style={{ maxHeight: `${containerHeight}px` }}
      >
        <div
          ref={scrollContainerRef}
          className="h-full overflow-y-auto"
          onWheel={(event) => {
            const container = scrollContainerRef.current;
            if (!container) return;
            const atTop = container.scrollTop <= 0;
            const atBottom = container.scrollHeight - container.scrollTop - container.clientHeight <= 1;
            if ((event.deltaY < 0 && atTop) || (event.deltaY > 0 && atBottom)) {
              container.blur();
            }
          }}
        >
          {filteredProblems.length === 0 ? (
            <div className="text-center py-12">
              <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
              {problems.length === 0 ? (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No problems</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Get started by creating your first problem.
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={createNewProblem}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700"
                    >
                      <PlusIcon className="h-4 w-4 mr-2" />
                      New Problem
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No results found</h3>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    No problems match your search criteria for "{searchState.query}".
                  </p>
                  <div className="mt-6">
                    <button
                      onClick={() => handleSearch('', searchState.searchType)}
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-400 dark:hover:bg-blue-800"
                    >
                      Clear search
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-8">
              {(() => {
                // Calculate data arrays for heat map intensity calculations
                const allStudyTimes = filteredProblems.map(p => p.totalStudyTime || 0);
                const allLastUpdated = filteredProblems.map(p => p.lastUpdatedAt);
                
                return filteredProblems.map((problem) => {
                  const isSelected = selectedProblemIds.has(problem.id);
                  const isHighlighted = highlightedProblemId === problem.id;
                  
                  // Calculate heat map intensity based on current sort
                  let heatMapClasses = '';
                  if (sortBy === 'studyTime') {
                    const intensity = getStudyTimeIntensity(problem.totalStudyTime || 0, allStudyTimes);
                    heatMapClasses = getHeatMapClasses(intensity);
                  } else if (sortBy === 'lastUpdatedAt') {
                    const intensity = getRecencyIntensity(problem.lastUpdatedAt, allLastUpdated);
                    heatMapClasses = getHeatMapClasses(intensity);
                  }
                  
                  const cardStateClasses = isSelected
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : isHighlighted
                    ? 'border-primary-400 dark:border-primary-500 ring-2 ring-primary-400 dark:ring-primary-500 ring-opacity-70 ring-offset-1 ring-offset-white dark:ring-offset-gray-900'
                    : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600';

                  return (
                    <div
                      key={problem.id}
                      onClick={(e) => handleCardClick(e, problem.id)}
                      onContextMenu={(e) => handleRightClick(e, problem.id)}
                      className={`${
                        heatMapClasses || 'bg-white dark:bg-gray-800'
                      } rounded-lg p-6 shadow-sm border group cursor-pointer select-none relative transition-colors duration-200 ease-out ${cardStateClasses}`}
                    >
                  {/* Selection checkbox */}
                  <div className="absolute top-3 left-3 z-10">
                    <button
                      onClick={(e) => handleCheckboxClick(e, problem.id)}
                      className={`w-5 h-5 rounded border-2 transition-all duration-200 flex items-center justify-center ${
                        isSelected
                          ? 'bg-primary-500 border-primary-500 text-white'
                          : isSelectionMode
                          ? 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-primary-400'
                          : 'border-transparent opacity-0 group-hover:opacity-100 group-hover:border-gray-300 dark:group-hover:border-gray-600 bg-white dark:bg-gray-800'
                      }`}
                    >
                      {isSelected && <CheckIcon className="h-3 w-3" />}
                    </button>
                  </div>
                  <div className="flex items-start justify-between mb-3">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400">
                      {problem.title}
                    </h3>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      difficultyColors[problem.difficulty as Difficulty] || 'bg-gray-100 text-gray-800'
                    }`}>
                      {problem.difficulty}
                    </span>
                  </div>
                  
                  <p className="text-gray-600 dark:text-gray-400 text-sm mb-4 line-clamp-2">
                    {problem.description}
                  </p>
                  
                  {/* Tags display */}
                  {problem.problemTags && problem.problemTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {problem.problemTags.slice(0, 3).map((tag) => (
                        <span
                          key={tag.id}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-xs rounded-full"
                        >
                          <TagIcon className="h-3 w-3" />
                          {tag.name}
                        </span>
                      ))}
                      {problem.problemTags.length > 3 && (
                        <span className="inline-flex items-center px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 text-xs rounded-full">
                          +{problem.problemTags.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-sm">
                    <div className="text-gray-500 dark:text-gray-400">
                      <span>{problem.cardCount} cards • {formatTimeDisplay(problem.totalStudyTime)} studied</span>
                      {problem.related_problem_ids && problem.related_problem_ids.length > 0 && (
                        <span className="ml-2">
                          • {problem.related_problem_ids.length} related {problem.related_problem_ids.length === 1 ? 'question' : 'questions'}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  {/* Date Information */}
                  <div className="flex items-center justify-between text-xs text-gray-400 dark:text-gray-500 mt-2">
                    <div className="flex space-x-4">
                      <span>Created: {formatDateDisplay(problem.created_at)}</span>
                      {problem.lastUpdatedAt && (
                        <span>Updated: {formatDateDisplay(problem.lastUpdatedAt)}</span>
                      )}
                    </div>
                    <span className="text-primary-500 dark:text-primary-400 text-sm">
                      Open →
                    </span>
                  </div>
                </div>
              );
            });
              })()}
            </div>
          )}
        </div>
      </div>

      {/* Bulk Selection Toolbar */}
      {selectedProblemIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-4">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              {selectedProblemIds.size} selected
            </span>
            
            <div className="flex items-center gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Select All ({filteredProblems.length})
              </button>
              
              <button
                onClick={clearSelection}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                Clear
              </button>
              
              <button
                onClick={handleBulkAddTags}
                className="flex items-center px-3 py-1 bg-primary-500 text-white text-xs rounded hover:bg-primary-600 transition-colors"
              >
                <TagIcon className="h-3 w-3 mr-1" />
                Add Tags
              </button>
              
              <button
                onClick={handleBulkDelete}
                className="flex items-center px-3 py-1 bg-red-500 text-white text-xs rounded hover:bg-red-600 transition-colors"
              >
                <TrashIcon className="h-3 w-3 mr-1" />
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Context Menu */}
      <ProblemContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        onManageTags={handleManageTags}
        onEditProblem={handleEditProblem}
        onDeleteProblem={handleDeleteProblem}
        position={contextMenuPosition}
        problemId={selectedProblemId}
      />

      {/* Tag Modal */}
      <TagModal
        isOpen={showTagModal}
        onClose={() => {
          setShowTagModal(false);
          setIsBulkTagModal(false);
        }}
        onSave={handleTagSave}
        problemId={isBulkTagModal ? '' : selectedProblemId}
        problemIds={isBulkTagModal ? Array.from(selectedProblemIds) : undefined}
      />

      {/* New Problem Modal */}
      <NewProblemModal
        isOpen={showNewProblemModal}
        onClose={() => setShowNewProblemModal(false)}
        onSave={handleNewProblemSave}
      />

      {/* Edit Problem Modal */}
      <NewProblemModal
        isOpen={showEditProblemModal}
        onClose={() => {
          setShowEditProblemModal(false);
          setProblemToEdit(null);
        }}
        onSave={handleEditProblemSave}
        editMode={true}
        existingProblem={problemToEdit || undefined}
      />

      {/* TXT Import Modal */}
      <ProblemImporter
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={handleImportComplete}
      />

      {/* Bulk Delete Dialog */}
      <BulkDeleteDialog
        isOpen={showBulkDeleteDialog}
        onClose={() => setShowBulkDeleteDialog(false)}
        onConfirm={handleBulkDeleteConfirm}
        selectedCount={selectedProblemIds.size}
        selectedProblems={filteredProblems
          .filter(problem => selectedProblemIds.has(problem.id))
          .map(problem => ({
            id: problem.id,
            title: problem.title,
            cardCount: problem.cardCount
          }))
        }
      />

      {/* Delete Problem Dialog */}
      <DeleteProblemDialog
        isOpen={showDeleteProblemDialog}
        onClose={handleDeleteProblemCancel}
        onConfirm={handleDeleteProblemConfirm}
        problemTitle={problemToDelete?.title || ''}
        deleteStats={deleteStats}
        isLoading={isLoadingDeleteStats}
      />

      {/* Tag Filter Modal */}
      <TagFilterModal
        isOpen={showTagFilterModal}
        onClose={() => setShowTagFilterModal(false)}
        onApply={handleTagFilter}
        initialSelectedTags={selectedFilterTags}
      />
    </div>
  );
}
