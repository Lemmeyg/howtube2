'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

export default function SubscriptionManagement() {
  const [plan, setPlan] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Fetch current plan from backend/Stripe
    setPlan('Pro')
    setLoading(false)
  }, [])

  const handleManageBilling = async () => {
    // TODO: Redirect to Stripe customer portal
    alert('Redirecting to Stripe customer portal (not implemented)')
  }

  if (loading) return <div>Loading subscription...</div>

  return (
    <div className="border rounded-lg p-6 mb-8">
      <h2 className="text-xl font-semibold mb-2">Subscription</h2>
      <div className="mb-2">
        Current plan: <span className="font-bold">{plan}</span>
      </div>
      <Button onClick={handleManageBilling}>Manage Billing</Button>
      {/* TODO: Show billing history, invoices, cancel/downgrade options */}
    </div>
  )
}
