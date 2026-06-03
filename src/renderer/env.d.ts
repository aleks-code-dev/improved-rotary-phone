import type { WindowApi } from '../preload/index.ts';

declare global {
  interface Window {
    api: WindowApi;
  }
}
