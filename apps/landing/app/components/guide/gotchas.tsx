import { GUIDES, type MethodSlug } from '@/app/lib/guide'

function withInlineCode(text: string) {
  return text.split(/`([^`]+)`/).map((part, index) =>
    index % 2 ? (
      <code key={index} className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm">
        {part}
      </code>
    ) : (
      part
    )
  )
}

export function Gotchas({ method }: { method: MethodSlug }) {
  const guide = GUIDES[method]
  if (!guide) throw new Error(`Gotchas: unknown method "${method}"`)

  return (
    <section data-gotchas={method} aria-labelledby={`gotchas-${method}`} className="mt-12">
      <h2 id={`gotchas-${method}`} className="mb-4 text-2xl font-bold tracking-tight">
        Gotchas
      </h2>
      <ul className="space-y-4">
        {guide.gotchas.map((gotcha) => (
          <li key={gotcha.id} data-gotcha-id={gotcha.id} className="rounded-lg border border-border bg-sidebar p-4">
            <p className="text-xs font-semibold tracking-wider text-primary uppercase">{gotcha.platform}</p>
            <p className="mt-2 leading-7">{withInlineCode(gotcha.issue)}</p>
            <p className="mt-2 leading-7 text-muted-foreground">
              <span className="font-semibold text-foreground">Fix: </span>
              {withInlineCode(gotcha.fix)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}
