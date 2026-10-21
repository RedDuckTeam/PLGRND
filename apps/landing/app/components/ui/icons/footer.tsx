const GLYPHS: Record<string, string[]> = {
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  G: ['.####', '#....', '#....', '#.###', '#...#', '#...#', '.####'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  N: ['#...#', '##..#', '##..#', '#.#.#', '#..##', '#..##', '#...#'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
}
const NODE = ['.###.', '#####', '#####', '#####', '.###.']

const GLYPH_WIDTH = 5
const LETTER_GAP = 2
const WIRE = 3
const WIRE_ROW = 3
const PAD_Y = 2

function toPath(rows: string[], x0: number, y0: number): string {
  let d = ''
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (row[x] !== '#') {
        x++
        continue
      }
      const start = x
      while (row[x] === '#') x++
      d += `M${x0 + start} ${y0 + y}h${x - start}v1h${start - x}z`
    }
  })
  return d
}

const LETTERS = 'PLGRND'.split('')
const TEXT_X = NODE[0].length + WIRE
const TEXT_WIDTH = LETTERS.length * GLYPH_WIDTH + (LETTERS.length - 1) * LETTER_GAP
const RIGHT_WIRE_X = TEXT_X + TEXT_WIDTH
const RIGHT_NODE_X = RIGHT_WIRE_X + WIRE
const WIDTH = RIGHT_NODE_X + NODE[0].length
const NODE_Y = WIRE_ROW - Math.floor(NODE.length / 2)

const WORDMARK_PATH =
  LETTERS.map((letter, i) => toPath(GLYPHS[letter], TEXT_X + i * (GLYPH_WIDTH + LETTER_GAP), 0)).join('') +
  `M${NODE[0].length} ${WIRE_ROW}h${WIRE}v1h-${WIRE}z` +
  `M${RIGHT_WIRE_X} ${WIRE_ROW}h${WIRE}v1h-${WIRE}z`
const LEFT_NODE_PATH = toPath(NODE, 0, NODE_Y)
const RIGHT_NODE_PATH = toPath(NODE, RIGHT_NODE_X, NODE_Y)

export const FooterLogo = ({ className }: { className?: string }) => {
  return (
    <svg
      viewBox={`0 ${-PAD_Y} ${WIDTH} ${GLYPHS.P.length + PAD_Y * 2}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="PLGRND"
      className={className}
    >
      <path d={WORDMARK_PATH} className="fill-foreground" />
      <path d={LEFT_NODE_PATH} className="fill-primary-2" />
      <path d={RIGHT_NODE_PATH} className="fill-primary motion-safe:animate-pulse" />
    </svg>
  )
}
