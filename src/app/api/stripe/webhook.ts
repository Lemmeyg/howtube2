import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || ''

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature')
  const buf = await req.arrayBuffer()
  let event

  try {
    event = stripe.webhooks.constructEvent(Buffer.from(buf), sig!, webhookSecret)
  } catch (err) {
    return NextResponse.json({ error: `Webhook Error: ${(err as Error).message}` }, { status: 400 })
  }

  // Handle event types
  switch (event.type) {
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      // TODO: Update user subscription status in DB
      console.log('Stripe subscription event:', event.type, event.data.object)
      break
    default:
      console.log('Unhandled Stripe event:', event.type)
  }

  return NextResponse.json({ received: true })
}
