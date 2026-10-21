import type { MDXComponents } from 'mdx/types'

const components: MDXComponents = {
  h1: (props) => <h1 className="mb-6 text-3xl font-bold tracking-tight sm:text-4xl" {...props} />,
  h2: (props) => <h2 className="mt-12 mb-4 text-2xl font-bold tracking-tight" {...props} />,
  h3: (props) => <h3 className="mt-8 mb-3 text-xl font-semibold" {...props} />,
  p: (props) => <p className="my-4 leading-7" {...props} />,
  a: (props) => <a className="text-primary underline underline-offset-4 hover:opacity-80" {...props} />,
  ul: (props) => <ul className="my-4 list-disc space-y-2 pl-6" {...props} />,
  ol: (props) => <ol className="my-4 list-decimal space-y-2 pl-6" {...props} />,
  li: (props) => <li className="leading-7" {...props} />,
  code: (props) => <code className="rounded-sm bg-muted px-1.5 py-0.5 font-mono text-sm" {...props} />,
  pre: (props) => (
    <pre className="my-4 overflow-x-auto rounded-md border border-border bg-muted p-4 text-sm" {...props} />
  ),
  blockquote: (props) => (
    <blockquote className="my-4 border-l-2 border-primary pl-4 text-muted-foreground" {...props} />
  ),
}

export function useMDXComponents(): MDXComponents {
  return components
}
