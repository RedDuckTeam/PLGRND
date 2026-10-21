import { OPEN_IN_URL } from '@/app/lib/guide/open-in-plgrnd'

export function OpenInPlgrndButton() {
  return (
    <a
      href={OPEN_IN_URL}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-background no-underline transition-opacity hover:opacity-90"
    >
      Open in PLGRND
    </a>
  )
}
