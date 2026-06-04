import { useState, useRef, useCallback, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import type { ResponseResult } from '../../state/useResponse';

interface BodyTabProps {
  result: ResponseResult;
  searchVisible?: boolean;
  onSearchRef?: (ref: { focus: () => void }) => void;
}

type BodyMode = 'pretty' | 'raw' | 'preview';

export function ResponseBodyTab({ result, searchVisible, onSearchRef }: BodyTabProps) {
  const [mode, setMode] = useState<BodyMode>('pretty');
  const [searchText, setSearchText] = useState('');
  const editorRef = useRef<any>(null);

  const decoded = atob(result.bodyBase64);
  const contentType = result.headers.find(
    (h) => h.key.toLowerCase() === 'content-type'
  )?.value ?? '';

  const isJson = contentType.includes('json');
  const isHtml = contentType.includes('html');

  // Expose focus for Ctrl+F
  useEffect(() => {
    if (onSearchRef) onSearchRef({ focus: () => setSearchText('') });
  }, [onSearchRef]);

  const handleEditorMount = useCallback((editor: any) => {
    editorRef.current = editor;
  }, []);

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (editorRef.current && text) {
      const model = editorRef.current.getModel();
      if (model) {
        const matches = model.findMatches(text, true, false, false, null, true);
        if (matches.length > 0) {
          editorRef.current.setSelection(matches[0].range);
          editorRef.current.revealLineInCenter(matches[0].range.startLineNumber);
        }
      }
    }
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Sub-tabs + search */}
      <div style={{ display: 'flex', gap: 'var(--space-2)', padding: 'var(--space-1) var(--space-3)', borderBottom: '1px solid var(--color-border)', alignItems: 'center' }}>
        {(['pretty', 'raw', 'preview'] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            disabled={m === 'preview' && !isHtml}
            title={m === 'preview' && !isHtml ? 'Preview requires HTML content' : undefined}
            style={{
              padding: 'var(--space-1) var(--space-2)',
              background: mode === m ? 'var(--color-accent)' : 'transparent',
              color: mode === m ? 'white' : 'var(--color-fg-muted)',
              border: 'none',
              borderRadius: 'var(--radius-1)',
              cursor: (m === 'preview' && !isHtml) ? 'not-allowed' : 'pointer',
              fontSize: 12,
              textTransform: 'capitalize',
              opacity: (m === 'preview' && !isHtml) ? 0.4 : 1,
            }}
          >
            {m}
          </button>
        ))}
        {searchVisible && (
          <input
            type="text"
            value={searchText}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Find in response…"
            style={searchInputStyle}
            autoFocus
          />
        )}
      </div>

      {/* Body content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {mode === 'pretty' && (
          isJson ? (
            <Editor
              height="100%"
              language="json"
              value={tryPrettyPrint(decoded)}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{
                readOnly: true,
                minimap: { enabled: false },
                fontSize: 13,
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                wordWrap: 'on',
              }}
            />
          ) : (
            <div style={{ padding: 'var(--space-4)', overflow: 'auto', height: '100%' }}>
              <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-fg)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {decoded}
              </pre>
              <div style={{ marginTop: 'var(--space-2)', fontSize: 11, color: 'var(--color-fg-muted)' }}>
                Pretty mode requires JSON content — showing raw instead.
              </div>
            </div>
          )
        )}

        {mode === 'raw' && (
          <div style={{ padding: 'var(--space-4)', overflow: 'auto', height: '100%' }}>
            <pre style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: 'var(--color-fg)', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {decoded}
            </pre>
          </div>
        )}

        {mode === 'preview' && isHtml && (
          <iframe
            sandbox="allow-same-origin"
            srcDoc={decoded}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Response preview"
          />
        )}

        {mode === 'preview' && !isHtml && (
          <div style={{ padding: 'var(--space-6)', textAlign: 'center', color: 'var(--color-fg-muted)' }}>
            Preview requires HTML content
          </div>
        )}
      </div>
    </div>
  );
}

function tryPrettyPrint(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

const searchInputStyle: React.CSSProperties = {
  flex: 1,
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-accent)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
  maxWidth: 300,
};
