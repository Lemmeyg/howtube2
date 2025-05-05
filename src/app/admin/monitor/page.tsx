'use client'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useRouter } from 'next/navigation'

interface LogEntry {
  timestamp: string
  level: 'info' | 'warn' | 'error'
  message: string
}

export default function AdminMonitorPage() {
  const [stats, setStats] = useState({
    uptime: '99.99%',
    apiLatency: 120,
    errorRate: 0.2,
  })
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // TODO: Fetch real stats and logs from backend
    setStats({ uptime: '99.99%', apiLatency: 120, errorRate: 0.2 })
    setLogs([
      { timestamp: '2024-06-01 12:00', level: 'info', message: 'System started' },
      { timestamp: '2024-06-01 12:05', level: 'warn', message: 'High memory usage' },
      { timestamp: '2024-06-01 12:10', level: 'error', message: 'API timeout' },
    ])
    setLoading(false)
  }, [])

  if (loading) return <div>Loading system stats...</div>

  return (
    <div className="py-8 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">System Monitoring</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="border rounded-lg p-6 flex flex-col items-center">
          <div className="text-3xl font-bold mb-2">{stats.uptime}</div>
          <div className="text-muted-foreground">Uptime</div>
        </div>
        <div className="border rounded-lg p-6 flex flex-col items-center">
          <div className="text-3xl font-bold mb-2">{stats.apiLatency} ms</div>
          <div className="text-muted-foreground">API Latency</div>
        </div>
        <div className="border rounded-lg p-6 flex flex-col items-center">
          <div className="text-3xl font-bold mb-2">{stats.errorRate}%</div>
          <div className="text-muted-foreground">Error Rate</div>
        </div>
      </div>
      <h2 className="text-xl font-semibold mb-4">Recent Logs</h2>
      <table className="w-full border rounded mb-8">
        <thead>
          <tr className="bg-muted">
            <th className="p-2 text-left">Timestamp</th>
            <th className="p-2 text-left">Level</th>
            <th className="p-2 text-left">Message</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={i} className="border-t">
              <td className="p-2">{log.timestamp}</td>
              <td
                className={`p-2 font-bold ${log.level === 'error' ? 'text-red-600' : log.level === 'warn' ? 'text-yellow-600' : 'text-green-600'}`}
              >
                {log.level}
              </td>
              <td className="p-2">{log.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <Button variant="secondary" onClick={() => router.push('/admin')}>
        Back to Admin Dashboard
      </Button>
    </div>
  )
}
