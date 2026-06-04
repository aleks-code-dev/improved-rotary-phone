import { useEffect, useRef, useCallback } from 'react';
import Editor from '@monaco-editor/react';
import { useRequest, type BodyMode, type RawContentType, type RequestBody } from '../../state/useRequest';
import { formatText } from '../../lib/monaco';

interface BodyTabProps {
  tabId: string;
}

const CONTENT_TYPES: RawContentType[] = ['application/json', 'application/xml', 'text/plain', 'application/graphql'];

export function BodyTab({ tabId }: BodyTabProps) {
  const spec = useRequest((s) => s.specs[tabId]);
  const setBody = useRequest((s) => s.setBody);
  const body = spec?.body ?? { mode: 'none' as const };

  const handleModeChange = (mode: BodyMode) => {
    // Preserve raw text when switching between raw and other modes
    if (mode === 'raw') {
      setBody(tabId, { mode: 'raw', contentType: 'application/json', text: '' });
    } else if (mode === 'urlencoded') {
      setBody(tabId, { mode: 'urlencoded', fields: [] });
    } else if (mode === 'form-data') {
      setBody(tabId, { mode: 'form-data', fields: [] });
    } else if (mode === 'binary') {
      setBody(tabId, { mode: 'binary', filePath: '', contentType: 'application/octet-stream' });
    } else {
      setBody(tabId, { mode: 'none' });
    }
  };

  const handleFormat = useCallback(async () => {
    if (body.mode === 'raw' && (body.contentType === 'application/json' || body.contentType === 'application/xml')) {
      const formatted = await formatText(body.text, body.contentType === 'application/json' ? 'json' : 'xml');
      setBody(tabId, { ...body, text: formatted });
    }
  }, [body, tabId, setBody]);

  return (
    <div style={{ padding: 'var(--space-3)', overflow: 'auto', fontSize: 12 }}>
      {/* Mode switcher (D-14) */}
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', flexWrap: 'wrap' }}>
        {(['none', 'form-data', 'url-encoded', 'raw', 'binary'] as const).map((mode) => (
          <label key={mode} style={radioLabelStyle}>
            <input
              type="radio"
              name={`body-mode-${tabId}`}
              checked={body.mode === mode || (mode === 'url-encoded' && body.mode === 'urlencoded')}
              onChange={() => handleModeChange(mode === 'url-encoded' ? 'urlencoded' : mode as BodyMode)}
              style={{ marginRight: 4 }}
            />
            {mode}
          </label>
        ))}
      </div>

      {/* Content-Type dropdown for raw mode */}
      {body.mode === 'raw' && (
        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)', alignItems: 'center' }}>
          <select
            value={body.contentType}
            onChange={(e) => setBody(tabId, { ...body, contentType: e.target.value as RawContentType })}
            style={selectStyle}
          >
            {CONTENT_TYPES.map((ct) => (
              <option key={ct} value={ct}>{ct}</option>
            ))}
          </select>
          <button onClick={handleFormat} style={formatBtnStyle}>Format</button>
        </div>
      )}

      {/* Mode-specific content */}
      {body.mode === 'none' && (
        <div style={{ color: 'var(--color-fg-muted)', padding: 'var(--space-6)', textAlign: 'center', border: '1px dashed var(--color-border)', borderRadius: 'var(--radius-1)' }}>
          No body
        </div>
      )}

      {body.mode === 'raw' && (
        <div style={{ border: '1px solid var(--color-border)', borderRadius: 'var(--radius-1)', overflow: 'hidden' }}>
          <Editor
            height="240px"
            language={body.contentType === 'application/json' ? 'json' : body.contentType === 'application/xml' ? 'xml' : body.contentType === 'application/graphql' ? 'graphql' : 'plaintext'}
            value={body.text}
            onChange={(value) => setBody(tabId, { ...body, text: value ?? '' })}
            theme="vs-dark"
            options={{
              minimap: { enabled: false },
              fontSize: 13,
              lineNumbers: 'on',
              scrollBeyondLastLine: false,
              wordWrap: 'on',
              tabSize: 2,
            }}
          />
          <div style={{ padding: '4px var(--space-2)', fontSize: 10, color: 'var(--color-fg-muted)', textAlign: 'right', borderTop: '1px solid var(--color-border)' }}>
            {body.text.length} characters
          </div>
        </div>
      )}

      {body.mode === 'urlencoded' && (
        <KeyValueTable
          rows={body.fields}
          onUpdate={(i, field) => {
            const fields = [...body.fields];
            fields[i] = { ...fields[i], ...field };
            setBody(tabId, { ...body, fields });
          }}
          onRemove={(i) => setBody(tabId, { ...body, fields: body.fields.filter((_, j) => j !== i) })}
          onAdd={() => setBody(tabId, { ...body, fields: [...body.fields, { key: '', value: '' }] })}
        />
      )}

      {body.mode === 'form-data' && (
        <FormDataTable
          rows={body.fields}
          onUpdate={(i, field) => {
            const fields = [...body.fields];
            fields[i] = { ...fields[i], ...field };
            setBody(tabId, { ...body, fields });
          }}
          onRemove={(i) => setBody(tabId, { ...body, fields: body.fields.filter((_, j) => j !== i) })}
          onAdd={() => setBody(tabId, { ...body, fields: [...body.fields, { key: '', value: '', type: 'text' }] })}
        />
      )}

      {body.mode === 'binary' && (
        <BinaryPicker
          filePath={body.filePath}
          contentType={body.contentType}
          onSelect={async () => {
            const result = await window.api.app.showOpenDialog({ kind: 'file', title: 'Select file' });
            if (result.path) setBody(tabId, { ...body, filePath: result.path });
          }}
          onContentTypeChange={(ct) => setBody(tabId, { ...body, contentType: ct })}
        />
      )}
    </div>
  );
}

// --- Sub-components ---

function KeyValueTable({ rows, onUpdate, onRemove, onAdd }: {
  rows: Array<{ key: string; value: string }>;
  onUpdate: (index: number, field: Partial<{ key: string; value: string }>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-2)' }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Key</th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Value</th>
            <th style={{ ...cellStyle, width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={cellStyle}>
                <input value={r.key} onChange={(e) => onUpdate(i, { key: e.target.value })} placeholder="key" style={inputStyle} />
              </td>
              <td style={cellStyle}>
                <input value={r.value} onChange={(e) => onUpdate(i, { value: e.target.value })} placeholder="value" style={inputStyle} />
              </td>
              <td style={cellStyle}>
                <button onClick={() => onRemove(i)} style={removeBtnStyle}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onAdd} style={addBtnStyle}>+ Add row</button>
    </div>
  );
}

function FormDataTable({ rows, onUpdate, onRemove, onAdd }: {
  rows: Array<{ key: string; value: string; type: 'text' | 'file'; filePath?: string }>;
  onUpdate: (index: number, field: Partial<{ key: string; value: string; type: 'text' | 'file'; filePath?: string }>) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
}) {
  const handleFilePick = async (index: number) => {
    const result = await window.api.app.showOpenDialog({ kind: 'file', title: 'Select file' });
    if (result.path) onUpdate(index, { filePath: result.path, value: result.path });
  };

  return (
    <div>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 'var(--space-2)' }}>
        <thead>
          <tr style={{ color: 'var(--color-fg-muted)', fontSize: 11 }}>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Type</th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Key</th>
            <th style={{ ...cellStyle, textAlign: 'left' }}>Value</th>
            <th style={{ ...cellStyle, width: 30 }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td style={cellStyle}>
                <select value={r.type} onChange={(e) => onUpdate(i, { type: e.target.value as 'text' | 'file' })} style={selectStyle}>
                  <option value="text">Text</option>
                  <option value="file">File</option>
                </select>
              </td>
              <td style={cellStyle}>
                <input value={r.key} onChange={(e) => onUpdate(i, { key: e.target.value })} placeholder="key" style={inputStyle} />
              </td>
              <td style={cellStyle}>
                {r.type === 'file' ? (
                  <button onClick={() => handleFilePick(i)} style={{ ...inputStyle, textAlign: 'left', cursor: 'pointer' }}>
                    {r.filePath ? r.filePath.split(/[\\/]/).pop() : 'Choose file…'}
                  </button>
                ) : (
                  <input value={r.value} onChange={(e) => onUpdate(i, { value: e.target.value })} placeholder="value" style={inputStyle} />
                )}
              </td>
              <td style={cellStyle}>
                <button onClick={() => onRemove(i)} style={removeBtnStyle}>✕</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button onClick={onAdd} style={addBtnStyle}>+ Add row</button>
    </div>
  );
}

function BinaryPicker({ filePath, contentType, onSelect, onContentTypeChange }: {
  filePath: string;
  contentType: string;
  onSelect: () => void;
  onContentTypeChange: (ct: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <button onClick={onSelect} style={addBtnStyle}>
          {filePath ? 'Change file…' : 'Choose file…'}
        </button>
        {filePath && (
          <span style={{ fontSize: 12, color: 'var(--color-fg-muted)', fontFamily: 'var(--font-mono)' }}>
            {filePath.split(/[\\/]/).pop()}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
        <label style={{ color: 'var(--color-fg-muted)', fontSize: 12 }}>Content-Type:</label>
        <input
          type="text"
          value={contentType}
          onChange={(e) => onContentTypeChange(e.target.value)}
          placeholder="application/octet-stream"
          style={{ ...inputStyle, width: 250 }}
        />
      </div>
    </div>
  );
}

const radioLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  color: 'var(--color-fg)',
  cursor: 'pointer',
  fontSize: 12,
};
const cellStyle: React.CSSProperties = { padding: 'var(--space-1) var(--space-2)', fontSize: 12 };
const selectStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
};
const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '4px 6px',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-fg)',
  fontSize: 12,
  fontFamily: 'var(--font-mono)',
};
const removeBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-fg-muted)',
  border: 'none',
  cursor: 'pointer',
  fontSize: 14,
  padding: '2px 6px',
};
const addBtnStyle: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--color-accent)',
  border: '1px dashed var(--color-border)',
  borderRadius: 'var(--radius-1)',
  padding: 'var(--space-1) var(--space-3)',
  cursor: 'pointer',
  fontSize: 12,
};
const formatBtnStyle: React.CSSProperties = {
  background: 'var(--color-bg-elevated)',
  color: 'var(--color-accent)',
  border: '1px solid var(--color-border)',
  borderRadius: 'var(--radius-1)',
  padding: 'var(--space-1) var(--space-3)',
  cursor: 'pointer',
  fontSize: 12,
};
