const fetch = require('node-fetch')

const WORKER_URL = 'http://localhost:3000/api/videos/worker'

async function triggerWorker() {
  try {
    console.log(`[${new Date().toISOString()}] Checking for pending videos...`)
    const res = await fetch(WORKER_URL, { method: 'POST' })
    const data = await res.json()
    console.log(`[${new Date().toISOString()}] Worker response:`, data)
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error triggering worker:`, error)
  }
}

// Run once
console.log('Starting worker...')
triggerWorker()

// Run every 30 seconds
console.log('Setting up interval to check every 30 seconds...')
setInterval(triggerWorker, 30000) 