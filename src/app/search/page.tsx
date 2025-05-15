'use client'
import { useEffect, useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Grid } from '@/components/ui/Grid'
import { Loading } from '@/components/ui/Loading'
import GuideCard from '@/components/guide/GuideCard'
import { supabase } from '@/lib/supabase/client'
import { GuideMetadata } from '@/lib/guide/types'

function SearchContent() {
  const router = useRouter()
  const params = useSearchParams()
  const initialQuery = params.get('q') || ''
  const [query, setQuery] = useState(initialQuery)
  const [guides, setGuides] = useState<GuideMetadata[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)

  useEffect(() => {
    if (query) {
      setLoading(true)
      setError('')
      ;(async () => {
        try {
          const { data, error } = await supabase
            .from('video_guides')
            .select('*')
            .eq('status', 'completed')
            .ilike('title', `%${query}%`)
          if (error) setError(error.message)
          else setGuides(data as GuideMetadata[])
        } finally {
          setLoading(false)
        }
      })()
    } else {
      setGuides([])
    }
  }, [query])

  useEffect(() => {
    // Load recent searches from localStorage
    if (typeof window !== 'undefined') {
      const recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
      setSuggestions(recent)
    }
  }, [])

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (!query) return
    // Save to recent searches
    if (typeof window !== 'undefined') {
      let recent = JSON.parse(localStorage.getItem('recentSearches') || '[]')
      recent = [query, ...recent.filter((q: string) => q !== query)].slice(0, 5)
      localStorage.setItem('recentSearches', JSON.stringify(recent))
    }
    router.replace(`/search?q=${encodeURIComponent(query)}`)
    setShowSuggestions(false)
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value)
    setShowSuggestions(true)
    // Live suggestions from guide titles
    supabase
      .from('video_guides')
      .select('title')
      .eq('status', 'completed')
      .ilike('title', `%${e.target.value}%`)
      .then(({ data }) => {
        if (data) {
          const titles = data.map((g: { title: string }) => g.title)
          setSuggestions(prev => Array.from(new Set([...titles, ...prev])).slice(0, 5))
        }
      })
  }

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-4">Search Guides</h1>
      <form onSubmit={handleSearch} className="mb-6 relative max-w-xl">
        <Input
          placeholder="Search guides..."
          value={query}
          onChange={handleInput}
          onFocus={() => setShowSuggestions(true)}
          aria-label="Search guides"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 bg-white border rounded shadow z-10 mt-1 max-h-48 overflow-auto">
            {suggestions
              .filter(s => s.toLowerCase().includes(query.toLowerCase()))
              .map(s => (
                <li
                  key={s}
                  className="px-4 py-2 hover:bg-accent cursor-pointer"
                  onMouseDown={() => {
                    setQuery(s)
                    setShowSuggestions(false)
                  }}
                >
                  {s}
                </li>
              ))}
          </ul>
        )}
      </form>
      {loading ? (
        <Loading message="Searching guides..." />
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : guides.length === 0 && query ? (
        <div className="text-muted-foreground">No guides found for &quot;{query}&quot;.</div>
      ) : (
        <Grid cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" gap="gap-6">
          {guides.map(guide => (
            <GuideCard key={guide.id} guide={guide} />
          ))}
        </Grid>
      )}
    </div>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div>Loading search...</div>}>
      <SearchContent />
    </Suspense>
  )
}
