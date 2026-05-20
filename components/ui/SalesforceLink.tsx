interface Props {
  label: string
  opportunityId: string
}

export default function SalesforceLink({ label, opportunityId }: Props) {
  return (
    <a
      href={`https://orah.lightning.force.com/lightning/r/Opportunity/${opportunityId}/view`}
      target="_blank"
      rel="noopener noreferrer"
      style={{ color: 'var(--blue-500)', fontWeight: 600, textDecoration: 'none' }}
    >
      {label}
    </a>
  )
}
