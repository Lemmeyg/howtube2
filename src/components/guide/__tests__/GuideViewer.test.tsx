import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { Guide } from '@/lib/guide/types'
import { GuideViewer } from '../GuideViewer'

jest.mock('@/contexts/guide-context', () => {
  const actual = jest.requireActual('@/contexts/guide-context')
  const mockGuide: Guide = {
    id: 'g1',
    title: 'Test Guide',
    summary: 'A summary',
    sections: [
      { id: 's1', title: 'Step 1', content: '<p>Step 1 content</p>', order: 0 },
      { id: 's2', title: 'Step 2', content: '<p>Step 2 content</p>', order: 1 },
    ],
    keywords: ['test', 'guide'],
    difficulty: 'beginner',
  }
  return {
    ...actual,
    useGuide: () => ({
      state: { guide: mockGuide, loading: false, error: null },
      dispatch: jest.fn(),
    }),
  }
})

describe('GuideViewer', () => {
  it('renders guide metadata and steps', () => {
    render(<GuideViewer />)
    expect(screen.getByText('Test Guide')).toBeInTheDocument()
    expect(screen.getByText('A summary')).toBeInTheDocument()
    expect(screen.getByText('Step 1: Step 1')).toBeInTheDocument()
    expect(screen.getByText('Step 2: Step 2')).toBeInTheDocument()
    expect(screen.getByText('Step 1 content')).toBeInTheDocument()
  })

  it('navigates between steps', () => {
    render(<GuideViewer />)
    fireEvent.click(screen.getByText('Step 2: Step 2'))
    expect(screen.getByText('Step 2 content')).toBeInTheDocument()
    fireEvent.click(screen.getByText('Step 1: Step 1'))
    expect(screen.getByText('Step 1 content')).toBeInTheDocument()
  })
})
