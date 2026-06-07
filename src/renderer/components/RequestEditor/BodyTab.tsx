import { useEffect, useRef, useCallback, useState } from 'react';
import Editor from '@monaco-editor/react';
import type { editor as MonacoEditor } from 'monaco-editor';
import { useRequest, type BodyMode, type RawContentType, type RequestBody } from '../../state/useRequest';
import { useDbSelection } from '../../store/dbSelection';
import { useEndpointsStore } from '../../store/endpoints';
import { formatText } from '../../lib/monaco';
import { toCamelCase, buildReverseCamelCaseMapping } from '../../lib/textCase';
import { isFkField, toSnakeCaseFk } from '../../lib/fkDetect';
import { FkLookupDialog } from '../Database/FkLookupDialog';
import { CycleWarningBanner } from '../BodyEditor/CycleWarningBanner';
import { PillBar, type PillItem } from '../ui/PillBar';
import './BodyTab.css';

type BodyModeKey = 'none' | 'form-data' | 'url-encoded' | 'raw' | 'binary';

const MODE_ITEMS: PillItem<BodyModeKey>[] = [
  { id: 'none', label: 'None' },
  { id: 'form-data', label: 'form-data' },
  { id: 'url-encoded', label: 'x-www-form-urlencoded' },
  { id: 'raw', label: 'raw' },
  { id: 'binary', label: 'binary' },
];

const KEY_TO_MODE: Record<BodyModeKey, BodyMode> = {
  'none': 'none',
  'form-data': 'form-data',
  'url-encoded': 'urlencoded',
  'raw': 'raw',
  'binary': 'binary',
};

interface BodyTabProps {
  tabId: string;
  onEditorMount?: (editor: any, monaco: any) => void;
}

const CONTENT_TYPES: RawContentType[] = ['application/json', 'application/xml', 'text/plain', 'application/graphql'];

export function BodyTab({ tabId, onEditorMount }: BodyTabProps) {
  const spec = useRequest((s) => s.specs[tabId]);
  const setBody = useRequest((s) => s.setBody);
  const body = spec?.body ?? { mode: 'none' as const };

  const selectedConnectionId = useDbSelection((s) => s.selectedConnectionId);
  const selectedTableName = useDbSelection((s) => s.selectedTableName);
  const selectedRow = useDbSelection((s) => s.selectedRow);

  const handleModeChange = (key: BodyModeKey) => {
    const mode = KEY_TO_MODE[key];
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

  const activeModeKey: BodyModeKey =
    body.mode === 'urlencoded' ? 'url-encoded' : (body.mode as BodyModeKey);

  const handleFormat = useCallback(async () => {
    if (body.mode === 'raw' && (body.contentType === 'application/json' || body.contentType === 'application/xml')) {
      const formatted = await formatText(body.text, body.contentType === 'application/json' ? 'json' : 'xml');
      setBody(tabId, { ...body, text: formatted });
    }
  }, [body, tabId, setBody]);

  // DTO body generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [cycleRefs, setCycleRefs] = useState<string[]>([]);
  const [selectedSubtype, setSelectedSubtype] = useState<string | null>(null);
  const [helperOnline, setHelperOnline] = useState(false);
  const [dtoError, setDtoError] = useState<string | null>(null);
  const [isGeneratingRow, setIsGeneratingRow] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [isMerging, setIsMerging] = useState(false);
  const [mergeError, setMergeError] = useState<string | null>(null);
  const [lastMergeResult, setLastMergeResult] = useState<{ count: number; fields: string[] } | null>(null);

  // FK lookup state
  const [fkDialogOpen, setFkDialogOpen] = useState(false);
  const [fkTargetKey, setFkTargetKey] = useState<string | null>(null);
  const [fkSearchTerm, setFkSearchTerm] = useState('');
  const [fkTables, setFkTables] = useState<Array<{ name: string; schema: string | null; columnCount: number; rowCountEstimate: number }>>([]);
  const [fkTablesLoading, setFkTablesLoading] = useState(false);

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const highlightDecorationRef = useRef<string[] | null>(null);
  const fkLensDisposableRef = useRef<MonacoEditor.IDisposable | null>(null);
  const fkChannelRef = useRef<((key: string) => void) | null>(null);

  const handleFkLookup = useCallback(async (key: string) => {
    setFkTargetKey(key);
    setFkSearchTerm(toSnakeCaseFk(key));
    setFkDialogOpen(true);
    setFkTables([]);
    setFkTablesLoading(true);
    if (selectedConnectionId) {
      try {
        const result = await window.api.db.listTables({ connectionId: selectedConnectionId });
        setFkTables(result ?? []);
      } catch {
        setFkTables([]);
      } finally {
        setFkTablesLoading(false);
      }
    } else {
      setFkTablesLoading(false);
    }
  }, [selectedConnectionId]);

  const handleFkRowSelected = useCallback((row: Record<string, unknown>) => {
    if (!fkTargetKey || body.mode !== 'raw') return;
    try {
      const parsed = JSON.parse(body.text);
      // Use the first column value as the FK value
      const firstValue = Object.values(row)[0];
      parsed[fkTargetKey] = firstValue ?? null;
      const formatted = JSON.stringify(parsed, null, 2);
      setBody(tabId, { ...body, text: formatted });
    } catch { /* invalid JSON, skip */ }
  }, [fkTargetKey, body, tabId, setBody]);

  const handleEditorMount = useCallback((editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    onEditorMount?.(editor, monaco);
  }, [onEditorMount]);

  // Keep fkChannelRef in sync with the latest handleFkLookup
  useEffect(() => {
    fkChannelRef.current = (key: string) => handleFkLookup(key);
  }, [handleFkLookup]);

  // Register Monaco CodeLens provider for FK fields (inline buttons at end of line)
  useEffect(() => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco) return;
    if (body.mode !== 'raw' || body.contentType !== 'application/json') return;

    // Dispose previous provider
    fkLensDisposableRef.current?.dispose();

    const languageId = 'json';
    fkLensDisposableRef.current = monaco.languages.registerCodeLensProvider(languageId, {
      provideCodeLenses: (model: any) => {
        const lenses: any[] = [];
        const lineCount = model.getLineCount();

        for (let line = 1; line <= lineCount; line++) {
          const lineText = model.getLineContent(line);
          // Match root-level FK keys: "  "key": value  (2-space indent, quoted key)
          const match = lineText.match(/^  "(\w+)"\s*:/);
          if (!match) continue;
          const key = match[1];
          if (!isFkField(key)) continue;

          const lineLen = lineText.length;
          lenses.push({
            range: new monaco.Range(line, lineLen, line, lineLen),
            command: {
              id: 'fkLookup.open',
              title: `lookup`,
              arguments: [key],
            },
          });
        }

        return { lenses, dispose: () => {} };
      },
      dispose: () => {},
    });

    // Register the command via monaco.commands (not editor.addCommand)
    const cmdDisposable = monaco.commands.registerCommand('fkLookup.open', (key: string) => {
      fkChannelRef.current?.(key);
    });

    return () => {
      fkLensDisposableRef.current?.dispose();
      fkLensDisposableRef.current = null;
      cmdDisposable?.dispose();
    };
  }, [body]);

  /**
   * Highlight matched field lines in the editor with a 3-second fade-out.
   * Finds lines containing the given field names as JSON keys.
   */
  const highlightMatchedLines = useCallback((fieldNames: string[]) => {
    const editor = editorRef.current;
    const monaco = monacoRef.current;
    if (!editor || !monaco || !fieldNames.length) return;

    const model = editor.getModel();
    if (!model) return;

    const lineCount = model.getLineCount();
    const decorations: any[] = [];

    for (let line = 1; line <= lineCount; line++) {
      const lineText = model.getLineContent(line);
      // Only match root-level keys: line must start with exactly 2 spaces + quote
      if (!lineText.match(/^  "/)) continue;
      for (const field of fieldNames) {
        const pattern = `"${field}"`;
        if (lineText.includes(pattern)) {
          decorations.push({
            range: new monaco.Range(line, 1, line, lineText.length + 1),
            options: {
              isWholeLine: true,
              className: 'monaco-matched-field-highlight',
            },
          });
          break;
        }
      }
    }

    // Remove previous highlight decorations
    if (highlightDecorationRef.current) {
      editor.deltaDecorations(highlightDecorationRef.current, []);
    }

    highlightDecorationRef.current = editor.deltaDecorations([], decorations);

    // Clear after 3 seconds
    setTimeout(() => {
      if (highlightDecorationRef.current) {
        editor.deltaDecorations(highlightDecorationRef.current, []);
        highlightDecorationRef.current = null;
      }
    }, 3000);
  }, []);

  const activeProjectPath = useEndpointsStore((s) => s.activeProjectPath);

  useEffect(() => {
    window.api.helper.getStatus().then((s: any) => setHelperOnline(s.state === 'healthy'));
    const unsub = window.api.helper.onStatus((s: any) => setHelperOnline(s.state === 'healthy'));
    return unsub;
  }, []);

  // Ctrl/Cmd+G keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'g') {
        e.preventDefault();
        handleGenerateDto();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  });

  const handleGenerateDto = useCallback(async () => {
    if (!spec?.detectedDto || isGenerating) return;
    setIsGenerating(true);
    setCycleRefs([]);
    setDtoError(null);
    try {
      const result = await window.api.body.generateDto({
        requestId: spec.requestId,
        dtoFqn: spec.detectedDto.fqn,
        subtypeName: selectedSubtype ?? undefined,
        projectRoot: activeProjectPath ?? undefined,
      });
      if (result.ok) {
        const formatted = formatJson(result.bodyJson);
        setBody(tabId, { mode: 'raw', contentType: 'application/json', text: formatted });
        if (result.cycleRefs?.length > 0) {
          setCycleRefs(result.cycleRefs);
        }
      } else {
        const warnings = (result.warnings ?? []) as Array<{ code: string; message: string }>;
        const msg = warnings.map((w) => w.message).join('; ') || 'DTO generation failed';
        setDtoError(msg);
      }
    } catch (err: any) {
      setDtoError(err?.message ?? 'DTO generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [spec, tabId, selectedSubtype, isGenerating, setBody, activeProjectPath]);

  /**
   * Merge DB row values into the existing DTO JSON body.
   * - Converts DB field names (snake_case) to camelCase
   * - Matches them with DTO JSON field names
   * - Assigns DB values to matched DTO fields
   * - Tracks which fields were matched for visual indicator
   */
  const handleMergeFromDb = useCallback(async () => {
    if (!spec?.detectedDto?.fqn || !selectedRow || isMerging) return;
    setIsMerging(true);
    setMergeError(null);
    setLastMergeResult(null);

    try {
      // Build reverse mapping: camelCase -> original DB key
      const reverseMapping = buildReverseCamelCaseMapping(selectedRow.row);

      // Get current DTO body as object
      let dtoBody: Record<string, any> = {};
      try {
        if (body.mode === 'raw' && body.text) {
          dtoBody = JSON.parse(body.text);
        }
      } catch {
        setMergeError('Current body is not valid JSON. Generate from DTO first.');
        return;
      }

      if (typeof dtoBody !== 'object' || dtoBody === null || Array.isArray(dtoBody)) {
        setMergeError('Current body is not a valid JSON object. Generate from DTO first.');
        return;
      }

      // Merge loop: for each DTO field, try to find matching DB value
      const matchedFields: string[] = [];
      const mergedBody = { ...dtoBody };

      for (const dtoKey of Object.keys(dtoBody)) {
        const camelDbKey = toCamelCase(dtoKey);
        const originalDbKey = reverseMapping[camelDbKey];

        if (originalDbKey !== undefined && originalDbKey in selectedRow.row) {
          const dbValue = selectedRow.row[originalDbKey];
          if (dbValue !== null && dbValue !== undefined) {
            mergedBody[dtoKey] = dbValue;
            matchedFields.push(dtoKey);
          }
        }
      }

      const formatted = JSON.stringify(mergedBody, null, 2);

      setBody(tabId, {
        mode: 'raw',
        contentType: 'application/json',
        text: formatted,
      });

      setLastMergeResult({ count: matchedFields.length, fields: matchedFields });

      // Highlight matched lines in editor after React re-render
      setTimeout(() => {
        highlightMatchedLines(matchedFields);
      }, 50);
    } catch (err: any) {
      setMergeError(err?.message ?? 'Merge from DB failed');
    } finally {
      setIsMerging(false);
    }
  }, [spec, selectedRow, isMerging, body, tabId, setBody]);

  const handleGenerateFromRow = useCallback(async () => {
    if (!spec?.detectedDto?.fqn || !selectedConnectionId || !selectedTableName || !selectedRow || isGeneratingRow) return;
    setIsGeneratingRow(true);
    setRowError(null);
    try {
      const result = await window.api.db.mapRowToDto({
        connectionId: selectedConnectionId,
        tableName: selectedTableName,
        rowId: selectedRow.row,
        dtoFqn: spec.detectedDto.fqn,
      });
      if (result.ok) {
        const formatted = formatJson(result.bodyJson);
        setBody(tabId, { mode: 'raw', contentType: 'application/json', text: formatted });
      } else {
        setRowError((result as any)?.error ?? 'Failed to generate from row');
      }
    } catch (err: any) {
      setRowError(err?.message ?? 'Failed to generate from row');
    } finally {
      setIsGeneratingRow(false);
    }
  }, [spec, selectedConnectionId, selectedTableName, selectedRow, isGeneratingRow, tabId, setBody]);

  return (
    <div style={{ padding: 'var(--space-3)', overflow: 'auto', fontSize: 12 }}>
      {/* Mode switcher (D-14) — 003-A pill bar */}
      <PillBar items={MODE_ITEMS} activeId={activeModeKey} onChange={handleModeChange} style={{ marginBottom: 'var(--ds-space-3)' }} />

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

          {/* DTO Generate button — visible when DTO detected */}
          {spec?.detectedDto && body.contentType === 'application/json' && (
            <>
              {/* DTO name badge — shows the request body schema class name */}
              <span
                title={`Request body: ${spec.detectedDto.fqn}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 'var(--ds-space-1)',
                  padding: '2px var(--ds-space-2)',
                  background: 'var(--ds-surface)',
                  border: '1px solid var(--ds-border)',
                  borderRadius: 'var(--ds-radius-1)',
                  fontSize: 'var(--ds-text-xs)',
                  fontFamily: 'var(--ds-font-mono)',
                  color: 'var(--ds-text-muted)',
                  maxWidth: 280,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                <span style={{ color: 'var(--ds-text-muted)', fontWeight: 600, fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.4 }}>DTO</span>
                <span style={{ color: 'var(--ds-text)' }}>{spec.detectedDto.simpleName}</span>
              </span>
              {/* D-03: Subtype dropdown for polymorphic DTOs */}
              {(spec?.detectedSubtypes?.length ?? 0) > 1 && (
                <select
                  value={selectedSubtype ?? spec.detectedSubtypes![0]}
                  onChange={(e) => setSelectedSubtype(e.target.value)}
                  style={selectStyle}
                >
                  {spec.detectedSubtypes!.map((st: string) => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              )}
              <button
                onClick={handleGenerateDto}
                disabled={!helperOnline || isGenerating}
                title={!helperOnline ? 'Helper is offline — body generation unavailable' : 'Generate JSON body from DTO schema (Ctrl+G)'}
                style={{
                  ...formatBtnStyle,
                  color: 'var(--color-accent)',
                  borderColor: 'var(--color-accent)',
                  fontWeight: 600,
                }}
              >
                {isGenerating ? 'Generating...' : 'Generate from DTO'}
              </button>
              {dtoError && (
                <span style={{ color: 'var(--ds-method-delete)', fontSize: 11, marginLeft: 'var(--space-2)' }} title={dtoError}>
                  {dtoError}
                </span>
              )}
              {selectedConnectionId && selectedTableName && selectedRow && (
                <>
                  {/* Merge from DB — client-side merge, no helper needed */}
                  <button
                    onClick={handleMergeFromDb}
                    disabled={isMerging || !body.text}
                    title={!body.text ? 'Generate a DTO body first' : 'Map DB row values into the current DTO body (camelCase matching)'}
                    style={{
                      ...formatBtnStyle,
                      color: 'var(--ds-success)',
                      borderColor: 'var(--ds-success)',
                      fontWeight: 600,
                    }}
                  >
                    {isMerging ? 'Merging…' : 'Merge from DB'}
                  </button>
                  {mergeError && (
                    <span style={{ color: 'var(--ds-method-delete)', fontSize: 11, marginLeft: 'var(--space-2)' }} title={mergeError}>
                      {mergeError}
                    </span>
                  )}
                  {lastMergeResult && !mergeError && (
                    <span
                      style={{
                        background: 'var(--ds-success)',
                        color: '#fff',
                        fontSize: 'var(--ds-text-2xs)',
                        fontWeight: 600,
                        padding: '2px 6px',
                        borderRadius: 'var(--ds-radius-full, 999px)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginLeft: 'var(--space-2)',
                      }}
                      title={`Matched fields: ${lastMergeResult.fields.join(', ')}`}
                    >
                      {lastMergeResult.count} matched
                    </span>
                  )}
                  <button
                    onClick={handleGenerateFromRow}
                    disabled={!helperOnline || isGeneratingRow}
                    title={'Use selected row from ' + selectedTableName + ' as body'}
                    style={{
                      ...formatBtnStyle,
                      color: 'var(--color-accent)',
                      borderColor: 'var(--color-accent)',
                      fontWeight: 600,
                    }}
                  >
                    {isGeneratingRow ? 'Generating…' : 'Generate from DB row'}
                  </button>
                  {rowError && (
                    <span style={{ color: 'var(--ds-method-delete)', fontSize: 11, marginLeft: 'var(--space-2)' }}>
                      {rowError}
                    </span>
                  )}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Cycle warning banner */}
      {cycleRefs.length > 0 && (
        <CycleWarningBanner cycleRefs={cycleRefs} onDismiss={() => setCycleRefs([])} />
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
            onMount={handleEditorMount}
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

      {/* FK Lookup Dialog */}
      <FkLookupDialog
        isOpen={fkDialogOpen}
        onClose={() => setFkDialogOpen(false)}
        onSelectRow={handleFkRowSelected}
        connectionId={selectedConnectionId}
        searchTerm={fkSearchTerm}
        tables={fkTables}
        loadingTables={fkTablesLoading}
      />
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

function formatJson(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2);
  } catch {
    return json;
  }
}

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
