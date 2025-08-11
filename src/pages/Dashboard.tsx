import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { PlusIcon, ClockIcon, AcademicCapIcon, TagIcon } from '@heroicons/react/24/outline';
import { Problem, Difficulty, Card, Tag } from '../types';
import ProblemContextMenu from '../components/ProblemContextMenu';
import TagModal from '../components/TagModal';
import NewProblemModal from '../components/NewProblemModal';

const difficultyColors = {
  'Easy': 'bg-difficulty-easy text-green-800',
  'Medium': 'bg-difficulty-medium text-yellow-800',
  'Hard': 'bg-difficulty-hard text-red-800'
};

interface ProblemWithStudyTime extends Problem {
  totalStudyTime: number; // in seconds
  cardCount: number;
  problemTags?: Tag[]; // Optional tags for the problem
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [problems, setProblems] = useState<ProblemWithStudyTime[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Context menu and tag modal state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 });
  const [selectedProblemId, setSelectedProblemId] = useState<string>('');
  const [showTagModal, setShowTagModal] = useState(false);
  const [showNewProblemModal, setShowNewProblemModal] = useState(false);
  const [showEditProblemModal, setShowEditProblemModal] = useState(false);
  const [problemToEdit, setProblemToEdit] = useState<ProblemWithStudyTime | null>(null);

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

  useEffect(() => {
    loadProblems();
  }, []);

  const loadProblems = async () => {
    try {
      setLoading(true);
      const baseProblems = await invoke<Problem[]>('get_problems');
      
      // For each problem, get its cards, tags and calculate total study time
      const problemsWithStudyTime = await Promise.all(
        baseProblems.map(async (problem) => {
          try {
            const [cards, tags] = await Promise.all([
              invoke<Card[]>('get_cards_for_problem', { problemId: problem.id }),
              invoke<Tag[]>('get_problem_tags', { problemId: problem.id })
            ]);
            
            // Sum up total_duration from all cards for this problem
            const totalStudyTime = cards.reduce((sum, card) => sum + (card.total_duration || 0), 0);
            
            return {
              ...problem,
              totalStudyTime,
              cardCount: cards.length,
              problemTags: tags
            } as ProblemWithStudyTime;
          } catch (err) {
            console.error(`Failed to load data for problem ${problem.id}:`, err);
            return {
              ...problem,
              totalStudyTime: 0,
              cardCount: 0,
              problemTags: []
            } as ProblemWithStudyTime;
          }
        })
      );
      
      setProblems(problemsWithStudyTime);
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

  // Handle card click for navigation
  const handleCardClick = (e: React.MouseEvent, problemId: string) => {
    // Only navigate on left click, not on right click
    if (e.button === 0) {
      e.preventDefault();
      navigate(`/problem/${problemId}`);
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
    <div className="flex-1 overflow-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Track your DSA learning progress
          </p>
        </div>
        
        <button
          onClick={createNewProblem}
          className="flex items-center px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
        >
          <PlusIcon className="h-5 w-5 mr-2" />
          New Problem
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

      {/* Problems Grid */}
      {problems.length === 0 ? (
        <div className="text-center py-12">
          <AcademicCapIcon className="mx-auto h-12 w-12 text-gray-400" />
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
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {problems.map((problem) => (
            <div
              key={problem.id}
              onClick={(e) => handleCardClick(e, problem.id)}
              onContextMenu={(e) => handleRightClick(e, problem.id)}
              className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm border border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 transition-colors group cursor-pointer select-none"
            >
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
                <span className="text-gray-500 dark:text-gray-400">
                  {problem.cardCount} cards • {formatTimeDisplay(problem.totalStudyTime)} studied
                </span>
                <span className="text-primary-500 dark:text-primary-400">
                  Open →
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Context Menu */}
      <ProblemContextMenu
        isOpen={showContextMenu}
        onClose={() => setShowContextMenu(false)}
        onManageTags={handleManageTags}
        onEditProblem={handleEditProblem}
        position={contextMenuPosition}
        problemId={selectedProblemId}
      />

      {/* Tag Modal */}
      <TagModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        onSave={handleTagSave}
        problemId={selectedProblemId}
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
    </div>
  );
}