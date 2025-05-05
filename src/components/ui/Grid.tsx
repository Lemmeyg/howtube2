import React from 'react'

interface GridProps {
  children: React.ReactNode
  cols?: string
  gap?: string
  className?: string
}

/**
 * Grid component for responsive layouts.
 * @param cols - Tailwind grid-cols-* classes (e.g., 'grid-cols-1 md:grid-cols-2')
 * @param gap - Tailwind gap-* classes (e.g., 'gap-4')
 */
export const Grid: React.FC<GridProps> = ({
  children,
  cols = 'grid-cols-1',
  gap = 'gap-4',
  className = '',
}) => <div className={`grid ${cols} ${gap} ${className}`}>{children}</div>

export default Grid
