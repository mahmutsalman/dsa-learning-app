import { ChevronDownIcon } from '@heroicons/react/24/outline';

export interface Language {
  value: string;
  label: string;
  extension: string;
}

export const SUPPORTED_LANGUAGES: Language[] = [
  { value: 'java', label: 'Java', extension: '.java' },
  { value: 'javascript', label: 'JavaScript', extension: '.js' },
  { value: 'typescript', label: 'TypeScript', extension: '.ts' },
  { value: 'python', label: 'Python', extension: '.py' },
  { value: 'cpp', label: 'C++', extension: '.cpp' },
  { value: 'c', label: 'C', extension: '.c' },
  { value: 'csharp', label: 'C#', extension: '.cs' },
  { value: 'go', label: 'Go', extension: '.go' },
  { value: 'rust', label: 'Rust', extension: '.rs' },
  { value: 'php', label: 'PHP', extension: '.php' },
  { value: 'ruby', label: 'Ruby', extension: '.rb' },
  { value: 'swift', label: 'Swift', extension: '.swift' },
  { value: 'kotlin', label: 'Kotlin', extension: '.kt' }
];

export interface LanguageSelectorProps {
  value: string;
  onChange: (language: string) => void;
  className?: string;
  disabled?: boolean;
}

export function LanguageSelector({
  value,
  onChange,
  className = '',
  disabled = false
}: LanguageSelectorProps) {
  const selectedLanguage = SUPPORTED_LANGUAGES.find(lang => lang.value === value) || SUPPORTED_LANGUAGES[0];

  return (
    <div className={`relative ${className}`}>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className={`
          appearance-none bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600
          text-gray-900 dark:text-gray-100 text-sm rounded-lg
          focus:ring-primary-500 focus:border-primary-500 block w-full px-3 py-2 pr-8
          disabled:bg-gray-100 disabled:dark:bg-gray-800 disabled:opacity-50
          transition-colors duration-200
        `}
      >
        {SUPPORTED_LANGUAGES.map((language) => (
          <option key={language.value} value={language.value}>
            {language.label}
          </option>
        ))}
      </select>
      
      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
        <ChevronDownIcon className="h-4 w-4" />
      </div>
      
      <div className="absolute -bottom-6 left-0 text-xs text-gray-500 dark:text-gray-400">
        {selectedLanguage.extension}
      </div>
    </div>
  );
}
