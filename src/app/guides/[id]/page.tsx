import { cookies } from 'next/headers'
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'

export default async function GuidePage({ params }) {
  const { id } = params
  const supabase = createServerComponentClient({ cookies })

  // Fetch guide metadata
  const { data: guide, error: guideError } = await supabase
    .from('guides')
    .select('*')
    .eq('id', id)
    .single()

  if (guideError) return <div>Error loading guide: {guideError.message}</div>
  if (!guide) return <div>Guide not found</div>

  // Fetch guide sections using the actual guide.id (UUID)
  const { data: sections, error: sectionsError } = await supabase
    .from('guide_sections')
    .select('*')
    .eq('guide_id', guide.id)
    .order('section_order', { ascending: true })

  if (sectionsError) return <div>Error loading sections: {sectionsError.message}</div>

  return (
    <div className="max-w-2xl mx-auto py-8">
      <h1 className="text-3xl font-bold mb-2">{guide.title}</h1>
      <p className="mb-4 text-muted-foreground">{guide.summary}</p>
      <h2 className="text-xl font-semibold mb-2">Sections</h2>
      {sections && sections.length > 0 ? (
        <ol className="space-y-6">
          {sections.map((section, idx) => (
            <li key={section.id || idx} className="border rounded p-4">
              <h3 className="text-lg font-bold mb-1">{section.title}</h3>
              <div className="prose mb-2" dangerouslySetInnerHTML={{ __html: section.content }} />
              {section.timestamp && (
                <div className="text-xs text-muted-foreground">
                  Timestamp: {section.timestamp.start} - {section.timestamp.end} seconds
                </div>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <div className="text-muted-foreground">No sections found for this guide.</div>
      )}
    </div>
  )
}
