import { headerStyle, mutedStyle } from './CollectionsTree';

const SCOPES = [
  { scope: 'Local', description: 'Runtime variables (set via scripts in v2)' },
  { scope: 'Data', description: 'Data variables (from file imports)' },
  { scope: 'Env', description: 'Active environment variables' },
  { scope: 'Collection', description: 'Collection-level variables' },
  { scope: 'Global', description: 'Global variables (persisted to globals.json)' },
];

export function VariablesTab() {
  return (
    <div>
      <div style={headerStyle}>Variables</div>
      {SCOPES.map(({ scope, description }) => (
        <div key={scope} style={{ marginBottom: 'var(--space-3)' }}>
          <div style={{
            fontWeight: 600,
            fontSize: 11,
            color: 'var(--color-fg)',
            marginBottom: 'var(--space-1)',
          }}>
            {scope}
          </div>
          <div style={mutedStyle}>
            {description}
          </div>
          <div style={{
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-1)',
            overflow: 'hidden',
            marginTop: 'var(--space-1)',
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-tertiary)' }}>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Value</th>
                  <th style={thStyle}>Source</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={tdStyle} colSpan={3}>
                    <span style={{ color: 'var(--color-fg-muted)', fontStyle: 'italic' }}>
                      No {scope.toLowerCase()} variables
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  textAlign: 'left',
  fontWeight: 600,
  fontSize: 10,
  color: 'var(--color-fg-muted)',
  borderBottom: '1px solid var(--color-border)',
};

const tdStyle: React.CSSProperties = {
  padding: 'var(--space-1) var(--space-2)',
  borderBottom: '1px solid var(--color-border)',
  color: 'var(--color-fg-muted)',
};
