import { loader } from '@monaco-editor/react';

// Configure Monaco to load from CDN (R-4: CDN fallback pattern for Electron's file:// context)
loader.config({
  paths: {
    vs: 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.0/min/vs',
  },
});

let initPromise: Promise<typeof import('monaco-editor')> | null = null;

/**
 * Lazy-load Monaco editor. Returns a promise that resolves to the monaco namespace.
 * Configures JSON language service defaults on first load.
 */
export function getMonaco(): Promise<typeof import('monaco-editor')> {
  if (!initPromise) {
    initPromise = loader.init().then((monaco) => {
      // Configure JSON language service defaults
      monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
        validate: true,
        allowComments: false,
        schemas: [],
      });
      return monaco;
    });
  }
  return initPromise;
}

/**
 * Detect Monaco language from Content-Type.
 */
export function languageFromContentType(contentType: string): string {
  const ct = contentType.toLowerCase();
  if (ct.includes('json')) return 'json';
  if (ct.includes('xml')) return 'xml';
  if (ct.includes('html')) return 'html';
  if (ct.includes('graphql')) return 'graphql';
  return 'plaintext';
}

/**
 * Format text (pretty-print) if it matches the given language.
 * Returns the formatted text, or the original if formatting fails.
 */
export async function formatText(text: string, language: string): Promise<string> {
  if (language === 'json') {
    try {
      return JSON.stringify(JSON.parse(text), null, 2);
    } catch {
      return text;
    }
  }
  // XML formatting deferred to v1.5
  return text;
}
