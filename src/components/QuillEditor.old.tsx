import { useRef, useEffect } from 'react';
import type Quill from 'quill';

export interface QuillEditorProps {
  value: string;
  theme: 'light' | 'dark';
  onChange: (value: string) => void;
  onSave: () => void;
  placeholder?: string;
  className?: string;
}

export function QuillEditor({
  value,
  theme,
  onChange,
  onSave,
  placeholder = 'Write your notes here...',
  className = ''
}: QuillEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const quillRef = useRef<Quill | null>(null);
  const isUpdating = useRef(false);
  const isInitialized = useRef(false);

  useEffect(() => {
    if (!containerRef.current) return;
    
    // Check if this specific container was already initialized using data attribute
    if (containerRef.current.getAttribute('data-quill-initialized') === 'true') {
      return;
    }
    
    // Check if container already has Quill classes (means it was initialized)
    if (containerRef.current.classList.contains('ql-container')) {
      return;
    }
    
    // Check if Quill is already initialized - look for toolbar in parent
    const parent = containerRef.current.parentElement;
    const existingToolbar = parent?.querySelector('.ql-toolbar');
    
    if (existingToolbar) {
      return;
    }
    
    // Prevent double initialization - set flag immediately
    if (isInitialized.current) {
      return;
    }
    isInitialized.current = true;
    
    // Mark container as being initialized
    containerRef.current.setAttribute('data-quill-initialized', 'true');

    const initQuill = async () => {
      try {
        // Double-check container still exists and isn't already initialized
        if (!containerRef.current || containerRef.current.classList.contains('ql-container')) {
          isInitialized.current = false;
          return;
        }
        
        // Dynamic import of Quill
        const { default: Quill } = await import('quill');
        
        // Final check before initialization
        if (!containerRef.current) {
          isInitialized.current = false;
          return;
        }
        
        // Initialize Quill with simple configuration
        const quill = new Quill(containerRef.current, {
          theme: 'snow',
          placeholder,
          modules: {
            toolbar: [
              ['bold', 'italic', 'underline', 'strike'],
              ['blockquote', 'code-block'],
              [{ 'header': 1 }, { 'header': 2 }],
              [{ 'list': 'ordered'}, { 'list': 'bullet' }],
              [{ 'script': 'sub'}, { 'script': 'super' }],
              [{ 'indent': '-1'}, { 'indent': '+1' }],
              [{ 'direction': 'rtl' }],
              [{ 'size': ['small', false, 'large', 'huge'] }],
              [{ 'header': [1, 2, 3, 4, 5, 6, false] }],
              [{ 'color': [] }, { 'background': [] }],
              [{ 'font': [] }],
              [{ 'align': [] }],
              ['clean'],
              ['link', 'image', 'video']
            ]
          }
        });

        quillRef.current = quill;

        // Set initial content
        if (value) {
          isUpdating.current = true;
          quill.root.innerHTML = value;
          isUpdating.current = false;
        }

        // Handle content changes
        quill.on('text-change', () => {
          if (isUpdating.current) return;
          
          const html = quill.root.innerHTML;
          const isEmpty = html === '<p><br></p>' || html === '<p></p>' || !html.trim();
          onChange(isEmpty ? '' : html);
        });

        // Add save keyboard shortcut
        quill.keyboard.addBinding({
          key: 'S',
          ctrlKey: true
        }, () => {
          onSave();
          return false;
        });

        quill.keyboard.addBinding({
          key: 'S',
          metaKey: true
        }, () => {
          onSave();
          return false;
        });

      } catch (error) {
        // Reset flag on error so it can be retried
        isInitialized.current = false;
      }
    };

    initQuill();

    // Cleanup
    return () => {
      // Clean up Quill instance
      if (quillRef.current) {
        quillRef.current = null;
      }
      
      // Remove toolbar from parent if it exists
      if (containerRef.current) {
        const parent = containerRef.current.parentElement;
        if (parent) {
          const toolbar = parent.querySelector('.ql-toolbar');
          if (toolbar) {
            toolbar.remove();
          }
        }
        
        // Clear the container
        containerRef.current.innerHTML = '';
        // Remove Quill classes from container
        containerRef.current.classList.remove('ql-container', 'ql-snow');
        // Remove initialization marker
        containerRef.current.removeAttribute('data-quill-initialized');
      }
      
      // Reset initialization flag
      isInitialized.current = false;
    };
  }, []); // Only run once on mount

  // Update content when value prop changes
  useEffect(() => {
    if (!quillRef.current || isUpdating.current) return;
    
    const currentContent = quillRef.current.root.innerHTML;
    if (value !== currentContent) {
      isUpdating.current = true;
      
      if (!value || value.trim() === '') {
        quillRef.current.setText('');
      } else {
        quillRef.current.root.innerHTML = value;
      }
      
      isUpdating.current = false;
    }
  }, [value]);

  return (
    <div className={`quill-wrapper ${className}`}>
      <div 
        ref={containerRef}
        className={`quill-container ${theme === 'dark' ? 'quill-dark' : ''}`}
      />
      
      <style>{`
        /* Simple container styles */
        .quill-wrapper {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden; /* Prevent wrapper from expanding */
          min-height: 0; /* Allow wrapper to shrink */
        }
        
        .quill-container {
          height: 100%;
          width: 100%;
          display: flex;
          flex-direction: column;
          position: relative;
          overflow: hidden; /* Prevent container from expanding */
          min-height: 0; /* Allow container to shrink */
        }
        
        /* Fix for React StrictMode double toolbar issue */
        /* Hide the first toolbar if there are multiple */
        .quill-wrapper .ql-toolbar:first-child:not(:last-child) {
          display: none !important;
        }
        
        /* Alternative: If toolbar appears outside wrapper, hide extras */
        .quill-wrapper + .ql-toolbar {
          display: none !important;
        }
        
        /* Let Quill handle its own layout */
        .quill-container .ql-toolbar {
          flex-shrink: 0;
          border-bottom: 1px solid #e5e7eb;
        }
        
        .quill-container .ql-container {
          flex: 1;
          min-height: 0; /* Critical: allows container to not expand with content */
          overflow: hidden; /* Container doesn't scroll, editor does */
          display: flex;
          flex-direction: column;
        }
        
        .quill-container .ql-editor {
          flex: 1;
          overflow-y: auto; /* Editor handles scrolling */
          padding: 12px 15px;
          max-height: 100%; /* Ensure editor doesn't exceed container */
        }
        
        /* Custom scrollbar styling for better visibility */
        .quill-container .ql-editor {
          scrollbar-width: thin;
          scrollbar-color: #6b7280 #f3f4f6;
        }
        
        .quill-container .ql-editor::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        
        .quill-container .ql-editor::-webkit-scrollbar-track {
          background: #f3f4f6;
          border-radius: 4px;
        }
        
        .quill-container .ql-editor::-webkit-scrollbar-thumb {
          background-color: #6b7280;
          border-radius: 4px;
          border: 1px solid #f3f4f6;
        }
        
        .quill-container .ql-editor::-webkit-scrollbar-thumb:hover {
          background-color: #4b5563;
        }
        
        .quill-container .ql-editor::-webkit-scrollbar-corner {
          background: #f3f4f6;
        }
        
        /* Dark theme adjustments */
        .quill-dark .ql-toolbar.ql-snow {
          background: #374151;
          border-color: #4b5563;
        }
        
        /* Dark theme scrollbar */
        .quill-dark .ql-editor {
          scrollbar-color: #4b5563 #1f2937;
        }
        
        .quill-dark .ql-editor::-webkit-scrollbar-track {
          background: #1f2937;
        }
        
        .quill-dark .ql-editor::-webkit-scrollbar-thumb {
          background-color: #4b5563;
          border: 1px solid #1f2937;
        }
        
        .quill-dark .ql-editor::-webkit-scrollbar-thumb:hover {
          background-color: #6b7280;
        }
        
        .quill-dark .ql-editor::-webkit-scrollbar-corner {
          background: #1f2937;
        }
        
        .quill-dark .ql-toolbar.ql-snow .ql-stroke {
          stroke: #d1d5db;
        }
        
        .quill-dark .ql-toolbar.ql-snow .ql-fill {
          fill: #d1d5db;
        }
        
        .quill-dark .ql-toolbar.ql-snow button:hover .ql-stroke {
          stroke: #fff;
        }
        
        .quill-dark .ql-toolbar.ql-snow button:hover .ql-fill {
          fill: #fff;
        }
        
        .quill-dark .ql-toolbar.ql-snow button.ql-active .ql-stroke {
          stroke: #60a5fa;
        }
        
        .quill-dark .ql-toolbar.ql-snow button.ql-active .ql-fill {
          fill: #60a5fa;
        }
        
        .quill-dark .ql-container.ql-snow {
          background: #1f2937;
          border-color: #4b5563;
        }
        
        .quill-dark .ql-editor {
          color: #f3f4f6;
        }
        
        .quill-dark .ql-editor.ql-blank::before {
          color: #9ca3af;
        }
        
        .quill-dark .ql-editor pre.ql-syntax {
          background-color: #111827;
          color: #f3f4f6;
        }
        
        .quill-dark .ql-picker-label {
          color: #d1d5db;
        }
        
        .quill-dark .ql-picker-options {
          background: #374151;
        }
        
        .quill-dark .ql-picker-item {
          color: #d1d5db;
        }
      `}</style>
    </div>
  );
}