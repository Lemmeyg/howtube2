import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/navbar'
import Layout from '@/components/ui/Layout'
import Container from '@/components/ui/Container'
import ClientRoot from '@/components/ClientRoot'
import { Breadcrumbs } from '@/components/Breadcrumbs'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
})

export const metadata: Metadata = {
  title: 'HowTube - Learn and Share Knowledge',
  description: 'A platform for learning and sharing knowledge through video tutorials and courses.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <Layout>
          <Container>
            <ClientRoot>
              <Navbar />
              <Breadcrumbs />
              {children}
            </ClientRoot>
          </Container>
        </Layout>
      </body>
    </html>
  )
}
