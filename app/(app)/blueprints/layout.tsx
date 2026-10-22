import type { ReactNode } from 'react'
import BlueprintsShell from '@/components/blueprints/BlueprintsShell'
import { BLUEPRINTS } from '@/lib/blueprints'

export default function BlueprintsLayout({ children }: { children: ReactNode }) {
  return <BlueprintsShell blueprints={BLUEPRINTS}>{children}</BlueprintsShell>
}
