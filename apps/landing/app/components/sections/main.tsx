import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { FlipButton } from '../ui/flip-button'
import { SparklesCore } from '../ui/sparkles'
import { WavyBackground } from '../ui/wavy-background'
import { GradientText } from '../ui/gradient-text'

const WAVES = ['#14f195', '#519ed4', '#9945ff']
const SOLANA_GRADIENT = 'linear-gradient(225deg, #14f195 0%, #519ed4 25%, #9945ff 50%, #519ed4 75%, #14f195 100%)'

export function Main() {
  return (
    <section
      aria-labelledby="hero-title"
      className="flex min-h-[calc(100svh-81px)] flex-col overflow-hidden sm:min-h-[calc(100svh-97px)]"
    >
      <WavyBackground
        backgroundFill="#171717"
        colors={WAVES}
        waveWidth={30}
        blur={8}
        speed="slow"
        waveOpacity={0.3}
        className="w-full text-foreground"
        containerClassName="flex-1 [&>canvas]:-rotate-45 max-sm:[&>canvas]:-rotate-0 [&>canvas]:w-[150%] max-md:[&>canvas]:translate-y-[20%] [&>canvas]:translate-y-[10%]"
      >
        <div className="flex flex-col justify-center overflow-hidden px-4 pt-[10vh] pb-16 sm:px-6 sm:pt-[18vh] xl:px-12">
          <p className="relative z-20 mb-5 inline-flex w-max items-center gap-2 rounded-sm border border-foreground/15 bg-background/60 px-3 py-1.5 text-xs uppercase tracking-widest text-muted-foreground backdrop-blur-sm sm:text-sm">
            <span aria-hidden className="size-1.5 bg-primary" />
            PLGRND / visual Solana playground
          </p>
          <h1 id="hero-title" className="relative z-20 text-[28px] font-bold sm:text-4xl xl:text-7xl">
            Build <GradientText text="Solana" gradient={SOLANA_GRADIENT} /> flows <br className="max-sm:hidden" />
            by dragging nodes
          </h1>
          <div className="relative mt-2 h-32 w-full sm:w-1/2 xl:mt-5 xl:h-40">
            <p className="absolute top-4 z-50 lg:text-lg xl:text-[22px]">
              Wire keypairs, PDAs, instructions and transactions, then run them against a live cluster.
            </p>
            <div className="absolute inset-x-0 top-0 h-[2px] w-full bg-linear-to-r from-transparent via-primary-2 to-transparent blur-sm" />
            <div className="absolute inset-x-0 top-0 h-px w-full bg-linear-to-r from-transparent via-primary-2 to-transparent" />
            <div className="absolute inset-x-10 top-0 h-[5px] w-1/2 bg-linear-to-r from-transparent via-primary to-transparent blur-sm sm:inset-x-40" />
            <div className="absolute inset-x-10 top-0 h-px w-1/2 bg-linear-to-r from-transparent via-primary to-transparent sm:inset-x-40" />
            <SparklesCore
              background="transparent"
              minSize={0.4}
              maxSize={1}
              particleDensity={1200}
              className="h-full w-full"
              particleColor="#FFFFFF"
            />
            <div className="absolute inset-0 h-full w-full bg-background mask-[radial-gradient(350px_200px_at_top,transparent_20%,white)]"></div>
          </div>
          <div className="relative z-20 flex flex-col gap-3 sm:flex-row sm:gap-4">
            <a
              href="https://plgrnd.io"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Open editor"
              className="rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary max-sm:w-full"
            >
              <FlipButton
                aria-hidden
                frontClassName="bg-primary text-background"
                frontText="Open editor"
                backText="Open editor"
                className="max-sm:w-full"
              />
            </a>
            <Link
              href="/integrate"
              className="group inline-flex h-[60px] items-center justify-center gap-3 rounded-sm border border-foreground/25 bg-background/50 px-4 text-[22px] font-medium text-foreground backdrop-blur-sm transition-colors duration-300 hover:border-primary hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary max-sm:w-full xl:px-6 xl:text-[28px]"
            >
              Integrate
              <ArrowRight
                aria-hidden
                className="size-6 transition-transform duration-300 group-hover:translate-x-1 xl:size-7"
              />
            </Link>
          </div>
        </div>
      </WavyBackground>
    </section>
  )
}
