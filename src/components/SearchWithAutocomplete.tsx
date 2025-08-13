import React, { useState, useCallback, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { SearchType, SearchWithAutocompleteProps } from '../types';

// Search type configuration
const searchTypeOptions = [
  { value: 'name' as SearchType, label: 'Name', placeholder: 'Search by problem name...' },
  { value: 'topic' as SearchType, label: 'Topic', placeholder: 'Search by topic...' },
  { value: 'tags' as SearchType, label: 'Tags', placeholder: 'Search by tags...' },
];

export default function SearchWithAutocomplete({
  onSearch,
  onSuggestionSelect,
  placeholder,
  className = ''
}: SearchWithAutocompleteProps) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<SearchType>('name');
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Get current search option
  const currentOption = searchTypeOptions.find(opt => opt.value === searchType) || searchTypeOptions[0];
  const currentPlaceholder = placeholder || currentOption.placeholder;

  // Debounced suggestion fetching
  const fetchSuggestions = useCallback(async (searchQuery: string, type: SearchType) => {
    if (searchQuery.length < 1) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      setIsLoading(true);
      // Call backend for suggestions (will implement Tauri command later)
      const results = await invoke<string[]>('get_search_suggestions', {
        query: searchQuery,
        searchType: type
      });
      setSuggestions(results);
      setShowSuggestions(results.length > 0);
    } catch (error) {
      console.error('Failed to fetch suggestions:', error);
      setSuggestions([]);
      setShowSuggestions(false);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Debounce suggestions
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query.trim()) {
        fetchSuggestions(query, searchType);
      } else {
        setSuggestions([]);
        setShowSuggestions(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query, searchType, fetchSuggestions]);

  // Handle search input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);
  };

  // Handle search type change
  const handleSearchTypeChange = (type: SearchType) => {
    console.log('DEBUG SearchWithAutocomplete: handleSearchTypeChange called', { from: searchType, to: type, currentQuery: query });
    setSearchType(type);
    setShowDropdown(false);
    // Clear suggestions when search type changes
    setSuggestions([]);
    setShowSuggestions(false);
    // If there's an existing query, automatically trigger search with new type
    if (query.trim()) {
      console.log('DEBUG SearchWithAutocomplete: Auto-triggering search with new type', { query: query.trim(), type });
      fetchSuggestions(query, type);
      // Trigger search with new type to provide immediate feedback
      onSearch(query.trim(), type);
    } else {
      console.log('DEBUG SearchWithAutocomplete: No query to auto-search with');
    }
  };

  // Handle search submission
  const handleSearch = () => {
    console.log('DEBUG SearchWithAutocomplete: handleSearch called', { query: query.trim(), searchType });
    if (query.trim()) {
      onSearch(query.trim(), searchType);
      setShowSuggestions(false);
    }
  };

  // Handle suggestion selection
  const handleSuggestionSelect = (suggestion: string) => {
    console.log('DEBUG SearchWithAutocomplete: handleSuggestionSelect called', { suggestion, searchType });
    setQuery(suggestion);
    setShowSuggestions(false);
    // Only call onSearch, don't call onSuggestionSelect as it would cause duplicate search
    onSearch(suggestion, searchType);
  };

  // Handle key press events
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  // Handle click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node) &&
          inputRef.current && !inputRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className={`relative max-w-2xl mx-auto ${className}`}>
      <div className="flex items-center bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm">
        {/* Search Type Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => {
              console.log('DEBUG SearchWithAutocomplete: Dropdown button clicked', { currentShowDropdown: showDropdown });
              setShowDropdown(!showDropdown);
            }}
            className="flex items-center px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-medium text-sm rounded-l-lg shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 ease-out focus:outline-none focus:ring-3 focus:ring-blue-400/50 focus:ring-offset-2 dark:focus:ring-offset-gray-800 active:scale-[0.98]"
          >
            {currentOption.label}
            <ChevronDownIcon className={`ml-2 h-4 w-4 transition-transform duration-300 ease-out ${
              showDropdown ? 'rotate-180 scale-110' : 'scale-100'
            }`} />
          </button>

          {/* Dropdown Menu */}
          {showDropdown && (
            <div className="absolute top-full left-0 z-20 w-36 bg-white dark:bg-gray-800 border border-gray-200/50 dark:border-gray-600/50 rounded-lg shadow-2xl mt-2 backdrop-blur-sm animate-in slide-in-from-top-2 fade-in duration-300 overflow-hidden">
              <div className="py-1">
                {searchTypeOptions.map((option, index) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      console.log('DEBUG SearchWithAutocomplete: Dropdown option clicked', { option: option.value, label: option.label });
                      handleSearchTypeChange(option.value);
                    }}
                    className={`w-full px-4 py-3 text-left text-sm font-medium transition-all duration-200 ease-out hover:translate-x-1 ${
                      option.value === searchType
                        ? 'bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/20 text-blue-700 dark:text-blue-300 border-r-2 border-blue-500'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gradient-to-r hover:from-gray-50 hover:to-gray-100 dark:hover:from-gray-700/50 dark:hover:to-gray-600/50'
                    } ${index === 0 ? 'rounded-t-lg' : ''} ${index === searchTypeOptions.length - 1 ? 'rounded-b-lg' : ''}`}
                  >
                    <span className="flex items-center">
                      {option.label}
                      {option.value === searchType && (
                        <div className="ml-auto w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Search Input */}
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            onFocus={() => {
              if (suggestions.length > 0) {
                setShowSuggestions(true);
              }
            }}
            placeholder={currentPlaceholder}
            className="w-full px-4 py-3 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 bg-transparent border-0 focus:outline-none focus:ring-0"
          />

          {/* Loading indicator */}
          {isLoading && (
            <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
            </div>
          )}
        </div>

        {/* Search Button */}
        <button
          onClick={handleSearch}
          disabled={!query.trim()}
          className="px-4 py-3 text-gray-400 hover:text-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors focus:outline-none focus:text-blue-500"
        >
          <MagnifyingGlassIcon className="h-5 w-5" />
        </button>
      </div>

      {/* Suggestions Dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={suggestionsRef}
          className="absolute top-full left-0 right-0 z-30 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg mt-1 max-h-64 overflow-y-auto"
        >
          {suggestions.map((suggestion, index) => (
            <button
              key={index}
              onClick={() => handleSuggestionSelect(suggestion)}
              className="w-full px-4 py-2 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors focus:outline-none focus:bg-gray-100 dark:focus:bg-gray-700"
            >
              <span className="font-medium">{suggestion}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}