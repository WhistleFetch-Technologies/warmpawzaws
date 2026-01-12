import { useState } from 'react';
import { Input } from './input';
import { Button } from './button';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (query: string) => void;
  onClear?: () => void;
  className?: string;
  showClearButton?: boolean;
  autoFocus?: boolean;
}

export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  onClear,
  className = '',
  showClearButton = true,
  autoFocus = false
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleSearch = (value: string) => {
    setQuery(value);
    onSearch(value);
  };

  const handleClear = () => {
    setQuery('');
    onSearch('');
    onClear?.();
  };

  return (
    <div className={`relative flex items-center ${className}`}>
      <div className="absolute left-3 pointer-events-none">
        <Search className="w-4 h-4 text-gray-400" />
      </div>
      
      <Input
        type="text"
        value={query}
        onChange={(e) => handleSearch(e.target.value)}
        placeholder={placeholder}
        className="pl-10 pr-10"
        autoFocus={autoFocus}
      />
      
      {showClearButton && query && (
        <button
          onClick={handleClear}
          className="absolute right-3 p-1 hover:bg-gray-100 rounded-full transition-colors"
          type="button"
        >
          <X className="w-4 h-4 text-gray-400" />
        </button>
      )}
    </div>
  );
}
