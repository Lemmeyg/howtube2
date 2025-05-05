import { NextResponse } from 'next/server'

// Example static plans. Replace with Stripe API fetch if needed.
const plans = [
  {
    id: 'price_basic',
    name: 'Basic',
    price: 0,
    interval: 'month',
    features: ['Limited usage', 'Community support'],
  },
  {
    id: 'price_pro',
    name: 'Pro',
    price: 20,
    interval: 'month',
    features: ['Unlimited usage', 'Priority support', 'Premium features'],
  },
]

export async function GET() {
  return NextResponse.json({ plans })
}
