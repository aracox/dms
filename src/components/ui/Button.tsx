import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

/** Flat actions from the Wonderful UI reference; teal is the primary action. */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: 'bg-brand-blue text-white border-brand-blue hover:bg-brand-blue-deep',
  secondary: 'glass-surface text-ink border-border hover:bg-surface-sunken',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:bg-surface-sunken hover:text-ink',
  destructive: 'bg-brand-red text-white border-transparent hover:bg-brand-red-deep',
  link: 'bg-transparent text-ink-muted border-transparent underline underline-offset-2 hover:text-ink',
};

/** Compact table actions, standard desktop controls, and larger form actions. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1.5 border px-2.5 text-caption',
  md: 'h-9 gap-2 border px-3.5 text-body-sm',
  lg: 'h-11 gap-2 border px-5 text-body-sm',
};

/**
 * Exported so the handful of navigation targets styled as buttons (`<Link>`,
 * `<a>`) can share one definition instead of re-deriving the string. Prefer
 * `<Button>` for anything that performs an action.
 */
export function buttonClasses(
  variant: ButtonVariant = 'primary',
  size: ButtonSize = 'md',
  className?: string,
) {
  return cn(
    'font-display inline-flex shrink-0 items-center justify-center rounded-md font-medium',
    'transition-colors duration-150 enabled:active:translate-y-px motion-reduce:transform-none',
    'disabled:cursor-not-allowed disabled:border-transparent disabled:bg-surface-sunken disabled:text-ink-muted disabled:shadow-none',
    VARIANT_CLASSES[variant],
    SIZE_CLASSES[size],
    className,
  );
}

/**
 * The app's only button. Before this existed every call site hand-rolled its
 * own Tailwind string, so no two buttons agreed on height, radius, or focus
 * treatment.
 *
 * `type` defaults to "button": an unqualified <button> inside a <form> submits
 * it, which is rarely what a row-level action wants. Pass type="submit"
 * explicitly on the button that is meant to submit.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return <button type={type} className={buttonClasses(variant, size, className)} {...props} />;
}
