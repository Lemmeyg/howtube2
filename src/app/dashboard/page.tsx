import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function DashboardPage() {
  return (
    <div className="py-8">
      <h1 className="text-3xl font-bold mb-4">Dashboard</h1>
      <p className="mb-8 text-muted-foreground">
        Welcome to your dashboard! Here you&apos;ll see your guides and recent activity.
      </p>
      <Card>
        <CardHeader>
          <CardTitle>Your Guides</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">No guides yet. Start by creating a new guide!</div>
        </CardContent>
      </Card>
    </div>
  )
}
