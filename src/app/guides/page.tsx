import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function GuideLibraryPage() {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-4">Guide Library</h1>
      <p className="mb-8 text-muted-foreground">
        Browse all available guides. Filter and search coming soon!
      </p>
      <Card>
        <CardHeader>
          <CardTitle>All Guides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No guides to display yet.</div>
        </CardContent>
      </Card>
    </div>
  )
}
