import React, { useState, useEffect, useRef } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';

interface SearchableSelectProps {
  label?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  style?: React.CSSProperties;
  deferSearch?: boolean;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  label,
  options,
  value,
  onChange,
  placeholder = '-- Seleccionar --',
  required = false,
  style,
  deferSearch = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSearchEditing, setIsSearchEditing] = useState(false);
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
        setIsSearchEditing(false);
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

  const showSelectedValue = !!value && !isOpen;

  const handleSelect = (option: string) => {
    onChange(option);
    setSearchTerm(option);
    setIsOpen(false);
    setIsSearchEditing(false);
    setHighlightedIndex(-1);
    if (deferSearch) inputRef.current?.blur();
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
    setIsOpen(true);
    setIsSearchEditing(!deferSearch);
    inputRef.current?.focus();
  };

  const startDeferredSearch = () => {
    inputRef.current?.blur();
    setIsSearchEditing(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const closeWithoutSelection = () => {
    inputRef.current?.blur();
    setIsOpen(false);
    setIsSearchEditing(false);
    setSearchTerm(value);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (deferSearch && isOpen && isSearchEditing && e.key === 'Enter') {
      e.preventDefault();
      setIsSearchEditing(false);
      inputRef.current?.blur();
      return;
    }

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
      setIsSearchEditing(false);
      setSearchTerm(value);
    }
  };

  return (
    <div
      ref={containerRef}
      className="searchable-select"
      style={{ position: 'relative', width: '100%', minWidth: 0, maxWidth: '100%', boxSizing: 'border-box', ...style }}
    >
      {label && <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.82rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px', color: 'var(--text-secondary)' }}>{label}</label>}
      <div style={{ position: 'relative', width: '100%', minWidth: 0, maxWidth: '100%', minHeight: '48px', boxSizing: 'border-box' }}>
        <input
          ref={inputRef}
          type="text"
          value={searchTerm}
          onChange={(e) => {
            if (deferSearch && !isSearchEditing) return;
            setSearchTerm(e.target.value);
            if (!isOpen) setIsOpen(true);
          }}
          onFocus={() => {
            if (deferSearch && !isOpen) {
              setSearchTerm('');
              setIsSearchEditing(false);
            }
            setIsOpen(true);
          }}
          onPointerDown={(e) => {
            if (!deferSearch || isSearchEditing) return;
            e.preventDefault();
            if (!isOpen) setSearchTerm('');
            setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          inputMode={deferSearch ? (isSearchEditing ? 'search' : 'none') : undefined}
          enterKeyHint={deferSearch ? 'search' : undefined}
          placeholder={placeholder}
          required={required && !value}
          style={{
            width: '100%',
            minWidth: 0,
            maxWidth: '100%',
            minHeight: '48px',
            height: showSelectedValue ? '100%' : undefined,
            position: showSelectedValue ? 'absolute' : 'relative',
            inset: showSelectedValue ? 0 : undefined,
            padding: `16px ${value ? '92px' : '60px'} 16px 16px`,
            background: 'var(--bg-input)',
            border: isOpen ? '1.5px solid var(--primary)' : '1px solid var(--border-input)',
            boxShadow: isOpen ? '0 0 15px var(--primary-glow)' : 'none',
            borderRadius: '8px',
            color: showSelectedValue ? 'transparent' : 'var(--text-primary)',
            caretColor: showSelectedValue ? 'transparent' : 'var(--text-primary)',
            fontSize: 'max(16px, 1.05rem)',
            fontWeight: 700,
            outline: 'none',
            transition: 'all 0.2s ease',
            overflow: 'hidden',
            textOverflow: 'clip',
            whiteSpace: 'nowrap'
          }}
        />
        {showSelectedValue && (
          <div
            aria-hidden="true"
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              minWidth: 0,
              maxWidth: '100%',
              minHeight: '48px',
              padding: '16px 92px 16px 16px',
              color: 'var(--text-primary)',
              fontSize: 'max(16px, 1.05rem)',
              fontWeight: 700,
              lineHeight: 1.35,
              whiteSpace: 'normal',
              overflowWrap: 'anywhere',
              pointerEvents: 'none',
              boxSizing: 'border-box'
            }}
          >
            {value}
          </div>
        )}
        <div style={{ position: 'absolute', zIndex: 2, right: '8px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', gap: '8px', maxWidth: 'calc(100% - 16px)' }}>
          {value && (
            <button
              type="button"
              onClick={handleClear}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                padding: 0,
                width: '48px',
                minWidth: '48px',
                height: '48px',
                minHeight: '48px',
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
          className={`glass searchable-select-menu ${deferSearch ? 'searchable-select-menu-deferred' : ''}`}
          style={{
            position: deferSearch ? 'relative' : 'absolute',
            top: deferSearch ? undefined : 'calc(100% + 4px)',
            left: 0,
            right: 0,
            maxHeight: deferSearch ? 'min(52vh, 420px)' : '220px',
            overflowY: 'auto',
            zIndex: 1000,
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-glow)',
            padding: '4px'
          }}
        >
          {deferSearch && (
            <div className="searchable-select-deferred-tools">
              {isSearchEditing ? (
                <span><Search size={17} /> Escribe y pulsa Buscar/Done</span>
              ) : searchTerm ? (
                <button type="button" onClick={startDeferredSearch}>
                  <Search size={17} /> <span>{searchTerm}</span> <strong>Editar</strong>
                </button>
              ) : (
                <button type="button" onClick={startDeferredSearch}>
                  <Search size={17} /> Buscar
                </button>
              )}
              <button type="button" onClick={closeWithoutSelection}>Cerrar</button>
            </div>
          )}
          {deferSearch && searchTerm && !isSearchEditing && <div className="searchable-select-results-label">Coincidencias</div>}
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
                    minHeight: '48px',
                    minWidth: 0,
                    maxWidth: '100%',
                    whiteSpace: 'normal',
                    overflowWrap: 'anywhere',
                    display: 'flex',
                    alignItems: 'center',
                    boxSizing: 'border-box'
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
      <style>{`
        .searchable-select,
        .searchable-select * {
          box-sizing: border-box;
        }
        .searchable-select-menu.glass {
          width: 100%;
          min-width: 0;
          max-width: 100%;
          padding: 4px !important;
          overflow-x: hidden;
        }
        .searchable-select-menu-deferred {
          margin-top: 4px;
          overscroll-behavior: contain;
        }
        .searchable-select-deferred-tools {
          display: flex;
          align-items: stretch;
          justify-content: space-between;
          gap: 8px;
          padding: 4px;
        }
        .searchable-select-deferred-tools button,
        .searchable-select-deferred-tools > span {
          min-height: 48px;
          min-width: 0;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          border: 1px solid var(--glass-border);
          border-radius: 7px;
          background: rgba(0, 242, 255, 0.08);
          color: var(--primary);
          font-weight: 800;
        }
        .searchable-select-deferred-tools button:first-child,
        .searchable-select-deferred-tools > span:first-child {
          flex: 1;
        }
        .searchable-select-deferred-tools button span {
          min-width: 0;
          overflow-wrap: anywhere;
        }
        .searchable-select-results-label {
          padding: 8px 12px 4px;
          color: var(--text-secondary);
          font-size: 0.72rem;
          font-weight: 800;
          letter-spacing: 0.6px;
          text-transform: uppercase;
        }
        @media (max-width: 430px) {
          .searchable-select-deferred-tools {
            flex-wrap: wrap;
          }
          .searchable-select-deferred-tools > * {
            flex: 1 1 100%;
          }
        }
      `}</style>
    </div>
  );
};
