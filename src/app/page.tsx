import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ArrowRight, Code, Database, Terminal } from 'lucide-react'

export default function Home() {
  return (
    <div className="flex flex-col items-center min-h-screen bg-gradient-to-b from-background to-background/80">
      {/* Hero Section */}
      <section className="w-full py-12 md:py-24 lg:py-32">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-6 text-center">
            <h1 className="text-4xl font-bold tracking-tighter sm:text-5xl md:text-6xl lg:text-7xl text-foreground bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/60">
              Transform YouTube Videos into Interactive Learning Experiences
            </h1>
            <p className="mx-auto max-w-[700px] text-muted-foreground text-lg sm:text-xl md:text-2xl">
              Upload any YouTube video and instantly get an interactive transcript, key insights,
              and learning resources.
            </p>
          </div>
        </div>
      </section>

      {/* URL Submission Section */}
      <section className="w-full py-12">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="flex flex-col items-center space-y-6">
            <div className="w-full max-w-2xl">
              <div className="flex gap-4">
                <Input
                  type="url"
                  placeholder="Paste YouTube URL here..."
                  className="flex-1 h-12 text-lg"
                />
                <Button className="h-12 px-8 text-lg bg-primary hover:bg-primary/90">
                  <ArrowRight className="mr-2 h-5 w-5" />
                  Transform
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Gliding Cards Section */}
      <section className="w-full py-12 overflow-hidden">
        <div className="container px-4 md:px-6 mx-auto">
          <div className="relative">
            <div className="flex space-x-6 animate-scroll">
              <Card className="min-w-[300px] bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors">
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
                    <span className="text-sm text-muted-foreground">Frontend Development</span>
                  </div>
                </CardContent>
              </Card>
              <Card className="min-w-[300px] bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">Python for Data Science</CardTitle>
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
              <Card className="min-w-[300px] bg-card/50 backdrop-blur-sm border-primary/20 hover:border-primary/40 transition-colors">
                <CardHeader>
                  <CardTitle className="text-2xl text-primary">Linux Command Line Basics</CardTitle>
                  <CardDescription className="text-lg">
                    Essential commands and shell scripting for beginners
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <Terminal className="h-5 w-5 text-primary" />
                    <span className="text-sm text-muted-foreground">System Administration</span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
