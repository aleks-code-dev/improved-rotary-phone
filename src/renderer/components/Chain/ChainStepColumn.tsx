import React, { useState } from 'react';

interface ChainStepColumnProps {
  stepIndex: number;
  method: string;
  url: string;
  result: {
    status: number;
    statusText: string;
    headers: Array<{ key: string; value: string }>;
    bodyBase64: string;
  };
  onCopyPath: (pathExpression: string) => void;
}

export function ChainStepColumn({ stepIndex, method, url, result, onCopyPath }: ChainStepColumnProps) {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  // Parse response body
  let bodyData: any = null;
  try {
    const bodyStr = atob(result.bodyBase64);
    bodyData = JSON.parse(bodyStr);
  } catch {
    bodyData = result.bodyBase64;
  }

  const handleCopy = (path: string) => {
    navigator.clipboard.writeText(path);
    setCopiedPath(path);
    setTimeout(() => setCopiedPath(null), 1500);
  };

  return (
    <div style={{
      flex: 1,
      minWidth: 200,
      background: 'var(--color-bg-elevated)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-1)',
      overflow: 'auto',
      maxHeight: 300,
    }}>
      {/* Column title */}
      <div style={{
        fontSize: 10,
        fontWeight: 600,
        textTransform: 'uppercase',
        color: result.status >= 200 && result.status < 300
          ? 'var(--color-step-success)' : 'var(--color-step-failed)',
        padding: 'var(--space-2)',
        borderBottom: '1px solid var(--color-border)',
      }}>
        Step {stepIndex} · {method} {url} · {result.status}
      </div>

      {/* Status node */}
      <TreeNode
        label="status"
        value={result.status}
        path={`step${stepIndex}.response.status`}
        onCopy={handleCopy}
        copiedPath={copiedPath}
        depth={0}
      />

      {/* Headers */}
      <ExpandableNode label="headers" depth={0}>
        {result.headers.map((h, i) => (
          <TreeNode
            key={i}
            label={h.key}
            value={h.value}
            path={`step${stepIndex}.response.headers.${h.key}`}
            onCopy={handleCopy}
            copiedPath={copiedPath}
            depth={1}
          />
        ))}
      </ExpandableNode>

      {/* Body */}
      {typeof bodyData === 'object' && bodyData !== null ? (
        <ExpandableNode label="body" depth={0}>
          <JsonTree data={bodyData} stepIndex={stepIndex} onCopy={handleCopy} copiedPath={copiedPath} depth={1} />
        </ExpandableNode>
      ) : (
        <TreeNode
          label="body"
          value={typeof bodyData === 'string' ? bodyData.slice(0, 100) : String(bodyData)}
          path={`step${stepIndex}.response.body`}
          onCopy={handleCopy}
          copiedPath={copiedPath}
          depth={0}
        />
      )}
    </div>
  );
}

function ExpandableNode({ label, depth, children }: { label: string; depth: number; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(depth < 2);
  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          fontSize: 10,
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-fg-muted)',
          padding: '2px var(--space-2)',
          paddingLeft: `${depth * 12 + 8}px`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
      >
        <span style={{ fontSize: 8 }}>{expanded ? '▼' : '▶'}</span>
        {label}
      </div>
      {expanded && children}
    </div>
  );
}

function TreeNode({ label, value, path, onCopy, copiedPath, depth }: {
  label: string;
  value: unknown;
  path: string;
  onCopy: (path: string) => void;
  copiedPath: string | null;
  depth: number;
}) {
  const displayValue = typeof value === 'string' ? `"${value}"` : String(value);
  const isCopied = copiedPath === path;

  return (
    <div
      style={{
        fontSize: 10,
        fontFamily: 'var(--font-mono)',
        padding: '2px var(--space-2)',
        paddingLeft: `${depth * 12 + 8}px`,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}
      onMouseEnter={(e) => {
        const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement;
        if (btn) btn.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        const btn = e.currentTarget.querySelector('.copy-btn') as HTMLElement;
        if (btn) btn.style.opacity = '0';
      }}
    >
      <span style={{ color: 'var(--color-primary)', marginRight: 4 }}>{label}:</span>
      <span style={{ color: 'var(--color-fg)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {displayValue.length > 60 ? displayValue.slice(0, 60) + '…' : displayValue}
      </span>
      <button
        className="copy-btn"
        onClick={() => onCopy(`{{${path}}}`)}
        style={{
          fontSize: 9,
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-1)',
          padding: '1px 4px',
          background: 'transparent',
          color: isCopied ? 'var(--color-success)' : 'var(--color-fg-muted)',
          cursor: 'pointer',
          opacity: 0,
          transition: 'opacity 0.15s',
          flexShrink: 0,
        }}
      >
        {isCopied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function JsonTree({ data, stepIndex, onCopy, copiedPath, depth }: {
  data: any;
  stepIndex: number;
  onCopy: (path: string) => void;
  copiedPath: string | null;
  depth: number;
}) {
  if (data === null || data === undefined) {
    return <TreeNode label="" value="null" path={`step${stepIndex}.response.body`} onCopy={onCopy} copiedPath={copiedPath} depth={depth} />;
  }

  if (typeof data !== 'object') {
    return <TreeNode label="" value={data} path={`step${stepIndex}.response.body`} onCopy={onCopy} copiedPath={copiedPath} depth={depth} />;
  }

  if (Array.isArray(data)) {
    return (
      <ExpandableNode label={`[${data.length}]`} depth={depth}>
        {data.map((item, i) => (
          <JsonTreeNode key={i} data={item} basePath={`step${stepIndex}.response.body[${i}]`} onCopy={onCopy} copiedPath={copiedPath} depth={depth + 1} />
        ))}
      </ExpandableNode>
    );
  }

  return (
    <>
      {Object.entries(data).map(([key, value]) => (
        <JsonTreeNode key={key} data={value} basePath={`step${stepIndex}.response.body.${key}`} onCopy={onCopy} copiedPath={copiedPath} depth={depth} />
      ))}
    </>
  );
}

function JsonTreeNode({ data, basePath, onCopy, copiedPath, depth }: {
  data: any;
  basePath: string;
  onCopy: (path: string) => void;
  copiedPath: string | null;
  depth: number;
}) {
  if (data === null || data === undefined) {
    return <TreeNode label={basePath.split('.').pop() ?? ''} value="null" path={basePath} onCopy={onCopy} copiedPath={copiedPath} depth={depth} />;
  }

  if (typeof data !== 'object') {
    return <TreeNode label={basePath.split('.').pop() ?? ''} value={data} path={basePath} onCopy={onCopy} copiedPath={copiedPath} depth={depth} />;
  }

  const entries = Array.isArray(data)
    ? data.map((v, i) => [i.toString(), v] as const)
    : Object.entries(data);

  return (
    <ExpandableNode label={basePath.split('.').pop() ?? ''} depth={depth}>
      {entries.map(([key, value]) => {
        const childPath = Array.isArray(data) ? `${basePath}[${key}]` : `${basePath}.${key}`;
        if (typeof value === 'object' && value !== null) {
          return <JsonTreeNode key={key} data={value} basePath={childPath} onCopy={onCopy} copiedPath={copiedPath} depth={depth + 1} />;
        }
        return <TreeNode key={key} label={key} value={value} path={childPath} onCopy={onCopy} copiedPath={copiedPath} depth={depth + 1} />;
      })}
    </ExpandableNode>
  );
}
