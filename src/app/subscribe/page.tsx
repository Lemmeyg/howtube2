'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

interface Plan {
  id: string
  name: string
  price: number
  interval: string
  features: string[]
}

export default function SubscribePage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [subscribing, setSubscribing] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/stripe/plans')
      .then(res => res.json())
      .then(data => setPlans(data.plans))
      .catch(() => setError('Failed to load plans'))
      .finally(() => setLoading(false))
  }, [])

  const handleSubscribe = async (priceId: string) => {
    setSubscribing(priceId)
    try {
      // TODO: Replace with real user ID/email from auth context
      const userId = 'test@example.com'
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId, userId }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setError(data.error || 'Failed to start checkout')
      }
    } catch {
      setError('Failed to start checkout')
    } finally {
      setSubscribing(null)
    }
  }

  if (loading) return <div>Loading plans...</div>
  if (error) return <div className="text-red-600">{error}</div>

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Choose a Subscription Plan</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {plans.map(plan => (
          <div key={plan.id} className="border rounded-lg p-6 flex flex-col">
            <h2 className="text-xl font-semibold mb-2">{plan.name}</h2>
            <div className="text-2xl font-bold mb-2">
              {plan.price === 0 ? 'Free' : `$${plan.price}/${plan.interval}`}
            </div>
            <ul className="mb-4 list-disc list-inside text-sm">
              {plan.features.map(f => (
                <li key={f}>{f}</li>
              ))}
            </ul>
            <Button onClick={() => handleSubscribe(plan.id)} disabled={!!subscribing}>
              {subscribing === plan.id
                ? 'Redirecting...'
                : plan.price === 0
                  ? 'Start Free'
                  : 'Subscribe'}
            </Button>
          </div>
        ))}
      </div>
    </div>
  )
}
