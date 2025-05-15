'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Code, Database, Terminal, Zap, ListChecks, Users } from 'lucide-react'
import { Navbar } from '@/components/navbar'
import { Breadcrumbs } from '@/components/Breadcrumbs'

export default function AppPage({ children: _children }: { children: React.ReactNode }) {
  const [url, setUrl] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!url || !/^https?:\/\//.test(url)) {
      setError('Please enter a valid YouTube URL.')
      return
    }
    setError('')
    router.push(`/create?url=${encodeURIComponent(url)}`)
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <Navbar />
      <Breadcrumbs />
      {/* Hero Section - full width gradient background */}
      <div className="w-full bg-gradient-to-b from-[#f8fafc] to-[#e0e7ef] flex flex-col items-center">
        <section className="w-full pt-16 pb-10 md:pt-24 md:pb-16">
          <div className="container px-4 md:px-6 mx-auto flex flex-col items-center">
            <span className="mb-4 inline-block rounded-full bg-blue-100 px-4 py-1 text-xs font-semibold text-blue-700">
              Simplify Learning & Documentation
            </span>
            <h1 className="text-4xl font-extrabold tracking-tight text-center text-gray-900 sm:text-5xl md:text-6xl lg:text-7xl mb-4">
              Transform YouTube Tutorials
              <br className="hidden md:block" />
              Into Detailed Documentation
            </h1>
            <p className="mx-auto max-w-2xl text-center text-lg text-gray-600 mb-8">
              Instantly convert any how-to video into comprehensive, searchable documentation
              that your users will love.
            </p>
            <form
              className="w-full max-w-xl mx-auto flex flex-col sm:flex-row items-center gap-3 bg-white/80 shadow-lg rounded-xl px-4 py-3"
              onSubmit={handleSubmit}
            >
              <Input
                type="url"
                placeholder="Paste YouTube URL here..."
                className="flex-1 h-12 text-base bg-transparent border-none focus:ring-0 focus:outline-none"
                value={url}
                onChange={e => setUrl(e.target.value)}
                aria-label="YouTube URL"
              />
              <Button
                type="submit"
                className="h-12 px-8 text-base font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-md"
              >
                Create guide
              </Button>
            </form>
            {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6 text-sm text-gray-500">
              <span>⭐ 4.9/5 from 2,300+ users</span>
              <span>•</span>
              <span>120,000+ docs generated</span>
              <span>•</span>
              <span>Used by 5,000+ companies</span>
            </div>
          </div>
        </section>
      </div>
      {/* Feature Highlights Section - still contained */}
      <section className="w-full py-12 bg-white">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="flex flex-col items-center text-center">
              <Zap className="h-10 w-10 text-blue-600 mb-2" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-1">Fast & Accurate Transcription</h3>
              <p className="text-gray-600 text-sm">
                Leverage state-of-the-art AI to transcribe videos with high accuracy and
                speed.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <ListChecks className="h-10 w-10 text-blue-600 mb-2" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-1">AI-Powered Step-by-Step Guides</h3>
              <p className="text-gray-600 text-sm">
                Automatically generate structured, easy-to-follow guides from any tutorial
                video.
              </p>
            </div>
            <div className="flex flex-col items-center text-center">
              <Users className="h-10 w-10 text-blue-600 mb-2" aria-hidden="true" />
              <h3 className="text-lg font-semibold mb-1">Seamless Collaboration</h3>
              <p className="text-gray-600 text-sm">
                Share, edit, and collaborate on guides with your team or the community.
              </p>
            </div>
          </div>
        </div>
      </section>
      {/* Gliding Cards Section - full width, different background */}
      <section className="w-full py-12 overflow-hidden bg-slate-100">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="relative">
            <div className="flex space-x-6 overflow-x-auto pb-4">
              <Card className="min-w-[300px] bg-white border-primary/20 hover:border-primary/40 transition-colors shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">
                    Getting Started with React
                  </CardTitle>
                  <CardDescription className="text-lg">
                    Learn the basics of React in this comprehensive tutorial
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Code className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      Frontend Development
                    </span>
                  </div>
                </CardContent>
              </Card>
              <Card className="min-w-[300px] bg-white border-primary/20 hover:border-primary/40 transition-colors shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">
                    Python for Data Science
                  </CardTitle>
                  <CardDescription className="text-lg">
                    Master data analysis with Python and popular libraries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Database className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">Data Science</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="min-w-[300px] bg-white border-primary/20 hover:border-primary/40 transition-colors shadow-md">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">
                    Linux Command Line Basics
                  </CardTitle>
                  <CardDescription className="text-lg">
                    Essential commands and shell scripting for beginners
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">
                      System Administration
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
      {/* Call-to-Action Section - full width gradient */}
      <div className="w-full bg-gradient-to-r from-blue-600 to-blue-400">
        <section className="w-full py-12">
          <div className="container px-4 md:px-6 mx-auto flex flex-col items-center">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-4 text-center">
              Ready to turn your next video into a guide?
            </h2>
            <Button
              size="lg"
              className="bg-white text-blue-700 font-semibold px-8 py-3 rounded-lg shadow-lg hover:bg-blue-50 focus-visible:ring-2 focus-visible:ring-white"
              asChild
            >
              <a href="#" aria-label="Get Started">
                Get Started
              </a>
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
