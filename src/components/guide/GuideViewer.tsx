import React, { useState } from 'react'
import { useGuide } from '@/contexts/guide-context'
import { GuideSection, Guide } from '@/lib/guide/types'
import GuideStepEditor from './GuideStepEditor'
import { v4 as uuidv4 } from 'uuid'
import Image from 'next/image'

export const GuideViewer: React.FC = () => {
  const { state, dispatch } = useGuide()
  const guide = state.guide
  const [currentStep, setCurrentStep] = useState(0)
  const [editing, setEditing] = useState(false)
  const [editingMetadata, setEditingMetadata] = useState(false)
  const [meta, setMeta] = useState(() =>
    guide
      ? {
          title: guide.title,
          summary: guide.summary,
          keywords: guide.keywords.join(', '),
          difficulty: guide.difficulty,
        }
      : {
          title: '',
          summary: '',
          keywords: '',
          difficulty: 'beginner' as Guide['difficulty'],
        }
  )

  if (state.loading) return <div>Loading guide...</div>
  if (state.error) return <div>Error: {state.error}</div>
  if (!guide) return <div>No guide loaded.</div>

  const sections = guide.sections || []
  const step = sections[currentStep]

  const goToStep = (idx: number) => {
    if (idx >= 0 && idx < sections.length) setCurrentStep(idx)
  }

  return (
    <div className="guide-viewer">
      <h1>{guide.title}</h1>
      <p>{guide.summary}</p>
      <div className="guide-metadata">
        <span>Difficulty: {guide.difficulty}</span>
        <span>Keywords: {guide.keywords.join(', ')}</span>
        <button onClick={() => setEditingMetadata(v => !v)} style={{ marginLeft: 8 }}>
          {editingMetadata ? 'Cancel Metadata Edit' : 'Edit Metadata'}
        </button>
      </div>
      {editingMetadata && (
        <form
          className="space-y-2"
          onSubmit={e => {
            e.preventDefault()
            dispatch({
              type: 'UPDATE_METADATA',
              payload: {
                title: meta.title,
                summary: meta.summary,
                keywords: meta.keywords
                  .split(',')
                  .map(k => k.trim())
                  .filter(Boolean),
                difficulty: meta.difficulty as Guide['difficulty'],
              },
            })
            setEditingMetadata(false)
          }}
        >
          <div>
            <label className="block font-medium">Title</label>
            <input
              className="border rounded p-1 w-full"
              value={meta.title}
              onChange={e => setMeta(m => ({ ...m, title: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block font-medium">Summary</label>
            <textarea
              className="border rounded p-1 w-full"
              value={meta.summary}
              onChange={e => setMeta(m => ({ ...m, summary: e.target.value }))}
              required
            />
          </div>
          <div>
            <label className="block font-medium">Keywords (comma separated)</label>
            <input
              className="border rounded p-1 w-full"
              value={meta.keywords}
              onChange={e => setMeta(m => ({ ...m, keywords: e.target.value }))}
            />
          </div>
          <div>
            <label className="block font-medium">Difficulty</label>
            <select
              className="border rounded p-1 w-full"
              value={meta.difficulty}
              onChange={e =>
                setMeta(m => ({ ...m, difficulty: e.target.value as Guide['difficulty'] }))
              }
            >
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
          </div>
          <button type="submit" className="mt-2 px-3 py-1 bg-blue-600 text-white rounded">
            Save Metadata
          </button>
        </form>
      )}
      <div className="guide-steps-nav">
        <ul>
          {sections.map((section, idx) => (
            <li
              key={section.id}
              className={idx === currentStep ? 'active' : ''}
              onClick={() => goToStep(idx)}
              style={{ cursor: 'pointer', fontWeight: idx === currentStep ? 'bold' : 'normal' }}
            >
              Step {idx + 1}: {section.title}
            </li>
          ))}
        </ul>
      </div>
      <div className="guide-step-content">
        <h2>{step.title}</h2>
        {editing ? (
          <GuideStepEditor
            section={step}
            onSave={updated => {
              dispatch({ type: 'UPDATE_SECTION', payload: updated })
              setEditing(false)
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <>
            <div dangerouslySetInnerHTML={{ __html: step.content }} />
            <button onClick={() => setEditing(true)} style={{ marginTop: 8 }}>
              Edit
            </button>
          </>
        )}
        {step.images && step.images.length > 0 && (
          <div className="guide-step-images">
            {step.images.map((img, i) => (
              <Image
                key={i}
                src={img}
                alt={`Step ${currentStep + 1} image ${i + 1}`}
                width={200}
                height={120}
                style={{ maxWidth: 200, margin: 8, height: 'auto' }}
              />
            ))}
          </div>
        )}
        {step.timestamp && (
          <div className="guide-step-timestamp">
            <small>
              Timestamp: {step.timestamp.start} - {step.timestamp.end} seconds
            </small>
          </div>
        )}
      </div>
      <div className="guide-step-controls" style={{ marginTop: 16 }}>
        <button onClick={() => goToStep(currentStep - 1)} disabled={currentStep === 0}>
          Previous
        </button>
        <span style={{ margin: '0 12px' }}>
          Step {currentStep + 1} of {sections.length}
        </span>
        <button
          onClick={() => goToStep(currentStep + 1)}
          disabled={currentStep === sections.length - 1}
        >
          Next
        </button>
      </div>
      <div className="guide-step-management" style={{ margin: '16px 0' }}>
        <button
          onClick={() => {
            const newSection: GuideSection = {
              id: uuidv4(),
              title: `Step ${sections.length + 1}`,
              content: '<p>New step content</p>',
              order: sections.length,
            }
            dispatch({ type: 'ADD_SECTION', payload: newSection })
            setCurrentStep(sections.length) // go to new step
          }}
        >
          Add Step
        </button>
        <button
          onClick={() => {
            if (sections.length > 1) {
              dispatch({ type: 'DELETE_SECTION', payload: step.id })
              setCurrentStep(prev => (prev > 0 ? prev - 1 : 0))
            }
          }}
          disabled={sections.length <= 1}
          style={{ marginLeft: 8 }}
        >
          Delete Step
        </button>
        <button
          onClick={() => {
            if (currentStep > 0) {
              const reordered = [...sections]
              const temp = reordered[currentStep]
              reordered[currentStep] = reordered[currentStep - 1]
              reordered[currentStep - 1] = temp
              dispatch({ type: 'REORDER_SECTIONS', payload: reordered })
              setCurrentStep(currentStep - 1)
            }
          }}
          disabled={currentStep === 0}
          style={{ marginLeft: 8 }}
        >
          Move Up
        </button>
        <button
          onClick={() => {
            if (currentStep < sections.length - 1) {
              const reordered = [...sections]
              const temp = reordered[currentStep]
              reordered[currentStep] = reordered[currentStep + 1]
              reordered[currentStep + 1] = temp
              dispatch({ type: 'REORDER_SECTIONS', payload: reordered })
              setCurrentStep(currentStep + 1)
            }
          }}
          disabled={currentStep === sections.length - 1}
          style={{ marginLeft: 8 }}
        >
          Move Down
        </button>
      </div>
    </div>
  )
}
