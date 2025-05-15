'use client'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { User, Menu } from 'lucide-react'
import * as Dialog from '@radix-ui/react-dialog'
import { useState } from 'react'
import { X } from 'lucide-react'

export function Navbar() {
  const { user, signOut } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2" aria-label="Home">
            <span className="font-bold">HowTube</span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-between space-x-2 md:justify-end">
          <nav className="hidden md:flex items-center space-x-2" aria-label="Main navigation">
            {user ? (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/dashboard">Dashboard</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/guides">Guide Library</Link>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Open user menu">
                      <User className="h-5 w-5" />
                      <span className="sr-only">User menu</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" aria-label="User menu">
                    <DropdownMenuItem asChild>
                      <Link href="/profile">Profile</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/guides">My Guides</Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => signOut()}>Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/guides">Guide Library</Link>
                </Button>
                <Button variant="ghost" asChild>
                  <Link href="/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </>
            )}
          </nav>
          <div className="md:hidden">
            <Dialog.Root open={drawerOpen} onOpenChange={setDrawerOpen}>
              <Dialog.Trigger asChild>
                <Button variant="ghost" size="icon" aria-label="Open navigation drawer">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 bg-black/40 z-50" />
                <Dialog.Content className="fixed top-0 left-0 h-full w-64 bg-background shadow-lg z-50 flex flex-col p-4 focus:outline-none">
                  <div className="flex items-center justify-between mb-6">
                    <span className="font-bold text-lg">Menu</span>
                    <Dialog.Close asChild>
                      <Button variant="ghost" size="icon" aria-label="Close navigation drawer">
                        <X className="h-5 w-5" />
                      </Button>
                    </Dialog.Close>
                  </div>
                  <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
                    <Link href="/" className="py-2 px-3 rounded hover:bg-accent" onClick={() => setDrawerOpen(false)}>Home</Link>
                    <Link href="/guides" className="py-2 px-3 rounded hover:bg-accent" onClick={() => setDrawerOpen(false)}>Guide Library</Link>
                    {user ? (
                      <>
                        <Link href="/dashboard" className="py-2 px-3 rounded hover:bg-accent" onClick={() => setDrawerOpen(false)}>Dashboard</Link>
                        <Link href="/profile" className="py-2 px-3 rounded hover:bg-accent" onClick={() => setDrawerOpen(false)}>Profile</Link>
                        <Link href="/guides" className="py-2 px-3 rounded hover:bg-accent" onClick={() => setDrawerOpen(false)}>My Guides</Link>
                        <button className="py-2 px-3 rounded hover:bg-accent text-left" onClick={() => { signOut(); setDrawerOpen(false) }}>Sign Out</button>
                      </>
                    ) : (
                      <>
                        <Link href="/login" className="py-2 px-3 rounded hover:bg-accent" onClick={() => setDrawerOpen(false)}>Login</Link>
                        <Link href="/signup" className="py-2 px-3 rounded hover:bg-accent" onClick={() => setDrawerOpen(false)}>Sign Up</Link>
                      </>
                    )}
                  </nav>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        </div>
      </div>
    </header>
  )
}
