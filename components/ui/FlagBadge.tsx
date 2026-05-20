interface Props {
  flag: string
}

export default function FlagBadge({ flag }: Props) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      padding: '2px 8px 2px 6px',
      borderRadius: 999,
      background: 'var(--red-50)',
      color: 'var(--red-700)',
      fontSize: 12,
      lineHeight: '16px',
      fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--red-500)', flexShrink: 0 }} />
      {flag}
    </span>
  )
}
