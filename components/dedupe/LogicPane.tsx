'use client'

export default function LogicPane() {
  const stepNum = (n: number) => (
    <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--orange-500)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, flexShrink: 0 }}>
      {n}
    </div>
  )

  const card = (children: React.ReactNode) => (
    <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 8, padding: '16px 18px', marginBottom: 10 }}>
      {children}
    </div>
  )

  const head = (n: number, title: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
      {stepNum(n)}
      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--fg-1)' }}>{title}</div>
    </div>
  )

  const desc = (children: React.ReactNode) => (
    <div style={{ fontSize: 13, color: 'var(--fg-3)', paddingLeft: 34, lineHeight: 1.6 }}>{children}</div>
  )

  const badge = (cls: string, text: string) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 99, fontSize: 11, fontWeight: 600, ...badgeStyle(cls) }}>
      {text}
    </span>
  )

  function badgeStyle(cls: string): React.CSSProperties {
    if (cls === 'master') return { background: '#dcfce7', color: '#166534' }
    if (cls === 'victim') return { background: '#fee2e2', color: '#991b1b' }
    if (cls === 'conflict') return { background: 'var(--purple-50)', color: 'var(--purple-500)' }
    if (cls === 'nosf') return { background: '#fef9c3', color: '#854d0e' }
    if (cls === 'ignored') return { background: 'var(--bg-subtle)', color: 'var(--fg-3)' }
    if (cls === 'merged') return { background: '#dcfce7', color: '#166534' }
    if (cls === 'error') return { background: 'var(--red-50)', color: 'var(--red-600)' }
    return {}
  }

  const th: React.CSSProperties = { textAlign: 'left', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--fg-3)', padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'var(--bg-subtle)', whiteSpace: 'nowrap' }
  const td: React.CSSProperties = { padding: '7px 10px', borderBottom: '1px solid var(--border)', fontSize: 13, color: 'var(--fg-2)', verticalAlign: 'top' }
  const tableStyle: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8, border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }

  return (
    <div style={{ padding: '22px 24px', overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 17, fontWeight: 700, color: 'var(--fg-1)', marginBottom: 6 }}>Merge Logic Reference</div>
      <div style={{ fontSize: 13, color: 'var(--fg-3)', marginBottom: 20 }}>
        How duplicates are identified, clustered, and merged. For reference only — no actions are taken here.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {card(<>
          {head(1, 'Data Source')}
          {desc(<>
            The CSV is exported from HubSpot → <strong>Companies → Actions → Manage Duplicates</strong>.
            Each row represents one duplicate <em>pair</em> that HubSpot's deduplication engine has flagged (ID_1 vs ID_2).
            The export includes company properties for both records: name, Salesforce ID, contacts, deals, owner, website, location, and creation date.
          </>)}
        </>)}

        {card(<>
          {head(2, 'Clustering (Union-Find)')}
          {desc(<>
            Individual pairs are joined into clusters using a <strong>union-find</strong> (disjoint-set) algorithm.
            If the CSV says A=B and B=C, all three end up in one cluster — so a single merge resolves all relationships transitively.
            Each cluster has one {badge('master', 'Master')} and one or more {badge('victim', 'Victim')} records.
          </>)}
        </>)}

        {card(<>
          {head(3, 'Master Selection Rules')}
          {desc(<div style={{ marginBottom: 8 }}>Applied in priority order — first rule that produces a clear winner wins:</div>)}
          <table style={{ ...tableStyle, marginLeft: 34 }}>
            <thead><tr>
              <th style={th}>#</th><th style={th}>Condition</th><th style={th}>Result</th>
            </tr></thead>
            <tbody>
              {[
                ['1', 'Only one record has a Salesforce ID', 'That record is master — unambiguous'],
                ['2', 'Multiple SF IDs, only one has active deals', 'The record with deals is master'],
                ['3', 'Multiple SF IDs, multiple have deals', <>{badge('conflict', '⚠ Conflict')} — requires manual selection</>],
                ['4', 'No records have a Salesforce ID', <>{badge('nosf', 'No SF record')} — SF step skipped</>],
                ['5', 'Tiebreaker (within candidates)', 'Most contacts → then lower (older) HubSpot ID'],
              ].map(([n, cond, res], i) => (
                <tr key={i}>
                  <td style={td}>{n}</td>
                  <td style={td}>{cond}</td>
                  <td style={td}>{res}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 12, color: 'var(--fg-3)', marginTop: 6, paddingLeft: 34 }}>
            You can override the master by clicking any victim row in the Review tab — the selected row turns green, others turn red. This does not re-sort the table.
          </div>
        </>)}

        {card(<>
          {head(4, 'Flags & Filters')}
          <table style={{ ...tableStyle, marginLeft: 34 }}>
            <thead><tr>
              <th style={th}>Flag / Filter</th><th style={th}>Meaning</th><th style={th}>Action required</th>
            </tr></thead>
            <tbody>
              {[
                [badge('conflict', '⚠ Conflict'), 'Multiple records with SF IDs and active deals', 'Manually click a row to set master'],
                [badge('nosf', 'No SF record'), 'No record in the cluster has a Salesforce ID', 'HubSpot merge still runs; SF step is automatically skipped'],
                [badge('ignored', '⊘ Ignored'), 'Cluster manually excluded from merge', 'Click Unignore to restore'],
                [badge('merged', '✓ Merged'), 'All 3 steps completed successfully', 'Card is read-only; visible under the Merged filter'],
                [<span key="e" style={{ fontSize: 11, fontWeight: 700, color: 'var(--red-600)' }}>✗ Error</span>, 'One or more steps encountered an API error', 'Check Activity Log; can re-run the cluster'],
              ].map(([flag, meaning, action], i) => (
                <tr key={i}>
                  <td style={td}>{flag}</td>
                  <td style={td}>{meaning}</td>
                  <td style={td}>{action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>)}

        {card(<>
          {head(5, '3-Step Merge Process')}
          {desc(<div style={{ marginBottom: 8 }}>Clicking <strong>▶ Merge</strong> on a cluster card runs all three steps sequentially:</div>)}
          <table style={{ ...tableStyle, marginLeft: 34 }}>
            <thead><tr>
              <th style={{ ...th, width: '16%' }}>Step</th>
              <th style={{ ...th, width: '60%' }}>What it does</th>
              <th style={{ ...th, width: '24%' }}>API</th>
            </tr></thead>
            <tbody>
              <tr>
                <td style={td}><strong>1 — SF Merge</strong></td>
                <td style={{ ...td, whiteSpace: 'normal' }}>Merges each victim Salesforce Account into the master Account. Contacts, opportunities, and activities on the victim are moved to the master by Salesforce automatically. If two accounts share the same contact (an AccountContactRelation conflict), the duplicate ACR on the victim is deleted first, then the merge is retried.</td>
                <td style={td}>Salesforce SOAP merge + REST ACR delete</td>
              </tr>
              <tr>
                <td style={td}><strong>2 — HS Contact Remap</strong></td>
                <td style={{ ...td, whiteSpace: 'normal' }}>For each victim company, fetches its associated contacts via the live v4 Associations API, removes those associations from the victim, then creates them on the master. Uses association type 280 (company→contact primary). Only targeted victim links are removed — other company associations on the same contacts are untouched.</td>
                <td style={td}>HubSpot CRM v4 Associations batch/archive + batch/create</td>
              </tr>
              <tr>
                <td style={td}><strong>3 — Mark for Deletion</strong></td>
                <td style={{ ...td, whiteSpace: 'normal' }}>Checks live contact counts on each victim using the v4 Associations API (not the cached <code>num_associated_contacts</code> property). Sets <code>to_be_deleted = true</code> on victims with 0 contacts. Victims that still have contacts are skipped and flagged in the log for manual investigation.</td>
                <td style={td}>HubSpot CRM v3 Companies batch/update</td>
              </tr>
            </tbody>
          </table>
        </>)}

        {card(<>
          {head(6, 'Important Caveats')}
          <ul style={{ fontSize: 13, color: 'var(--fg-3)', paddingLeft: 54, lineHeight: 1.8 }}>
            <li>Contact counts shown in the table come from the CSV export and may be stale. Live counts are fetched at Step 3.</li>
            <li>The <code>to_be_deleted</code> field must be manually reviewed and records deleted separately — this tool only flags them.</li>
            <li>Salesforce merge is irreversible via this tool. Review the master carefully before merging conflict clusters.</li>
            <li>If a cluster is in the Needs Review filter (no SF record), the SF merge step is silently skipped — HubSpot contacts are still remapped.</li>
            <li>Removing a record from a cluster via ✕ only excludes it from this tool's pipeline. No changes are made to HubSpot or Salesforce at that point.</li>
          </ul>
        </>)}

      </div>
    </div>
  )
}
