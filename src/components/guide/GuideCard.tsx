import Link from 'next/link'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { GuideMetadata } from '@/lib/guide/types'

interface GuideCardProps {
  guide: GuideMetadata
}

export function GuideCard({ guide }: GuideCardProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="truncate text-lg">
          <Link href={`/guides/${guide.id}`} className="hover:underline">
            {guide.title}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col justify-between">
        <div className="mb-2 text-sm text-muted-foreground line-clamp-3">{guide.summary}</div>
        <div className="flex items-center justify-between text-xs mt-4">
          <span className="rounded bg-blue-100 text-blue-700 px-2 py-0.5 font-medium">
            {guide.difficulty.charAt(0).toUpperCase() + guide.difficulty.slice(1)}
          </span>
          <span className="text-muted-foreground">
            {new Date(guide.createdAt).toLocaleDateString()}
          </span>
          <span
            className={`px-2 py-0.5 rounded font-medium ${guide.status === 'completed' ? 'bg-green-100 text-green-700' : guide.status === 'generating' ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700'}`}
          >
            {guide.status.charAt(0).toUpperCase() + guide.status.slice(1)}
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

export default GuideCard
