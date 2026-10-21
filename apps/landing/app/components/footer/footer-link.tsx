import type { ElementType } from 'react'

interface FooterLinkProps {
  href: string
  label: string
  Icon: ElementType
}

export function FooterLink({ href, label, Icon }: FooterLinkProps) {
  return (
    <a
      href={href}
      className="group flex items-center gap-2 rounded-sm transition-colors duration-300 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
      target="_blank"
      rel="noopener noreferrer"
    >
      <Icon
        aria-hidden
        className="sm:w-8 w-7 sm:h-8 h-7 transition-[fill,color,stroke] duration-300 [&>*]:transition-[fill,stroke,color] [&>*]:duration-300 [&>path]:transition-[fill,stroke] [&>path]:duration-300"
      />
      <p className="text-base sm:text-lg">{label}</p>
    </a>
  )
}
