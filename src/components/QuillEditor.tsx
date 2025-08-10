import { useRef, useEffect, useCallback } from 'react';

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
  const quillRef = useRef<any>(null);
  const isUpdatingRef = useRef(false);
  const isInitializedRef = useRef(false);
  const initializationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Stable callback references to avoid useEffect re-runs
  const stableOnChange = useCallback((newValue: string) => {
    onChange(newValue);
  }, [onChange]);

  const stableOnSave = useCallback(() => {
    onSave();
  }, [onSave]);

  // Comprehensive cleanup function
  const cleanupQuill = useCallback(() => {
    console.debug('QuillEditor: Starting cleanup');
    
    // Clear any pending initialization timeouts
    if (initializationTimeoutRef.current) {
      clearTimeout(initializationTimeoutRef.current);
      initializationTimeoutRef.current = null;
    }

    // Clean up Quill instance
    if (quillRef.current) {
      try {
        // Remove all event listeners
        quillRef.current.off('text-change');
        quillRef.current = null;
      } catch (err) {
        console.warn('QuillEditor: Error during Quill instance cleanup:', err);
      }
    }

    // Aggressive DOM cleanup
    if (containerRef.current) {
      const container = containerRef.current;
      
      // Remove all Quill-generated elements
      const toolbars = container.querySelectorAll('.ql-toolbar');
      const containers = container.querySelectorAll('.ql-container');
      const editors = container.querySelectorAll('.ql-editor');

      [...toolbars, ...containers, ...editors].forEach(element => {
        try {
          element.remove();
        } catch (err) {
          console.warn('QuillEditor: Error removing element:', err);
        }
      });

      // Clear all content and classes
      container.innerHTML = '';
      container.className = container.className
        .split(' ')
        .filter(cls => !cls.startsWith('ql-'))
        .join(' ');

      // Remove data attributes
      container.removeAttribute('data-quill-initialized');
      container.removeAttribute('data-quill-id');

      // Also check parent for orphaned toolbars (React StrictMode edge case)
      const parent = container.parentElement;
      if (parent) {
        const orphanedToolbars = parent.querySelectorAll('.ql-toolbar');
        orphanedToolbars.forEach(toolbar => {
          // Only remove toolbars that don't belong to other Quill instances
          if (!parent.querySelector('.ql-container') || 
              !toolbar.nextElementSibling?.classList.contains('ql-container')) {
            console.debug('QuillEditor: Removing orphaned toolbar');
            toolbar.remove();
          }
        });
      }
    }

    // Reset flags
    isInitializedRef.current = false;
    isUpdatingRef.current = false;
    
    console.debug('QuillEditor: Cleanup completed');
  }, []);

  // Initialize Quill with comprehensive guards
  const initializeQuill = useCallback(() => {
    console.debug('QuillEditor: Attempting initialization');

    // Guard: Check if already initialized
    if (isInitializedRef.current || quillRef.current) {
      console.debug('QuillEditor: Already initialized, skipping');
      return;
    }

    // Guard: Check container exists
    if (!containerRef.current) {
      console.debug('QuillEditor: Container not available, skipping');
      return;
    }

    // Guard: Check if Quill is available globally
    if (typeof window === 'undefined' || !(window as any).Quill) {
      console.error('QuillEditor: Quill library not loaded!');
      return;
    }

    // Guard: Check if container already has Quill elements
    const existingQuillElements = containerRef.current.querySelectorAll('.ql-toolbar, .ql-container');
    if (existingQuillElements.length > 0) {
      console.warn('QuillEditor: Found existing Quill elements, cleaning up first');
      cleanupQuill();
      // Wait a bit for cleanup to complete
      setTimeout(() => initializeQuill(), 50);
      return;
    }

    // Guard: Check if already marked as initialized
    if (containerRef.current.getAttribute('data-quill-initialized') === 'true') {
      console.debug('QuillEditor: Container already marked as initialized, skipping');
      return;
    }

    try {
      console.debug('QuillEditor: Starting Quill initialization');
      isInitializedRef.current = true;

      // Mark container as being initialized
      containerRef.current.setAttribute('data-quill-initialized', 'true');
      containerRef.current.setAttribute('data-quill-id', Date.now().toString());

      // Clear container content
      containerRef.current.innerHTML = '';

      // Initialize Quill
      const Quill = (window as any).Quill;
      const quill = new Quill(containerRef.current, {
        theme: 'snow',
        placeholder,
        modules: {
          toolbar: [
            [{ 'header': [1, 2, 3, false] }],
            ['bold', 'italic', 'underline', 'strike'],
            [{ 'list': 'ordered'}, { 'list': 'bullet' }],
            ['blockquote', 'code-block'],
            ['link'],
            [{ 'color': [] }, { 'background': [] }],
            ['clean']
          ]
        }
      });

      quillRef.current = quill;

      // Set initial content
      if (value) {
        isUpdatingRef.current = true;
        quill.root.innerHTML = value;
        isUpdatingRef.current = false;
      }

      // Handle content changes
      quill.on('text-change', () => {
        if (isUpdatingRef.current) return;
        
        const html = quill.root.innerHTML;
        const isEmpty = html === '<p><br></p>' || html === '<p></p>' || !html.trim();
        stableOnChange(isEmpty ? '' : html);
      });

      // Add keyboard shortcuts
      quill.keyboard.addBinding({
        key: 'S',
        ctrlKey: true
      }, () => {
        stableOnSave();
        return false;
      });

      quill.keyboard.addBinding({
        key: 'S',
        metaKey: true
      }, () => {
        stableOnSave();
        return false;
      });

      console.debug('QuillEditor: Initialization completed successfully');

    } catch (error) {
      console.error('QuillEditor: Failed to initialize:', error);
      // Reset flags on error so it can be retried
      isInitializedRef.current = false;
      if (containerRef.current) {
        containerRef.current.removeAttribute('data-quill-initialized');
      }
    }
  }, [placeholder, stableOnChange, stableOnSave, cleanupQuill]);

  // Main initialization effect - only depends on placeholder
  useEffect(() => {
    console.debug('QuillEditor: Mount/placeholder change effect triggered');
    
    // Clean up any existing instance first
    cleanupQuill();

    // Debounce initialization to handle React StrictMode double mounting
    initializationTimeoutRef.current = setTimeout(() => {
      initializeQuill();
    }, 100);

    // Cleanup function
    return () => {
      console.debug('QuillEditor: Component unmounting or placeholder changed');
      cleanupQuill();
    };
  }, [placeholder]); // Only depend on placeholder, not functions

  // Update content when value changes
  useEffect(() => {
    if (!quillRef.current || isUpdatingRef.current) return;
    
    const currentContent = quillRef.current.root.innerHTML;
    if (value !== currentContent) {
      console.debug('QuillEditor: Updating content externally');
      isUpdatingRef.current = true;
      
      if (!value || value.trim() === '') {
        quillRef.current.setText('');
      } else {
        quillRef.current.root.innerHTML = value;
      }
      
      isUpdatingRef.current = false;
    }
  }, [value]);

  return (
    <div className={`quill-editor-wrapper ${className} ${theme === 'dark' ? 'quill-dark' : 'quill-light'}`}>
      <div 
        ref={containerRef}
        style={{ height: '300px' }}
      />
    </div>
  );
}