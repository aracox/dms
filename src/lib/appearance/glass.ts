export const GLASS_TRANSPARENCY = {
  defaultValue: 24,
  max: 40,
  min: 0,
  storageKey: 'dms:glass-transparency',
} as const;

export function glassOpacity(transparency: number) {
  return `${100 - transparency}%`;
}

export const BACKGROUND_IMAGE_STORAGE_KEY = 'dms:background-image';

// Apply the saved choice on every page, including login, before hydration.
export const BACKGROUND_IMAGE_INIT_SCRIPT = `try {
  document.documentElement.dataset.backgroundImage =
    localStorage.getItem('${BACKGROUND_IMAGE_STORAGE_KEY}') === 'true' ? 'visible' : 'hidden';
} catch {}`;
