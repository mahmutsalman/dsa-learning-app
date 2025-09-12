import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { PlusIcon, ClockIcon, AcademicCapIcon, TagIcon, ArrowUpTrayIcon, CheckIcon, TrashIcon, ChevronUpIcon, ChevronDownIcon, XMarkIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';
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

interface ProblemWithStudyTime extends Problem {
  totalStudyTime: number; // in seconds
  cardCount: number;
  problemTags?: Tag[]; // Optional tags for the problem
  lastUpdatedAt?: string; // Most recent card modification date
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
    const date = new Date(dateString);
    const timeString = date.toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
    
    const now = new Date();
    const diffTime = now.getTime() - date.getTime();
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
        day: 'numeric' 
      });
      return `${dateStr} ${timeString}`;
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
  }, []);

  // Listen to worked today filter changes and update filtered problems
  useEffect(() => {
    if (problems.length > 0) {
      applyAllFilters(problems);
    }
  }, [workedTodayFilter.isFiltered, workedTodayFilter.problemIds]);

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
    
    // Apply sorting
    const sortedResults = sortProblems(filteredProblems, sortBy, sortDirection);
    setFilteredProblems(sortedResults);
  };

  // Handle worked today filter toggle
  const handleWorkedTodayToggle = () => {
    workedTodayFilter.toggleFilter();
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
        )}

        {/* Search Interface */}
        <div className="mb-6">
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
        </div>
      </div>

      {/* Scrollable Problems Grid Container */}
      <div 
        className="flex-1 px-6 pb-6"
        style={{ maxHeight: `${containerHeight}px` }}
      >
        <div className="h-full overflow-y-auto">
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
              {filteredProblems.map((problem) => {
                const isSelected = selectedProblemIds.has(problem.id);
                return (
                <div
                  key={problem.id}
                  onClick={(e) => handleCardClick(e, problem.id)}
                  onContextMenu={(e) => handleRightClick(e, problem.id)}
                  className={`bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border transition-colors group cursor-pointer select-none relative ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                      : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600'
                  }`}
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
              })}
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