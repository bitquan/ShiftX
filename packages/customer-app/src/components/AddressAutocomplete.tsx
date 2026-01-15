import { useRef, useEffect, useState } from 'react';
import { useForwardGeocode } from '../hooks/useForwardGeocode';

interface AutocompletePlace {
  label: string;
  lat: number;
  lng: number;
}

interface AddressAutocompleteProps {
  label?: 'Pickup' | 'Dropoff' | '';
  value: string;
  onChange: (value: string) => void;
  onSelect: (place: AutocompletePlace) => void;
  onFocus?: () => void;
  placeholder?: string;
}

export function AddressAutocomplete({
  label,
  value,
  onChange,
  onSelect,
  onFocus,
  placeholder = 'Enter address...',
}: AddressAutocompleteProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  // Forward geocoding
  const { results, loading } = useForwardGeocode(value);

  // Handle clicks outside to close dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDropdown(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(e.target.value);
    // Show dropdown when user types
    if (e.target.value.trim().length >= 3) {
      setShowDropdown(true);
    }
  };

  const handleInputFocus = () => {
    onFocus?.();
    // Show dropdown if there are results
    if (results.length > 0) {
      setShowDropdown(true);
    }
  };

  const handleSuggestionClick = (suggestion: (typeof results)[0]) => {
    const [lng, lat] = suggestion.center;
    onSelect({
      label: suggestion.place_name,
      lat,
      lng,
    });
    setShowDropdown(false);
  };

  const shouldShowDropdown = showDropdown && (results.length > 0 || loading);

  return (
    <div style={{ position: 'relative', marginBottom: '1rem' }}>
      {label && (
        <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem', color: 'rgba(255,255,255,0.7)' }}>
          {label}
        </label>
      )}
      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={handleInputChange}
        placeholder={placeholder}
        style={{
          width: '100%',
          padding: '10px 12px',
          border: '1px solid rgba(255,255,255,0.2)',
          borderRadius: '6px',
          backgroundColor: 'rgba(255,255,255,0.05)',
          color: '#fff',
          fontSize: '0.95rem',
          fontFamily: 'inherit',
          outline: 'none',
          transition: 'border-color 0.2s',
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = 'rgba(80,160,255,0.6)';
          handleInputFocus();
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
        }}
      />

      {/* Dropdown */}
      {shouldShowDropdown && (
        <div
          ref={dropdownRef}
          className="address-autocomplete-dropdown"
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            marginTop: '4px',
            backgroundColor: 'rgba(20, 20, 30, 0.95)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px',
            maxHeight: '300px',
            overflowY: 'auto',
            zIndex: 1000,
            boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          }}
        >
          {loading ? (
            <div
              style={{
                padding: '12px',
                textAlign: 'center',
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              Loading suggestions...
            </div>
          ) : results.length > 0 ? (
            results.map((result, idx) => (
              <div
                key={result.id || idx}
                onClick={() => handleSuggestionClick(result)}
                style={{
                  padding: '12px',
                  borderBottom: idx < results.length - 1 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'background-color 0.15s',
                  backgroundColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(80,160,255,0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div
                  style={{
                    fontSize: '0.9rem',
                    color: '#fff',
                    wordBreak: 'break-word',
                  }}
                >
                  {result.place_name}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                padding: '12px',
                textAlign: 'center',
                fontSize: '0.85rem',
                color: 'rgba(255,255,255,0.5)',
              }}
            >
              No results found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
