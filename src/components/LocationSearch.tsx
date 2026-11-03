import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { cx } from '@/lib/format';
import { searchPlaces } from '@/services/geocode';
import type { LatLng, Place } from '@/types';
import { IconPin, IconSearch, IconX } from './icons';
import { Spinner } from './ui';

interface Props {
  label: string;
  placeholder?: string;
  value: Place | null;
  onChange: (p: Place | null) => void;
  near?: LatLng;
  leading?: ReactNode;
  trailing?: ReactNode;
  error?: string | null;
}

/** Accessible address autocomplete (WAI-ARIA combobox pattern). */
export function LocationSearch({ label, placeholder, value, onChange, near, leading, trailing, error }: Props) {
  const id = useId();
  const [text, setText] = useState(value?.label ?? '');
  const [results, setResults] = useState<Place[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  const [active, setActive] = useState(-1);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => setText(value?.label ?? ''), [value]);

  useEffect(() => {
    if (value && text === value.label) return;
    if (text.trim().length < 3) {
      setResults([]);
      setFailed(null);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setFailed(null);
      try {
        const r = await searchPlaces(text, near, ctrl.signal);
        setResults(r);
        setOpen(true);
        setActive(-1);
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setFailed('Address search is unavailable right now. Check your connection and try again.');
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const choose = (p: Place) => {
    onChange(p);
    setText(p.label);
    setOpen(false);
  };

  const listId = `${id}-list`;
  const showList = open && (results.length > 0 || (!loading && text.trim().length >= 3 && !failed));

  return (
    <div ref={wrap} className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-navy">{label}</label>
      <div className={cx('flex items-center gap-2 rounded-xl border bg-white pl-3 pr-1.5 transition focus-within:ring-2 focus-within:ring-teal-500/60', error ? 'border-coral-500' : 'border-navy-100 focus-within:border-teal-500')}>
        <span className="shrink-0 text-slate-400">{leading ?? <IconSearch size={18} />}</span>
        <input
          id={id}
          role="combobox"
          aria-expanded={showList}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${id}-opt-${active}` : undefined}
          aria-invalid={!!error || undefined}
          autoComplete="off"
          className="min-h-[46px] w-full min-w-0 bg-transparent text-[15px] text-charcoal placeholder:text-slate-400 focus:outline-none"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (value) onChange(null);
          }}
          onFocus={() => results.length && setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === 'Enter' && open && active >= 0 && results[active]) {
              e.preventDefault();
              choose(results[active]);
            } else if (e.key === 'Escape') {
              setOpen(false);
            }
          }}
        />
        {loading && <Spinner size={16} className="shrink-0 text-slate-400" />}
        {text && !loading && (
          <button type="button" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-mist hover:text-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500" aria-label={`Clear ${label.toLowerCase()}`} onClick={() => { setText(''); onChange(null); setResults([]); }}>
            <IconX size={16} />
          </button>
        )}
        {trailing}
      </div>
      {(failed || error) && <p className="mt-1.5 text-[13px] font-medium text-coral-700" role="alert">{failed ?? error}</p>}
      {showList && (
        <ul id={listId} role="listbox" aria-label={`${label} suggestions`} className="absolute z-30 mt-1.5 max-h-72 w-full animate-slide-in overflow-auto rounded-xl border border-navy/[0.06] bg-white p-1 shadow-lift">
          {results.length === 0 && <li className="px-3 py-3 text-sm text-slate-500">No matching places found.</li>}
          {results.map((r, i) => (
            <li
              key={`${r.lat},${r.lng},${i}`}
              id={`${id}-opt-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(r)}
              className={cx('flex cursor-pointer items-start gap-2.5 rounded-lg px-3 py-2.5 text-sm text-charcoal', i === active ? 'bg-sky-100' : 'hover:bg-mist')}
            >
              <IconPin size={16} className="mt-0.5 shrink-0 text-slate-400" />
              <span className="min-w-0">{r.label}</span>
            </li>
          ))}
          <li className="px-3 pb-1 pt-2 text-[11px] text-slate-400" aria-hidden="true">Search by Photon, data from OpenStreetMap</li>
        </ul>
      )}
    </div>
  );
}
