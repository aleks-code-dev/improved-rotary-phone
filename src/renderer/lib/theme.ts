type Theme = 'system' | 'dark' | 'light';

let mediaListener: ((e: MediaQueryListEvent) => void) | null = null;

export function applyTheme(theme: Theme): void {
  // Clean up previous system-preference listener
  if (mediaListener) {
    window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaListener);
    mediaListener = null;
  }

  if (theme === 'system') {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const update = () => {
      document.documentElement.setAttribute('data-theme', mq.matches ? 'dark' : 'light');
    };
    update();
    mediaListener = update;
    mq.addEventListener('change', mediaListener);
  } else {
    document.documentElement.setAttribute('data-theme', theme);
  }
}

export function getEffectiveTheme(theme: Theme): 'dark' | 'light' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}
