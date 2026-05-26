import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, X } from 'lucide-react';

interface SearchableSelectProps {
  label?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  style?: React.CSSProperties;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = '-- Seleccionar --',
  required = false,
  style
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync search term with value
  useEffect(() => {
    setSearchTerm(value);
  }, [value]);

  // Click outside listener
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        // Reset search term to current selected value
        setSearchTerm(value);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [value]);

  const filteredOptions = options.filter(option =>
    option.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchTerm(option);
    setIsOpen(false);
    setHighlightedIndex(-1);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        setIsOpen(true);
        e.preventDefault();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev < filteredOptions.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => 
        prev > 0 ? prev - 1 : filteredOptions.length - 1
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (filteredOptions.length > 0) {
        handleSelect(filteredOptions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
      setSearchTerm(value);
    }
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', ...style }}>
      {label && <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-secondary)' }}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          required={required && !value}
          style={{
            width: '100%',
            padding: '16px 45px 16px 16px',
            background: 'var(--bg-input)',
            border: isOpen ? '1.5px solid var(--primary)' : '1px solid var(--border-input)',
            boxShadow: isOpen ? '0 0 15px var(--primary-glow)' : 'none',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: 'max(16px, 1.05rem)',
            fontWeight: 700,
            outline: 'none',
            transition: 'all 0.2s ease',
            textOverflow: 'ellipsis'
          }}
        />
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'color 0.2s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = '#ff4444'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-secondary)'}
            >
              <X size={16} />
            </button>
          )}
          <ChevronDown
            size={18}
            style={{
              color: 'var(--primary)',
              transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s ease',
              cursor: 'pointer',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>

      {isOpen && (
        <div
          className="glass"
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: '220px',
            overflowY: 'auto',
            zIndex: 1000,
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-glow)',
            padding: '4px'
          }}
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option, idx) => {
              const isSelected = option === value;
              const isHighlighted = idx === highlightedIndex;
              return (
                <div
                  key={option}
                  onClick={() => handleSelect(option)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected
                      ? 'var(--primary-glow)'
                      : isHighlighted
                      ? 'rgba(128, 128, 128, 0.15)'
                      : 'transparent',
                    color: isSelected ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: isSelected ? 800 : 600,
                    fontSize: '0.95rem',
                    transition: 'all 0.15s ease',
                    minHeight: '46px',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {option}
                </div>
              );
            })
          ) : (
            <div style={{ padding: '16px', color: 'var(--text-secondary)', fontSize: '0.9rem', textAlign: 'center' }}>
              No se encontraron coincidencias
            </div>
          )}
        </div>
      )}
    </div>
  );
};
