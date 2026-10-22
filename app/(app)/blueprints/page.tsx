import { redirect } from 'next/navigation'
import { DEFAULT_BLUEPRINT_SLUG } from '@/lib/blueprints'

// Opening the tool goes straight to the default blueprint; the list sits on the left.
export default function BlueprintsPage() {
  redirect(`/blueprints/${DEFAULT_BLUEPRINT_SLUG}`)
}
