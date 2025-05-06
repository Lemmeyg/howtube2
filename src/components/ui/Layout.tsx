'use client'

import React from 'react'

interface LayoutProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
}

export const Layout: React.FC<LayoutProps> = ({ children, sidebar }) => {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <div className="flex flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {sidebar && (
          <aside className="hidden md:block w-64 pr-6 border-r border-border bg-card">
            {sidebar}
          </aside>
        )}
        <main className="flex-1 py-8">{children}</main>
      </div>
    </div>
  )
}

export default Layout
