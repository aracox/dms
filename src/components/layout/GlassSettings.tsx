'use client';

import { Settings } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import { useTranslations } from 'next-intl';

import { GLASS_TRANSPARENCY, glassOpacity } from '@/lib/appearance/glass';

function applyTransparency(value: number) {
  document.documentElement.dataset.glassPreference = 'custom';
  document.documentElement.style.setProperty('--glass-opacity', glassOpacity(value));
}

const GLASS_CHANGE_EVENT = 'dms:glass-transparency-change';

function getStoredTransparency() {
  const rawValue = localStorage.getItem(GLASS_TRANSPARENCY.storageKey);
  if (rawValue === null) return GLASS_TRANSPARENCY.defaultValue;

  const stored = Number(rawValue);
  return Number.isFinite(stored) &&
    stored >= GLASS_TRANSPARENCY.min &&
    stored <= GLASS_TRANSPARENCY.max
    ? stored
    : GLASS_TRANSPARENCY.defaultValue;
}

function subscribeToTransparency(onChange: () => void) {
  window.addEventListener(GLASS_CHANGE_EVENT, onChange);
  window.addEventListener('storage', onChange);
  return () => {
    window.removeEventListener(GLASS_CHANGE_EVENT, onChange);
    window.removeEventListener('storage', onChange);
  };
}

export function GlassSettings() {
  const t = useTranslations('appearance');
  const [open, setOpen] = useState(false);
  const transparency = useSyncExternalStore(
    subscribeToTransparency,
    getStoredTransparency,
    () => GLASS_TRANSPARENCY.defaultValue,
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const hintId = useId();

  useEffect(() => {
    if (localStorage.getItem(GLASS_TRANSPARENCY.storageKey) !== null) {
      applyTransparency(transparency);
    }
  }, [transparency]);

  useEffect(() => {
    if (!open) return;

    function closeOnOutsideClick(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-label={t('open')}
        aria-expanded={open}
        aria-controls="glass-settings-panel"
        className="border-border bg-surface/55 text-ink-muted hover:border-brand-blue hover:text-brand-blue-deep flex size-9 items-center justify-center rounded-full border shadow-sm backdrop-blur-md transition-colors"
        onClick={() => setOpen((current) => !current)}
      >
        <Settings size={17} aria-hidden="true" />
      </button>

      {open ? (
        <section
          id="glass-settings-panel"
          aria-labelledby={titleId}
          className="glass border-border absolute top-12 right-0 z-20 w-72 rounded-xl border p-4 shadow-xl"
        >
          <div className="flex items-baseline justify-between gap-3">
            <h2 id={titleId} className="text-ink font-display text-sm font-semibold">
              {t('title')}
            </h2>
            <output className="text-brand-blue-deep font-mono text-sm font-semibold">
              {transparency}%
            </output>
          </div>
          <label
            htmlFor="glass-transparency"
            className="text-ink text-body-sm mt-4 block font-medium"
          >
            {t('transparency')}
          </label>
          <input
            id="glass-transparency"
            type="range"
            min={GLASS_TRANSPARENCY.min}
            max={GLASS_TRANSPARENCY.max}
            step={1}
            value={transparency}
            aria-describedby={hintId}
            className="accent-brand-blue mt-2 w-full cursor-pointer"
            onChange={(event) => {
              const value = Number(event.target.value);
              localStorage.setItem(GLASS_TRANSPARENCY.storageKey, String(value));
              window.dispatchEvent(new Event(GLASS_CHANGE_EVENT));
            }}
          />
          <div className="text-ink-subtle text-caption mt-1 flex justify-between">
            <span>{t('solid')}</span>
            <span>{t('clear')}</span>
          </div>
          <p id={hintId} className="text-ink-muted text-caption mt-3">
            {t('hint')}
          </p>
        </section>
      ) : null}
    </div>
  );
}
