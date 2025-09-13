import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { XMarkIcon, TagIcon, MagnifyingGlassIcon, ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { CheckIcon } from '@heroicons/react/24/solid';
import { Tag } from '../types';

interface TagFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (selectedTags: Tag[]) => void;
  initialSelectedTags?: Tag[];
}

interface TagWithCount extends Tag {
  problemCount: number;
}

export type TagSortOption = 'name' | 'problemCount' | 'category';
export type TagSortDirection = 'asc' | 'desc';

export default function TagFilterModal({ 
  isOpen, 
  onClose, 
  onApply, 
  initialSelectedTags = [] 
}: TagFilterModalProps) {
  const [availableTags, setAvailableTags] = useState<TagWithCount[]>([]);
  const [selectedTags, setSelectedTags] = useState<Tag[]>(initialSelectedTags);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Sorting state
  const [sortBy, setSortBy] = useState<TagSortOption>('name');
  const [sortDirection, setSortDirection] = useState<TagSortDirection>('asc');

  // Sort tags based on selected criteria
  const sortTags = (tagsToSort: TagWithCount[], sortOption: TagSortOption, direction: TagSortDirection): TagWithCount[] => {
    return [...tagsToSort].sort((a, b) => {
      let comparison = 0;
      
      switch (sortOption) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'problemCount':
          comparison = a.problemCount - b.problemCount;
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          if (comparison === 0) {
            // If categories are the same, sort by name
            comparison = a.name.localeCompare(b.name);
          }
          break;
        default:
          comparison = a.name.localeCompare(b.name);
      }
      
      return direction === 'asc' ? comparison : -comparison;
    });
  };

  // Handle sorting change
  const handleSortChange = (newSortBy: TagSortOption) => {
    const newDirection = newSortBy === sortBy ? (sortDirection === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(newSortBy);
    setSortDirection(newDirection);
  };

  // Filter tags based on search query
  const searchFilteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tag.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Apply sorting to filtered tags
  const sortedAndFilteredTags = sortTags(searchFilteredTags, sortBy, sortDirection);

  // Group sorted tags by category (only for category view)
  const tagsByCategory = sortBy === 'category' 
    ? sortedAndFilteredTags.reduce((acc, tag) => {
        if (!acc[tag.category]) {
          acc[tag.category] = [];
        }
        acc[tag.category].push(tag);
        return acc;
      }, {} as Record<string, TagWithCount[]>)
    : { 'All Tags': sortedAndFilteredTags };

  // Load tags when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTags();
      setSelectedTags(initialSelectedTags);
    } else {
      setSearchQuery('');
      setError(null);
    }
  }, [isOpen, initialSelectedTags]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      // Get all tags
      const allTags = await invoke<Tag[]>('get_all_tags');
      
      // For each tag, count how many problems have it
      const tagsWithCount = await Promise.all(
        allTags.map(async (tag) => {
          try {
            // Get exact problem count for this specific tag
            const problemCount = await invoke<number>('get_problem_count_for_tag', { 
              tagId: tag.id 
            });
            return {
              ...tag,
              problemCount
            } as TagWithCount;
          } catch (error) {
            console.warn(`Failed to count problems for tag ${tag.name}:`, error);
            return {
              ...tag,
              problemCount: 0
            } as TagWithCount;
          }
        })
      );

      // Sort tags by category and then by name
      tagsWithCount.sort((a, b) => {
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        return a.name.localeCompare(b.name);
      });

      setAvailableTags(tagsWithCount);
      setError(null);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load tags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagToggle = (tag: Tag) => {
    setSelectedTags(prev => {
      const isSelected = prev.some(t => t.id === tag.id);
      if (isSelected) {
        return prev.filter(t => t.id !== tag.id);
      } else {
        return [...prev, tag];
      }
    });
  };

  const handleSelectAll = () => {
    if (selectedTags.length === sortedAndFilteredTags.length) {
      // If all filtered tags are selected, deselect all
      setSelectedTags([]);
    } else {
      // Select all filtered tags
      setSelectedTags(sortedAndFilteredTags);
    }
  };

  const handleClear = () => {
    setSelectedTags([]);
  };

  const handleApply = () => {
    onApply(selectedTags);
    onClose();
  };

  const handleClose = () => {
    // Reset to initial state
    setSelectedTags(initialSelectedTags);
    onClose();
  };

  const getCategoryColor = (category: string) => {
    const colors: Record<string, string> = {
      'data-structure': 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      'algorithm': 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      'pattern': 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
      'difficulty': 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
      'technique': 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
      'custom': 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
    };
    return colors[category] || colors.custom;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <TagIcon className="h-6 w-6 text-primary-500 mr-2" />
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Filter by Tags
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <XMarkIcon className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>

        {/* Sorting Controls */}
        <div className="flex items-center justify-center space-x-4 mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">Sort by:</span>
          
          <button
            onClick={() => handleSortChange('name')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortBy === 'name' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Name
            {sortBy === 'name' && (
              sortDirection === 'asc' 
                ? <ChevronUpIcon className="ml-1 h-4 w-4" />
                : <ChevronDownIcon className="ml-1 h-4 w-4" />
            )}
          </button>
          
          <button
            onClick={() => handleSortChange('problemCount')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortBy === 'problemCount' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Problem Count
            {sortBy === 'problemCount' && (
              sortDirection === 'asc' 
                ? <ChevronUpIcon className="ml-1 h-4 w-4" />
                : <ChevronDownIcon className="ml-1 h-4 w-4" />
            )}
          </button>
          
          <button
            onClick={() => handleSortChange('category')}
            className={`flex items-center px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              sortBy === 'category' 
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' 
                : 'text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            Category
            {sortBy === 'category' && (
              sortDirection === 'asc' 
                ? <ChevronUpIcon className="ml-1 h-4 w-4" />
                : <ChevronDownIcon className="ml-1 h-4 w-4" />
            )}
          </button>
        </div>

        {/* Selected count and actions */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600 dark:text-gray-400">
            {selectedTags.length} tag{selectedTags.length !== 1 ? 's' : ''} selected
          </span>
          <div className="flex space-x-2">
            <button
              onClick={handleSelectAll}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              {selectedTags.length === sortedAndFilteredTags.length ? 'Deselect All' : `Select All (${sortedAndFilteredTags.length})`}
            </button>
            <button
              onClick={handleClear}
              className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Clear
            </button>
          </div>
        </div>

        {/* Tags list */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-500 mb-4">{error}</p>
              <button
                onClick={loadTags}
                className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : sortedAndFilteredTags.length === 0 ? (
            <div className="text-center py-8">
              <TagIcon className="mx-auto h-12 w-12 text-gray-400 mb-2" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery ? 'No tags found matching your search.' : 'No tags available.'}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {Object.entries(tagsByCategory).map(([category, tags]) => (
                <div key={category}>
                  {sortBy === 'category' ? (
                    <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 capitalize">
                      {category.replace('-', ' ')} ({tags.length})
                    </h3>
                  ) : (
                    <div className="mb-2" /> 
                  )}
                  <div className="grid grid-cols-1 gap-2">
                    {tags.map((tag) => {
                      const isSelected = selectedTags.some(t => t.id === tag.id);
                      return (
                        <div
                          key={tag.id}
                          onClick={() => handleTagToggle(tag)}
                          className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                              : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                          }`}
                        >
                          <div className="flex items-center flex-1">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center mr-3 transition-colors ${
                                isSelected
                                  ? 'bg-primary-500 border-primary-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}
                            >
                              {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-900 dark:text-white mr-2">
                                  {tag.name}
                                </span>
                                <span className={`px-2 py-1 text-xs rounded-full ${getCategoryColor(tag.category)}`}>
                                  {tag.category}
                                </span>
                              </div>
                            </div>
                          </div>
                          <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                            {tag.problemCount} problem{tag.problemCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleApply}
            className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
          >
            Apply Filter ({selectedTags.length})
          </button>
        </div>
      </div>
    </div>
  );
}