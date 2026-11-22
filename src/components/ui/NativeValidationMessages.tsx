'use client';

import { useTranslations } from 'next-intl';
import { useEffect } from 'react';

type Control = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

const isControl = (target: EventTarget | null): target is Control =>
  target instanceof HTMLInputElement ||
  target instanceof HTMLSelectElement ||
  target instanceof HTMLTextAreaElement;

/**
 * The browser writes its own "Please fill out this field" bubbles in the
 * browser's language, not the app's. This swaps in the app's message for
 * every required/min/max/pattern check, once, for the whole app -- forms keep
 * their plain HTML attributes.
 *
 * A message set here sticks until cleared, so it's cleared on the next edit,
 * and before any submit (a value set by code fires no edit event).
 */
export function NativeValidationMessages() {
  const t = useTranslations('validation');

  useEffect(() => {
    const flagged = new Set<Control>();

    const message = (control: Control): string => {
      const { validity } = control;
      const input = control instanceof HTMLInputElement ? control : null;
      if (validity.valueMissing) return t('required');
      if (validity.typeMismatch)
        return input?.type === 'email' ? t('email.format') : t('native.format');
      if (validity.badInput)
        return input?.type === 'number' ? t('native.number') : t('native.format');
      if (validity.rangeUnderflow) return t('native.min', { min: input?.min ?? '' });
      if (validity.rangeOverflow) return t('native.max', { max: input?.max ?? '' });
      if (validity.stepMismatch) return t('native.step');
      if (validity.tooShort) return t('native.tooShort', { count: input?.minLength ?? 0 });
      if (validity.tooLong) return t('native.tooLong', { count: input?.maxLength ?? 0 });
      if (validity.patternMismatch) return control.title || t('native.format');
      return '';
    };

    const clear = (control: Control) => {
      if (flagged.delete(control)) control.setCustomValidity('');
    };

    const onInvalid = (event: Event) => {
      if (!isControl(event.target)) return;
      const control = event.target;
      // Clear first so `validity` reflects the browser's own checks only.
      control.setCustomValidity('');
      const text = message(control);
      if (!text) return;
      control.setCustomValidity(text);
      flagged.add(control);
    };

    const onEdit = (event: Event) => {
      if (isControl(event.target)) clear(event.target);
    };

    // Runs before the browser validates the form a submit button belongs to.
    const onClick = (event: Event) => {
      const button = event.target instanceof Element ? event.target.closest('button') : null;
      if (!button || button.type !== 'submit' || !button.form) return;
      for (const control of flagged) {
        if (control.form === button.form) clear(control);
      }
    };

    document.addEventListener('invalid', onInvalid, true);
    document.addEventListener('input', onEdit, true);
    document.addEventListener('change', onEdit, true);
    document.addEventListener('click', onClick, true);
    return () => {
      document.removeEventListener('invalid', onInvalid, true);
      document.removeEventListener('input', onEdit, true);
      document.removeEventListener('change', onEdit, true);
      document.removeEventListener('click', onClick, true);
    };
  }, [t]);

  return null;
}
