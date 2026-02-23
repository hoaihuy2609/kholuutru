import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
    onSearch: (query: string) => void;
    placeholder?: string;
}

const SearchBar: React.FC<SearchBarProps> = ({
    onSearch,
    placeholder = 'Tìm kiếm tài liệu...'
}) => {
    const [query, setQuery] = useState('');
    const [focused, setFocused] = useState(false);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);
        onSearch(value);
    };

    const handleClear = () => {
        setQuery('');
        onSearch('');
    };

    return (
        <div className="relative">
            <Search
                className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                style={{ color: focused ? '#6B7CDB' : '#AEACA8' }}
            />
            <input
                type="text"
                value={query}
                onChange={handleChange}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
                placeholder={placeholder}
                className="w-full pl-8 pr-8 py-2 text-sm rounded-lg transition-colors outline-none"
                style={{
                    background: '#FFFFFF',
                    border: `1px solid ${focused ? '#6B7CDB' : '#E9E9E7'}`,
                    color: '#1A1A1A',
                }}
            />
            {query && (
                <button
                    onClick={handleClear}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded transition-colors"
                    style={{ color: '#AEACA8' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#787774'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#AEACA8'}
                >
                    <X className="w-3.5 h-3.5" />
                </button>
            )}
        </div>
    );
};

export default SearchBar;
