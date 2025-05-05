'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useRouter } from 'next/navigation'

export default function AdminConfigPage() {
  const [settings, setSettings] = useState({
    siteName: 'HowTube',
    maxGuidesFree: 3,
    promptTemplate: 'Summarize the video and extract key steps.',
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // TODO: Fetch real config from backend
    setLoading(false)
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setSettings({ ...settings, [e.target.name]: e.target.value })
  }

  const handleSave = () => {
    setSaving(true)
    // TODO: Save config to backend
    setTimeout(() => setSaving(false), 1000)
  }

  if (loading) return <div>Loading configuration...</div>

  return (
    <div className="py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Configuration & Prompts</h1>
      <div className="mb-6">
        <label className="block mb-2 font-semibold">Site Name</label>
        <Input name="siteName" value={settings.siteName} onChange={handleChange} className="mb-4" />
        <label className="block mb-2 font-semibold">Max Guides (Free Tier)</label>
        <Input
          name="maxGuidesFree"
          type="number"
          value={settings.maxGuidesFree}
          onChange={handleChange}
          className="mb-4"
        />
        <label className="block mb-2 font-semibold">Prompt Template</label>
        <textarea
          name="promptTemplate"
          value={settings.promptTemplate}
          onChange={handleChange}
          className="w-full border rounded p-2 mb-4"
          rows={4}
        />
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
      <Button variant="secondary" onClick={() => router.push('/admin')}>
        Back to Admin Dashboard
      </Button>
    </div>
  )
}
