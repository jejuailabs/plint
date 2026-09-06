'use client';

import { MapPin, Search, LoaderCircle, Building2, LandPlot } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';

export type AddressResult = {
  roadAddress: string;
  jibunAddress: string;
  zipCode: string;
  buildingName: string;
  siNm: string;
  sggNm: string;
  emdNm: string;
};

type Props = {
  onSelect: (result: AddressResult) => void;
  placeholder?: string;
  disabled?: boolean;
  defaultValue?: string;
  className?: string;
  inputClassName?: string;
};

export function AddressSearch({
  onSelect,
  placeholder = '도로명, 지번, 건물명으로 검색',
  disabled = false,
  defaultValue = '',
  className = '',
  inputClassName = '',
}: Props) {
  const [query, setQuery] = useState(defaultValue);
  const [results, setResults] = useState<AddressResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const search = useCallback(async (keyword: string) => {
    if (keyword.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/address/search?q=${encodeURIComponent(keyword.trim())}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResults(data.results ?? []);
      setIsOpen((data.results ?? []).length > 0);
      setActiveIndex(-1);
    } catch {
      setResults([]);
      setIsOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(value), 300);
  }, [search]);

  const handleSelect = useCallback((result: AddressResult) => {
    setQuery(result.jibunAddress || result.roadAddress);
    setIsOpen(false);
    setResults([]);
    onSelect(result);
  }, [onSelect]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!isOpen || results.length === 0) {
      if (e.key === 'Enter') e.preventDefault();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < results.length) {
        handleSelect(results[activeIndex]);
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false);
    }
  }, [isOpen, results, activeIndex, handleSelect]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative flex items-center">
        {loading ? (
          <LoaderCircle className="absolute left-3 size-4 animate-spin text-cyan-300" />
        ) : (
          <Search className="absolute left-3 size-4 text-slate-500" />
        )}
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          className={`h-12 w-full rounded-xl border-0 bg-transparent pl-10 pr-4 text-[15px] text-white shadow-none placeholder:text-slate-500 focus:outline-none focus:ring-0 ${inputClassName}`}
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls="address-listbox"
          aria-activedescendant={activeIndex >= 0 ? `address-option-${activeIndex}` : undefined}
        />
      </div>

      {isOpen && results.length > 0 && (
        <ul
          id="address-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-2 max-h-[360px] overflow-y-auto rounded-2xl border border-white/12 bg-[#0c1829]/95 p-1.5 shadow-[0_20px_60px_rgba(0,0,0,.5)] backdrop-blur-xl"
        >
          {results.map((result, i) => (
            <li
              key={`${result.jibunAddress}-${i}`}
              id={`address-option-${i}`}
              role="option"
              aria-selected={i === activeIndex}
              className={`flex cursor-pointer gap-3 rounded-xl px-3 py-3 transition ${
                i === activeIndex ? 'bg-cyan-300/10' : 'hover:bg-white/[0.06]'
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onClick={() => handleSelect(result)}
            >
              <div className="mt-0.5 shrink-0">
                {result.buildingName ? (
                  <Building2 className="size-4 text-cyan-300" />
                ) : (
                  <LandPlot className="size-4 text-lime-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-100">
                  {result.roadAddress}
                </p>
                <p className="mt-0.5 truncate text-xs text-slate-400">
                  <MapPin className="mr-1 inline size-3" />
                  {result.jibunAddress}
                  {result.buildingName && (
                    <span className="ml-2 text-cyan-200/70">{result.buildingName}</span>
                  )}
                </p>
                <p className="mt-0.5 text-[10px] text-slate-600">
                  {result.zipCode}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
