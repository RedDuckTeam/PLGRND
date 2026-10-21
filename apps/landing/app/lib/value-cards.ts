export type ValueCardIcon = 'link' | 'shield' | 'route' | 'palette'

export type ValueCard = {
  id: string
  title: string
  description: string
  icon: ValueCardIcon
}

export const VALUE_CARDS: ValueCard[] = [
  {
    id: 'flow-is-url',
    title: 'The flow is the URL',
    description: 'Every flow encodes into its own URL, so a working example is a link you can send to someone.',
    icon: 'link',
  },
  {
    id: 'no-plgrnd-requests',
    title: 'Nothing from plgrnd.io',
    description:
      'The self-hosted widget renders in your page, without an iframe. At runtime it loads no Google Fonts, no analytics, no remote CSS and nothing from plgrnd.io.',
    icon: 'shield',
  },
  {
    id: 'five-ways-in',
    title: 'Five ways in',
    description:
      'A hosted iframe, the self-hosted widget, a React wrapper, an Open in PLGRND link or a native port. Pick what your docs platform allows.',
    icon: 'route',
  },
  {
    id: 'theme-tokens',
    title: 'Your theme',
    description:
      'Start from the dark, light or auto preset, then set bg, surface, fg, border, accent, radius and fonts to match your docs.',
    icon: 'palette',
  },
]
