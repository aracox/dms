import { describe, expect, it } from 'vitest';

import { buttonClasses } from '@/components/ui/Button';

import { cn } from './cn';

describe('cn', () => {
  it('keeps a text colour beside a custom type-ramp size', () => {
    expect(cn('text-white', 'text-body-sm')).toBe('text-white text-body-sm');
    expect(cn('text-brand-red-deep text-caption')).toBe('text-brand-red-deep text-caption');
  });

  it('still lets a later type-ramp size replace an earlier one', () => {
    expect(cn('text-caption', 'text-body-sm')).toBe('text-body-sm');
  });

  it('gives the primary button white text at every size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(buttonClasses('primary', size).split(' ')).toContain('text-white');
    }
  });
});
