export const GLASS_TRANSPARENCY = {
  defaultValue: 28,
  max: 40,
  min: 0,
  storageKey: 'dms:glass-transparency',
} as const;

export function glassOpacity(transparency: number) {
  return `${100 - transparency}%`;
}
