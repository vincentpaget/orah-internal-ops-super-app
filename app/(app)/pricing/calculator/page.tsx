import type { Metadata } from 'next'
import PricingCalculator from '@/components/pricing/PricingCalculator'

export const metadata: Metadata = {
  title: 'Pricing Calculator · Orah Ops Hub',
}

export default function PricingCalculatorPage() {
  return <PricingCalculator />
}
