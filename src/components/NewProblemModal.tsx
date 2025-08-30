import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { XMarkIcon, PlusIcon, TrashIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { CreateProblemRequest, UpdateProblemRequest, Problem, Difficulty } from '../types';
import ProblemAutocomplete from './ProblemAutocomplete';

interface NewProblemModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (problem: Problem) => void;
  editMode?: boolean;
  existingProblem?: Problem;
}

interface FormData {
  title: string;
  description: string;
  difficulty: Difficulty;
  topic: string[];
  leetcodeUrl: string;
  constraints: string[];
  hints: string[];
  relatedProblems: Problem[];
}

interface FormErrors {
  title?: string;
  description?: string;
  difficulty?: string;
  topic?: string;
}

const initialFormData: FormData = {
  title: '',
  description: '',
  difficulty: 'Easy',
  topic: [],
  leetcodeUrl: '',
  constraints: [''],
  hints: [''],
  relatedProblems: []
};

export default function NewProblemModal({ 
  isOpen, 
  onClose, 
  onSave, 
  editMode = false, 
  existingProblem 
}: NewProblemModalProps) {
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [topicInput, setTopicInput] = useState('');
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const titleInputRef = useRef<HTMLInputElement>(null);

  // Helper function to parse existing problem data
  const parseExistingProblem = (problem: Problem): FormData => {
    try {
      return {
        title: problem.title || '',
        description: problem.description || '',
        difficulty: problem.difficulty as Difficulty || 'Easy',
        topic: Array.isArray(problem.topic) ? problem.topic : 
                  typeof problem.topic === 'string' ? JSON.parse(problem.topic) : [],
        leetcodeUrl: problem.leetcode_url || '',
        constraints: Array.isArray(problem.constraints) ? problem.constraints :
                     typeof problem.constraints === 'string' ? JSON.parse(problem.constraints) : [''],
        hints: Array.isArray(problem.hints) ? problem.hints :
               typeof problem.hints === 'string' ? JSON.parse(problem.hints) : [''],
        relatedProblems: [] // Will be loaded separately if needed
      };
    } catch (error) {
      console.error('Error parsing existing problem:', error);
      return initialFormData;
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (editMode && existingProblem) {
        // Populate form with existing problem data
        const parsedData = parseExistingProblem(existingProblem);
        setFormData(parsedData);
      } else {
        // Reset form when creating new problem
        setFormData(initialFormData);
      }
      
      setErrors({});
      setTopicInput('');
      
      // Focus title input after modal animation
      setTimeout(() => {
        titleInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen, editMode, existingProblem]);

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.title.trim()) {
      newErrors.title = 'Title is required';
    }

    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }

    if (formData.topic.length === 0) {
      newErrors.topic = 'At least one topic is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsLoading(true);

    try {
      if (editMode && existingProblem) {
        // Update existing problem
        const updateRequest: UpdateProblemRequest = {
          id: existingProblem.id,
          title: formData.title.trim(),
          description: formData.description.trim(),
          difficulty: formData.difficulty,
          topic: formData.topic,
          leetcode_url: formData.leetcodeUrl.trim() || undefined,
          constraints: formData.constraints.filter(c => c.trim()),
          hints: formData.hints.filter(h => h.trim()),
          related_problem_ids: formData.relatedProblems.map(p => p.id)
        };

        const updatedProblem = await invoke<Problem>('update_problem', { request: updateRequest });
        onSave(updatedProblem);
      } else {
        // Create new problem
        const createRequest: CreateProblemRequest = {
          title: formData.title.trim(),
          description: formData.description.trim(),
          difficulty: formData.difficulty,
          topic: formData.topic,
          leetcode_url: formData.leetcodeUrl.trim() || undefined,
          constraints: formData.constraints.filter(c => c.trim()),
          hints: formData.hints.filter(h => h.trim()),
          related_problem_ids: formData.relatedProblems.map(p => p.id)
        };

        const newProblem = await invoke<Problem>('create_problem', { request: createRequest });
        onSave(newProblem);
      }
      
      onClose();
    } catch (error) {
      console.error(`Failed to ${editMode ? 'update' : 'create'} problem:`, error);
      // You could add a toast notification here
    } finally {
      setIsLoading(false);
    }
  };

  const addTopic = () => {
    if (topicInput.trim() && !formData.topic.includes(topicInput.trim())) {
      setFormData(prev => ({
        ...prev,
        topic: [...prev.topic, topicInput.trim()]
      }));
      setTopicInput('');
    }
  };

  const removeTopic = (index: number) => {
    setFormData(prev => ({
      ...prev,
      topic: prev.topic.filter((_, i) => i !== index)
    }));
  };

  const addArrayItem = (field: 'constraints' | 'hints') => {
    setFormData(prev => ({
      ...prev,
      [field]: [...prev[field], '']
    }));
  };

  const updateArrayItem = (field: 'constraints' | 'hints', index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].map((item, i) => i === index ? value : item)
    }));
  };

  const removeArrayItem = (field: 'constraints' | 'hints', index: number) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].filter((_, i) => i !== index)
    }));
  };

  // Helper functions for managing related problems
  const addRelatedProblem = (problem: Problem) => {
    // Check if the problem is already in the list
    if (!formData.relatedProblems.some(p => p.id === problem.id)) {
      setFormData(prev => ({
        ...prev,
        relatedProblems: [...prev.relatedProblems, problem]
      }));
    }
  };

  const removeRelatedProblem = (problemId: string) => {
    setFormData(prev => ({
      ...prev,
      relatedProblems: prev.relatedProblems.filter(p => p.id !== problemId)
    }));
  };

  const handleDeleteProblem = async () => {
    if (!existingProblem) return;
    
    setIsDeleting(true);
    try {
      await invoke<string>('delete_problem', { id: existingProblem.id });
      console.log('Problem deleted successfully');
      
      // Close confirmation dialog and main modal
      setShowDeleteConfirmation(false);
      onClose();
      
      // Refresh the parent component (this will be handled by onSave callback)
      onSave(existingProblem);
    } catch (error) {
      console.error('Failed to delete problem:', error);
      // You could add toast notification here
      alert('Failed to delete problem: ' + (error as string));
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {editMode ? 'Edit Problem' : 'Create New Problem'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Form Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-140px)]">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Title *
              </label>
              <input
                ref={titleInputRef}
                type="text"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white ${
                  errors.title ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Enter problem title"
              />
              {errors.title && (
                <p className="mt-1 text-sm text-red-600">{errors.title}</p>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description *
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                rows={4}
                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none ${
                  errors.description ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="Describe the problem..."
              />
              {errors.description && (
                <p className="mt-1 text-sm text-red-600">{errors.description}</p>
              )}
            </div>

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Difficulty *
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) => setFormData(prev => ({ ...prev, difficulty: e.target.value as Difficulty }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
              >
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            {/* Topic */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Topics *
              </label>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={topicInput}
                  onChange={(e) => setTopicInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addTopic();
                    }
                  }}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  placeholder="Add topic (e.g., Array, Dynamic Programming)"
                />
                <button
                  type="button"
                  onClick={addTopic}
                  className="px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                >
                  <PlusIcon className="h-5 w-5" />
                </button>
              </div>
              
              {formData.topic.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {formData.topic.map((cat, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 text-sm rounded-full"
                    >
                      {cat}
                      <button
                        type="button"
                        onClick={() => removeTopic(index)}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-200"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
              
              {errors.topic && (
                <p className="mt-1 text-sm text-red-600">{errors.topic}</p>
              )}
            </div>

            {/* LeetCode URL */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                LeetCode URL
              </label>
              <input
                type="url"
                value={formData.leetcodeUrl}
                onChange={(e) => setFormData(prev => ({ ...prev, leetcodeUrl: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                placeholder="https://leetcode.com/problems/..."
              />
            </div>


            {/* Constraints */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Constraints
                </label>
                <button
                  type="button"
                  onClick={() => addArrayItem('constraints')}
                  className="text-primary-500 hover:text-primary-600 text-sm flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Constraint
                </button>
              </div>

              {formData.constraints.map((constraint, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={constraint}
                    onChange={(e) => updateArrayItem('constraints', index, e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    placeholder="Enter constraint"
                  />
                  {formData.constraints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('constraints', index)}
                      className="px-3 py-2 text-red-500 hover:text-red-600"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Hints */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Hints
                </label>
                <button
                  type="button"
                  onClick={() => addArrayItem('hints')}
                  className="text-primary-500 hover:text-primary-600 text-sm flex items-center gap-1"
                >
                  <PlusIcon className="h-4 w-4" />
                  Add Hint
                </button>
              </div>

              {formData.hints.map((hint, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <textarea
                    value={hint}
                    onChange={(e) => updateArrayItem('hints', index, e.target.value)}
                    rows={2}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white resize-none"
                    placeholder="Enter hint"
                  />
                  {formData.hints.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeArrayItem('hints', index)}
                      className="px-3 py-2 text-red-500 hover:text-red-600 self-start"
                    >
                      <TrashIcon className="h-5 w-5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Related Problems */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Related Problems
                </label>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  Connect to related problems
                </span>
              </div>

              {/* Add Related Problem */}
              <div className="mb-4">
                <ProblemAutocomplete
                  onSelect={addRelatedProblem}
                  excludeId={editMode && existingProblem ? existingProblem.id : undefined}
                  placeholder="Search for problems to connect..."
                  className="w-full"
                />
              </div>

              {/* Selected Related Problems */}
              {formData.relatedProblems.length > 0 && (
                <div className="space-y-2">
                  {formData.relatedProblems.map((problem) => (
                    <div
                      key={problem.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg"
                    >
                      <div className="flex-1 min-w-0 mr-3">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {problem.title}
                          </h5>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            problem.difficulty === 'Easy' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            problem.difficulty === 'Medium' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            problem.difficulty === 'Hard' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {problem.difficulty}
                          </span>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-1">
                          {problem.description}
                        </p>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => removeRelatedProblem(problem.id)}
                        className="p-1.5 text-gray-500 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                        title="Remove connection"
                      >
                        <XMarkIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          {/* Delete button - only show in edit mode */}
          <div className="flex-1">
            {editMode && existingProblem && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirmation(true)}
                disabled={isLoading || isDeleting}
                className="px-4 py-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <TrashIcon className="h-4 w-4" />
                Delete Problem
              </button>
            )}
          </div>
          
          {/* Cancel and Save buttons */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isDeleting}
              className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || isDeleting}
              className="px-6 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  {editMode ? 'Updating...' : 'Creating...'}
                </>
              ) : (
                editMode ? 'Update Problem' : 'Create Problem'
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
            {/* Confirmation Header */}
            <div className="flex items-center gap-3 p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex-shrink-0">
                <ExclamationTriangleIcon className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Delete Problem
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  This action cannot be undone
                </p>
              </div>
            </div>

            {/* Confirmation Content */}
            <div className="p-6">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Are you sure you want to delete <span className="font-semibold">"{existingProblem?.title}"</span>?
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                This will permanently delete:
              </p>
              <ul className="text-sm text-gray-600 dark:text-gray-400 mt-2 ml-4 space-y-1">
                <li>• The problem and its description</li>
                <li>• All solution cards and code</li>
                <li>• All time tracking sessions</li>
                <li>• All audio recordings</li>
                <li>• All problem images</li>
                <li>• All tags and connections</li>
              </ul>
            </div>

            {/* Confirmation Footer */}
            <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={() => setShowDeleteConfirmation(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteProblem}
                disabled={isDeleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Deleting...
                  </>
                ) : (
                  <>
                    <TrashIcon className="h-4 w-4" />
                    Delete Problem
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}