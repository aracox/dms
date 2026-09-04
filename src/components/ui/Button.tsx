import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils/cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive' | 'link';
export type ButtonSize = 'sm' | 'md' | 'lg';

/**
 * Variants follow design/questui-DESIGN.md. Its gold/deep-red fills map onto
 * the brand tokens: primary takes brand-blue, destructive takes brand-red.
 */
const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary:
    'bg-brand-blue text-white border-brand-blue-deep hover:bg-brand-blue-deep enabled:hover:shadow-sm',
  secondary:
    'bg-transparent text-brand-blue-deep border-brand-blue hover:bg-brand-blue-soft enabled:hover:shadow-sm',
  ghost: 'bg-transparent text-ink-muted border-transparent hover:bg-surface-sunken hover:text-ink',
  destructive:
    'bg-brand-red text-white border-brand-red-deep hover:bg-brand-red-deep enabled:hover:shadow-sm',
  link: 'bg-transparent text-ink-muted border-transparent underline underline-offset-2 hover:text-ink',
};

/** Heights are fixed at 32 / 40 / 48px so controls line up across a row. */
const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-8 gap-1 border px-3.5 text-[13px]',
  md: 'h-10 gap-2 border px-5.5 text-body-sm',
  lg: 'h-12 gap-2 border-[1.5px] px-7.5 text-h4',
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
    // font-display keeps UI labels in the heading face (Do #1); Thai falls
    // through to Noto inside the same stack.
    'font-display inline-flex shrink-0 items-center justify-center rounded-md font-semibold',
    'transition-colors duration-150',
    // Disabled dims the fill and drops the border accent, per the spec's
    // disabled state.
    'disabled:cursor-not-allowed disabled:border-border-strong disabled:opacity-35 disabled:shadow-none',
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
