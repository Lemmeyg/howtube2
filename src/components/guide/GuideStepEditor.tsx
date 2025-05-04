import React, { useEffect } from 'react'
import { EditorContent, useEditor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import { GuideSection } from '@/lib/guide/types'
import { Button } from '@/components/ui/button'

interface GuideStepEditorProps {
  section: GuideSection
  onSave: (updated: GuideSection) => void
  onCancel?: () => void
}

export const GuideStepEditor: React.FC<GuideStepEditorProps> = ({ section, onSave, onCancel }) => {
  const editor = useEditor({
    extensions: [StarterKit],
    content: section.content,
    editorProps: {
      attributes: {
        class: 'prose min-h-[200px] p-2 border rounded focus:outline-none',
        'aria-label': 'Guide step rich text editor',
      },
    },
  })

  useEffect(() => {
    if (editor && section.content !== editor.getHTML()) {
      editor.commands.setContent(section.content)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [section.id])

  const handleSave = () => {
    if (editor) {
      onSave({ ...section, content: editor.getHTML() })
    }
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">Edit Step: {section.title}</h3>
      <EditorContent editor={editor} />
      <div className="flex gap-2">
        <Button onClick={handleSave} type="button" variant="default">
          Save
        </Button>
        {onCancel && (
          <Button onClick={onCancel} type="button" variant="outline">
            Cancel
          </Button>
        )}
      </div>
    </div>
  )
}

export default GuideStepEditor
