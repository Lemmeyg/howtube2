import React from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import '@testing-library/jest-dom'
import { GuideSection } from '@/lib/guide/types'
import { GuideStepEditor } from '../GuideStepEditor'

const mockSection: GuideSection = {
  id: 'step-1',
  title: 'Test Step',
  content: '<p>Initial content</p>',
  order: 0,
}

describe('GuideStepEditor', () => {
  it('renders the editor with initial content', () => {
    render(<GuideStepEditor section={mockSection} onSave={jest.fn()} />)
    expect(screen.getByText('Edit Step: Test Step')).toBeInTheDocument()
    expect(screen.getByLabelText(/rich text editor/i)).toBeInTheDocument()
  })

  it('calls onSave when Save is clicked', () => {
    const handleSave = jest.fn()
    render(<GuideStepEditor section={mockSection} onSave={handleSave} />)
    fireEvent.click(screen.getByText('Save'))
    expect(handleSave).toHaveBeenCalled()
  })

  it('calls onCancel if provided', () => {
    const handleCancel = jest.fn()
    render(<GuideStepEditor section={mockSection} onSave={jest.fn()} onCancel={handleCancel} />)
    fireEvent.click(screen.getByText('Cancel'))
    expect(handleCancel).toHaveBeenCalled()
  })
})
