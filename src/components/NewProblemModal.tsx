import { useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { XMarkIcon, PlusIcon, TrashIcon } from '@heroicons/react/24/outline';
import { CreateProblemRequest, UpdateProblemRequest, Problem, Difficulty } from '../types';

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
  hints: ['']
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
               typeof problem.hints === 'string' ? JSON.parse(problem.hints) : ['']
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
          hints: formData.hints.filter(h => h.trim())
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
          hints: formData.hints.filter(h => h.trim())
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
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading}
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
  );
}