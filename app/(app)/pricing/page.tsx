import type { Metadata } from 'next'
import PricingOverview from '@/components/pricing/PricingOverview'

export const metadata: Metadata = {
  title: 'Pricing Overview · Orah Ops Hub',
}

export default function PricingPage() {
  return <PricingOverview />
}
