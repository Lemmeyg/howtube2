'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const LABELS: Record<string, string> = {
  '': 'Home',
  dashboard: 'Dashboard',
  guides: 'Guide Library',
  create: 'Create Guide',
  profile: 'Profile',
  login: 'Login',
  signup: 'Sign Up',
  'reset-password': 'Reset Password',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)
  const crumbs = segments.map((seg, idx) => {
    const href = '/' + segments.slice(0, idx + 1).join('/')
    const label = LABELS[seg] || seg.charAt(0).toUpperCase() + seg.slice(1)
    return { href, label }
  })

  return (
    <nav className="flex items-center text-sm text-muted-foreground py-2" aria-label="Breadcrumb">
      <ol className="flex items-center space-x-2">
        <li>
          <Link href="/" className="hover:underline">
            Home
          </Link>
        </li>
        {crumbs.map((crumb, i) => (
          <li key={crumb.href} className="flex items-center">
            <span className="mx-2">/</span>
            {i === crumbs.length - 1 ? (
              <span aria-current="page" className="font-semibold text-foreground">
                {crumb.label}
              </span>
            ) : (
              <Link href={crumb.href} className="hover:underline">
                {crumb.label}
              </Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  )
}

export default Breadcrumbs
