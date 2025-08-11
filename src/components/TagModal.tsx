import { useState, useEffect, useRef, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { XMarkIcon, TagIcon } from '@heroicons/react/24/outline';
import { Tag, TagModalProps, AddProblemTagRequest, RemoveProblemTagRequest } from '../types';

export default function TagModal({ isOpen, onClose, onSave, problemId }: TagModalProps) {
  const [currentTags, setCurrentTags] = useState<Tag[]>([]);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<NodeJS.Timeout>();

  // Load tags when modal opens
  useEffect(() => {
    if (isOpen) {
      loadTags();
      // Focus input after modal animation
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    } else {
      // Reset state when modal closes
      setInputValue('');
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      setError(null);
    }
  }, [isOpen]);

  const loadTags = async () => {
    setIsLoading(true);
    try {
      const [problemTags, allTagsData] = await Promise.all([
        invoke<Tag[]>('get_problem_tags', { problemId }),
        invoke<Tag[]>('get_all_tags')
      ]);
      
      setCurrentTags(problemTags);
      setAllTags(allTagsData);
      setError(null);
    } catch (err) {
      setError(err as string);
      console.error('Failed to load tags:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Debounced suggestion fetching
  const debouncedFetchSuggestions = useCallback((query: string) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(query);
    }, 150);
  }, []);

  const fetchSuggestions = useCallback(async (query: string) => {
    if (query.length < 1) {
      // Show available tags when input is empty
      const availableTags = allTags
        .filter(tag => !currentTags.some(currentTag => currentTag.name === tag.name))
        .map(tag => tag.name)
        .slice(0, 10);
      setSuggestions(availableTags);
      setShowSuggestions(true);
      return;
    }

    try {
      const results = await invoke<string[]>('get_tag_suggestions', {
        query,
        limit: 10
      });

      // Filter results to exclude already selected tags and the current input
      const filteredResults = results.filter(suggestion => 
        suggestion !== query && 
        !currentTags.some(tag => tag.name.toLowerCase() === suggestion.toLowerCase())
      );

      setSuggestions(filteredResults);
      setShowSuggestions(filteredResults.length > 0 || query.length > 0);
      setSelectedSuggestionIndex(-1);
    } catch (err) {
      console.error('Failed to fetch suggestions:', err);
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [allTags, currentTags]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputValue(value);
    debouncedFetchSuggestions(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (showSuggestions && suggestions.length > 0) {
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
      } else {
        handleClose();
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (showSuggestions && suggestions.length > 0 && selectedSuggestionIndex >= 0) {
        const selectedSuggestion = suggestions[selectedSuggestionIndex];
        addTag(selectedSuggestion);
      } else {
        const customTag = inputValue.trim();
        if (customTag) {
          addTag(customTag);
        }
      }
      return;
    }

    // Arrow key navigation
    if (showSuggestions && suggestions.length > 0) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => 
            prev < suggestions.length - 1 ? prev + 1 : prev
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedSuggestionIndex(prev => prev > 0 ? prev - 1 : -1);
          break;
      }
    }
  };

  const addTag = async (tagName: string) => {
    if (!tagName.trim() || currentTags.some(tag => tag.name.toLowerCase() === tagName.toLowerCase())) {
      return;
    }

    try {
      const request: AddProblemTagRequest = {
        problem_id: problemId,
        tag_name: tagName.trim(),
        category: 'custom'
      };

      const newTag = await invoke<Tag>('add_problem_tag', { request });
      
      setCurrentTags(prev => [...prev, newTag]);
      setInputValue('');
      setSuggestions([]);
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
      
      // Refresh all tags
      const updatedAllTags = await invoke<Tag[]>('get_all_tags');
      setAllTags(updatedAllTags);
    } catch (err) {
      setError(err as string);
      console.error('Failed to add tag:', err);
    }
  };

  const removeTag = async (tag: Tag) => {
    try {
      const request: RemoveProblemTagRequest = {
        problem_id: problemId,
        tag_id: tag.id
      };

      await invoke('remove_problem_tag', { request });
      
      setCurrentTags(prev => prev.filter(t => t.id !== tag.id));
    } catch (err) {
      setError(err as string);
      console.error('Failed to remove tag:', err);
    }
  };

  const handleClose = () => {
    onClose();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onSave(currentTags);
      onClose();
    } catch (err) {
      setError(err as string);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <TagIcon className="h-5 w-5" />
            Manage Tags
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-100 dark:bg-red-900 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-200 rounded-md text-sm">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
          ) : (
            <>
              {/* Current tags */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Current Tags
                </label>
                <div className="flex flex-wrap gap-2 min-h-[2.5rem] p-2 border border-gray-300 dark:border-gray-600 rounded-md bg-gray-50 dark:bg-gray-700">
                  {currentTags.length === 0 ? (
                    <span className="text-gray-500 dark:text-gray-400 text-sm">No tags assigned</span>
                  ) : (
                    currentTags.map((tag) => (
                      <span
                        key={tag.id}
                        className="inline-flex items-center gap-1 px-2 py-1 bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200 text-sm rounded-full"
                      >
                        {tag.name}
                        <button
                          onClick={() => removeTag(tag)}
                          className="text-primary-600 dark:text-primary-400 hover:text-primary-800 dark:hover:text-primary-200"
                        >
                          <XMarkIcon className="h-3 w-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Tag input */}
              <div className="relative">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Add New Tag
                </label>
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={handleInputChange}
                  onKeyDown={handleKeyDown}
                  placeholder="Type to search or create a tag..."
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                />
                
                {/* Suggestions dropdown */}
                {showSuggestions && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-y-auto">
                    {suggestions.length > 0 ? (
                      suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion}
                          onClick={() => addTag(suggestion)}
                          className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 ${
                            index === selectedSuggestionIndex
                              ? 'bg-primary-100 dark:bg-primary-900 text-primary-800 dark:text-primary-200'
                              : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          {suggestion}
                        </button>
                      ))
                    ) : inputValue.trim() ? (
                      <button
                        onClick={() => addTag(inputValue)}
                        className="w-full px-3 py-2 text-left text-sm text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        Create "{inputValue.trim()}"
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-primary-500 text-white text-sm font-medium rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isSaving && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
            )}
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}