// GTM Blueprints: maps of Orah's core GTM processes, designed in Claude Design.
// Each blueprint is a standalone HTML export in content/blueprints/, served to
// signed-in users by app/api/blueprints/[slug]/route.ts. To add one: export the
// design as standalone HTML, save it in content/blueprints/, and add a line here.

export interface Blueprint {
  slug: string
  title: string
  description: string
  /** File name in content/blueprints/ */
  file: string
}

export const BLUEPRINTS: Blueprint[] = [
  {
    slug: 'sales-new-business',
    title: 'Sales Process: New Business',
    description: 'How a new business opportunity moves from first conversation to Closed Won.',
    file: 'sales-new-business.html',
  },
  {
    slug: 'sales-renewal-expansion',
    title: 'Sales Process: Renewal & Expansion',
    description: 'How renewals and expansions are run with existing customers.',
    file: 'sales-renewal-expansion.html',
  },
]

/** Blueprint shown when the tool is opened. */
export const DEFAULT_BLUEPRINT_SLUG = 'sales-new-business'

export function findBlueprint(slug: string): Blueprint | undefined {
  return BLUEPRINTS.find(b => b.slug === slug)
}
