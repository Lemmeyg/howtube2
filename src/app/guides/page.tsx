'use client'
import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Grid } from '@/components/ui/Grid'
import { Loading } from '@/components/ui/Loading'
import GuideCard from '@/components/guide/GuideCard'
import { supabase } from '@/lib/supabase/client'
import { GuideMetadata } from '@/lib/guide/types'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const SORT_OPTIONS = [
  { value: 'createdAt', label: 'Newest' },
  { value: 'title', label: 'Title' },
]
const DIFFICULTY_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'beginner', label: 'Beginner' },
  { value: 'intermediate', label: 'Intermediate' },
  { value: 'advanced', label: 'Advanced' },
]

export default function GuideLibraryPage() {
  const [guides, setGuides] = useState<GuideMetadata[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [sort, setSort] = useState('createdAt')
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 9

  useEffect(() => {
    const fetchGuides = async () => {
      setLoading(true)
      setError('')
      try {
        const { data, error: fetchError } = await supabase
          .from('guides')
          .select('*')
          .eq('status', 'completed')
        if (fetchError) throw fetchError
        let filtered = (data as unknown[]).map(g => ({
          ...g,
          createdAt: g.created_at,
          updatedAt: g.updated_at,
        })) as GuideMetadata[]
        if (search) {
          filtered = filtered.filter(
            g =>
              g.title.toLowerCase().includes(search.toLowerCase()) ||
              g.summary.toLowerCase().includes(search.toLowerCase())
          )
        }
        if (difficulty) {
          filtered = filtered.filter(g => g.difficulty === difficulty)
        }
        if (sort === 'title') {
          filtered = filtered.slice().sort((a, b) => a.title.localeCompare(b.title))
        } else {
          filtered = filtered
            .slice()
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        }
        setGuides(filtered)
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message)
        } else {
          setError('Failed to load guides')
        }
      } finally {
        setLoading(false)
      }
    }
    fetchGuides()
  }, [search, difficulty, sort])

  const pagedGuides = guides.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
  const totalPages = Math.ceil(guides.length / PAGE_SIZE)

  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-4">Guide Library</h1>
      <p className="mb-8 text-muted-foreground">
        Browse all available guides. Filter and search below!
      </p>
      <div className="flex flex-col md:flex-row gap-4 mb-6 items-center">
        <Button asChild variant="link" className="mb-2 md:mb-0">
          <Link href="/search">Advanced Search</Link>
        </Button>
        <Input
          placeholder="Search guides..."
          value={search}
          onChange={e => {
            setSearch(e.target.value)
            setPage(1)
          }}
          className="max-w-xs"
          aria-label="Search guides"
        />
        <select
          value={difficulty}
          onChange={e => {
            setDifficulty(e.target.value)
            setPage(1)
          }}
          className="border rounded px-3 py-2 text-sm"
          aria-label="Filter by difficulty"
        >
          {DIFFICULTY_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <select
          value={sort}
          onChange={e => setSort(e.target.value)}
          className="border rounded px-3 py-2 text-sm"
          aria-label="Sort guides"
        >
          {SORT_OPTIONS.map(opt => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
      {loading ? (
        <Loading message="Loading guides..." />
      ) : error ? (
        <div className="text-red-600">{error}</div>
      ) : guides.length === 0 ? (
        <div className="text-muted-foreground">No guides to display yet.</div>
      ) : (
        <>
          <Grid cols="grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" gap="gap-6">
            {pagedGuides.map(guide => (
              <GuideCard key={guide.id} guide={guide} />
            ))}
          </Grid>
          <div className="flex justify-center items-center gap-2 mt-8">
            <button
              className="px-3 py-1 rounded bg-accent text-foreground disabled:opacity-50"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Previous page"
            >
              Previous
            </button>
            <span className="text-sm">
              Page {page} of {totalPages}
            </span>
            <button
              className="px-3 py-1 rounded bg-accent text-foreground disabled:opacity-50"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              aria-label="Next page"
            >
              Next
            </button>
          </div>
        </>
      )}
    </div>
  )
}
