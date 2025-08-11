import { useState, useCallback, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { 
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowTopRightOnSquareIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon
} from '@heroicons/react/24/outline';
import { useEnhancedWorkspaceLayoutOptional } from './workspace/EnhancedWorkspaceContext';
import { useAppSidebarOptional } from '../contexts/AppLayoutContext';
import ImageThumbnails from './ImageThumbnails';

export interface EnhancedProblemDescriptionPanelProps {
  problem: {
    id: string;
    title: string;
    description: string;
    leetcode_url?: string;
  } | null;
  onDescriptionUpdate?: (problemId: string, newDescription: string) => Promise<boolean>;
  className?: string;
}

// Collapsed state is handled by panel constraints (min size)
// const COLLAPSED_MIN_SIZE = 3; // 3% minimum for collapsed state (about 48px on 1600px screen)
// const EXPANDED_MIN_SIZE = 15; // 15% minimum for expanded state

export default function EnhancedProblemDescriptionPanel({ 
  problem,
  onDescriptionUpdate,
  className = ''
}: EnhancedProblemDescriptionPanelProps) {
  // Smart context usage - prioritize workspace context when available (for ProblemCard pages)
  // Fall back to app context only when no workspace context exists (for Dashboard page)
  const workspaceContext = useEnhancedWorkspaceLayoutOptional();
  const appSidebar = useAppSidebarOptional();
  
  // Determine which context to use and extract values
  // IMPORTANT: Prioritize workspace context to ensure Problem Description panel
  // only collapses itself within workspace, not the entire app navigation
  const isCollapsed = workspaceContext?.layout?.isCollapsed?.sidebar ?? appSidebar?.isCollapsed ?? false;
  const toggleSidebar = workspaceContext?.toggleSidebar ?? appSidebar?.toggle ?? (() => {});

  // Edit state management
  const [isEditing, setIsEditing] = useState(false);
  const [editedDescription, setEditedDescription] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Image handling
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [imageRefreshKey, setImageRefreshKey] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Edit handlers
  const startEditing = useCallback(() => {
    if (problem) {
      setEditedDescription(problem.description);
      setIsEditing(true);
      setSaveError(null);
    }
  }, [problem]);

  const cancelEditing = useCallback(() => {
    setIsEditing(false);
    setEditedDescription('');
    setSaveError(null);
  }, []);

  const saveDescription = useCallback(async () => {
    if (!problem || !onDescriptionUpdate || editedDescription.trim() === '') {
      return;
    }

    try {
      setIsSaving(true);
      setSaveError(null);
      
      const success = await onDescriptionUpdate(problem.id, editedDescription.trim());
      
      if (success) {
        setIsEditing(false);
        setEditedDescription('');
      } else {
        setSaveError('Failed to update description');
      }
    } catch (error) {
      console.error('Error saving description:', error);
      setSaveError('Failed to update description');
    } finally {
      setIsSaving(false);
    }
  }, [problem, onDescriptionUpdate, editedDescription]);

  // Image paste handler
  const handlePaste = useCallback(async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!problem) return;

    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith('image/'));
    
    if (imageItem) {
      e.preventDefault();
      setIsUploadingImage(true);
      
      try {
        const file = imageItem.getAsFile();
        if (!file) return;
        
        // Convert to base64
        const reader = new FileReader();
        reader.onload = async (event) => {
          try {
            const base64Data = event.target?.result as string;
            
            await invoke('save_problem_image', {
              request: {
                problem_id: problem.id,
                image_data: base64Data,
                caption: null,
                position: null,
              }
            });
            
            // Refresh the images display
            setImageRefreshKey(prev => prev + 1);
            
            // Show success feedback briefly
            const originalPlaceholder = textareaRef.current?.placeholder || '';
            if (textareaRef.current) {
              textareaRef.current.placeholder = 'Image uploaded successfully!';
              setTimeout(() => {
                if (textareaRef.current) {
                  textareaRef.current.placeholder = originalPlaceholder;
                }
              }, 2000);
            }
          } catch (error) {
            console.error('Failed to save image:', error);
            alert('Failed to upload image');
          } finally {
            setIsUploadingImage(false);
          }
        };
        
        reader.readAsDataURL(file);
      } catch (error) {
        console.error('Error handling image paste:', error);
        setIsUploadingImage(false);
      }
    }
  }, [problem]);

  // Toggle collapse/expand
  const handleToggle = useCallback(() => {
    toggleSidebar();
  }, [toggleSidebar]);

  if (!problem) {
    return (
      <div className={`enhanced-problem-panel ${className} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out group relative h-full`}>
        <div className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-4 border-b border-gray-200 dark:border-gray-700 min-h-[73px]`}>
          {!isCollapsed && (
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-opacity duration-300">
              Problem Description
            </h2>
          )}
          <button
            onClick={handleToggle}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            title={isCollapsed ? 'Expand problem panel' : 'Collapse problem panel'}
          >
            {isCollapsed ? (
              <ChevronRightIcon className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronLeftIcon className="h-4 w-4 text-gray-500" />
            )}
          </button>
        </div>
        
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="text-center">
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {isCollapsed ? '' : 'No problem selected'}
            </p>
          </div>
        </div>

        {/* Collapsed State Tooltip */}
        {isCollapsed && (
          <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 top-4 shadow-lg">
            <div className="font-medium">No Problem</div>
            <div className="text-xs text-gray-300 mt-1">Click to expand</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`enhanced-problem-panel ${className} bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col transition-all duration-300 ease-in-out group relative h-full`}>
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center px-2' : 'justify-between px-3'} py-4 border-b border-gray-200 dark:border-gray-700 min-h-[73px]`}>
        {!isCollapsed && (
          <div className="flex items-center flex-1 min-w-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white transition-opacity duration-300 truncate">
              Problem Description
            </h2>
            {/* Edit Button - Only show if onDescriptionUpdate is provided and not editing */}
            {onDescriptionUpdate && !isEditing && (
              <button
                onClick={startEditing}
                className="ml-2 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex-shrink-0"
                title="Edit description"
              >
                <PencilIcon className="h-4 w-4" />
              </button>
            )}
            {/* Edit Mode Controls */}
            {isEditing && (
              <div className="ml-2 flex items-center space-x-1 flex-shrink-0">
                <button
                  onClick={saveDescription}
                  disabled={isSaving || editedDescription.trim() === ''}
                  className="p-1 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/20 transition-colors text-green-600 dark:text-green-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Save changes"
                >
                  <CheckIcon className="h-4 w-4" />
                </button>
                <button
                  onClick={cancelEditing}
                  disabled={isSaving}
                  className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/20 transition-colors text-red-600 dark:text-red-400 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="Cancel editing"
                >
                  <XMarkIcon className="h-4 w-4" />
                </button>
              </div>
            )}
            {/* Save status indicator */}
            {isSaving && (
              <div className="ml-2 flex items-center text-blue-600 dark:text-blue-400 flex-shrink-0">
                <div className="animate-spin rounded-full h-3 w-3 border border-current border-t-transparent"></div>
                <span className="ml-1 text-xs">Saving...</span>
              </div>
            )}
          </div>
        )}
        <button
          onClick={handleToggle}
          className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors flex-shrink-0"
          title={isCollapsed ? 'Expand problem panel' : 'Collapse problem panel'}
        >
          {isCollapsed ? (
            <ChevronRightIcon className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronLeftIcon className="h-4 w-4 text-gray-500" />
          )}
        </button>
      </div>

      {/* Content */}
      <div className={`flex-1 ${isCollapsed ? 'hidden' : 'flex flex-col'} overflow-hidden`}>
        <div className="flex-1 overflow-auto p-3 min-w-0">
          {/* Problem Title */}
          <div className="mb-4">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2 problem-title-responsive break-words">
              {problem.title}
            </h3>
          </div>

          {/* Problem Description - View Mode */}
          {!isEditing && (
            <div className="prose dark:prose-invert max-w-none mb-6 min-w-0">
              <div className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed text-sm problem-description-content break-words">
                {problem.description}
              </div>
            </div>
          )}

          {/* Problem Description - Edit Mode */}
          {isEditing && (
            <div className="mb-6 min-w-0">
              <textarea
                ref={textareaRef}
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onPaste={handlePaste}
                className="w-full h-64 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-gray-300 text-sm resize-none"
                placeholder={isUploadingImage ? "Uploading image..." : "Enter problem description... (Paste images here)"}
                disabled={isUploadingImage}
              />
              {/* Error message */}
              {saveError && (
                <p className="mt-2 text-sm text-red-600 dark:text-red-400">
                  {saveError}
                </p>
              )}
              {/* Character count helper */}
              <div className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                {editedDescription.length} characters
                {isUploadingImage && (
                  <span className="ml-2 text-primary-600">
                    • Uploading image...
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Image Thumbnails - Show always */}
          <ImageThumbnails 
            key={imageRefreshKey}
            problemId={problem.id}
            isEditing={isEditing}
            className="mb-6"
          />
          
          {/* LeetCode Link - Only show when not editing */}
          {!isEditing && problem.leetcode_url && (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-auto">
              <a
                href={problem.leetcode_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
              >
                <ArrowTopRightOnSquareIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                <span className="truncate">View on LeetCode</span>
              </a>
            </div>
          )}
        </div>
      </div>

      {/* Collapsed State Tooltip */}
      {isCollapsed && (
        <div className="absolute left-full ml-2 px-3 py-2 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 top-4 shadow-lg">
          <div className="font-medium truncate max-w-xs">{problem.title}</div>
          <div className="text-xs text-gray-300 mt-1">Click to expand</div>
        </div>
      )}
    </div>
  );
}