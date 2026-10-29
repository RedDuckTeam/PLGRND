import { Github, Globe, Workflow } from 'lucide-react'
import { FooterLink } from './footer-link'
import { FooterLogo } from '../ui/icons/footer'

const FOOTER_LINKS = [
  { href: 'https://github.com/RedDuckTeam/PLGRND', label: 'GitHub', Icon: Github },
  { href: 'https://plgrnd.io', label: 'Editor', Icon: Workflow },
  { href: 'https://redduck.io', label: 'RedDuck', Icon: Globe },
]

export function Footer() {
  return (
    <footer className="bg-background text-foreground">
      <div className="@container w-full mb-6 px-4 sm:px-6 xl:px-12 pt-10 sm:pt-16">
        <FooterLogo className="w-full h-auto" />
        <div className="mt-8 flex items-start max-lg:flex-col max-lg:gap-8 lg:justify-between">
          <div className="flex flex-col gap-2">
            <p>Build Solana flows by dragging nodes.</p>
            <p className="text-muted-foreground">{`© ${new Date().getFullYear()} RedDuck. PLGRND is MIT-licensed.`}</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-1 gap-x-10 gap-y-4 sm:grid-cols-3">
            {FOOTER_LINKS.map((link) => (
              <FooterLink key={link.href} {...link} />
            ))}
          </nav>
        </div>
      </div>
      <div aria-hidden className="footer-pattern w-full h-15"></div>
    </footer>
  )
}
