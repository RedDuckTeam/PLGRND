import { useState } from 'react'
import { cn } from '@/lib/utils'
import {
  parseFontFamily,
  parseRadius,
  type EmbedColorKey,
  type EmbedConfig,
  type EmbedMode,
  type EmbedTheme,
} from '@/embed/embed-config'
import {
  COLOR_FIELDS,
  CUSTOM_FONT_ID,
  FONT_PRESETS,
  MAX_FIXED_HEIGHT,
  MIN_FIXED_HEIGHT,
  SIZE_PRESETS,
  THEME_PICKER_DEFAULTS,
  type BuilderSettings,
} from './constants'

interface EmbedBuilderFormProps {
  settings: BuilderSettings
  onChange: (settings: BuilderSettings) => void
}

const MODES: EmbedMode[] = ['readonly', 'interactive', 'editor']
const THEMES: EmbedTheme[] = ['dark', 'light', 'auto']

const rowClass = 'flex flex-col gap-1.5'
const labelClass = 'font-mono text-[11px] uppercase text-muted-foreground'

const segmentClass = (active: boolean) =>
  cn(
    'cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] capitalize transition-colors',
    active
      ? 'border-primary bg-muted text-foreground'
      : 'border-border bg-transparent text-muted-foreground hover:text-foreground'
  )

const matchFontPresetId = (value: string | undefined): string =>
  FONT_PRESETS.find((preset) => preset.value === value)?.id ?? CUSTOM_FONT_ID

interface FontFieldProps {
  label: string
  value: string | undefined
  onValue: (value: string | undefined) => void
}

const FontField = ({ label, value, onValue }: FontFieldProps) => {
  const [customSelected, setCustomSelected] = useState(() => matchFontPresetId(value) === CUSTOM_FONT_ID)
  const selectedId = customSelected ? CUSTOM_FONT_ID : matchFontPresetId(value)

  return (
    <div className={rowClass}>
      <span className={labelClass}>{label}</span>
      <select
        value={selectedId}
        onChange={(event) => {
          const id = event.target.value
          if (id === CUSTOM_FONT_ID) {
            setCustomSelected(true)
            return
          }
          setCustomSelected(false)
          onValue(FONT_PRESETS.find((preset) => preset.id === id)?.value)
        }}
        className="w-full cursor-pointer rounded-md border border-border bg-card px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary"
      >
        {FONT_PRESETS.map((preset) => (
          <option key={preset.id} value={preset.id}>
            {preset.label}
          </option>
        ))}
        <option value={CUSTOM_FONT_ID}>Custom…</option>
      </select>
      {selectedId === CUSTOM_FONT_ID && (
        <input
          type="text"
          value={value ?? ''}
          placeholder="e.g. Verdana, sans-serif"
          onChange={(event) => {
            const raw = event.target.value

            if (raw === '') onValue(undefined)
            else {
              const parsed = parseFontFamily(raw)
              if (parsed !== undefined) onValue(raw)
            }
          }}
          className="w-full rounded-md border border-border bg-transparent px-2 py-1.5 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground focus:border-primary"
        />
      )}
    </div>
  )
}

export const EmbedBuilderForm = ({ settings, onChange }: EmbedBuilderFormProps) => {
  const { config, sizeId, fixedHeight } = settings
  const updateConfig = (patch: Partial<EmbedConfig>) => onChange({ ...settings, config: { ...config, ...patch } })

  const autoTheme = config.theme === 'auto'
  const pickerTheme = config.theme === 'light' ? 'light' : 'dark'

  const pickerValue = (key: EmbedColorKey): string => {
    const value = config[key]
    return value && value.length === 7 ? value : THEME_PICKER_DEFAULTS[pickerTheme][key]
  }

  return (
    <div className="flex flex-col gap-4">
      <div className={rowClass}>
        <span className={labelClass}>Mode</span>
        <div className="flex gap-1.5">
          {MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => updateConfig({ mode })}
              className={segmentClass(config.mode === mode)}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      <div className={rowClass}>
        <span className={labelClass}>Theme</span>
        <div className="flex gap-1.5">
          {THEMES.map((theme) => (
            <button
              key={theme}
              type="button"
              onClick={() => updateConfig({ theme })}
              className={segmentClass(config.theme === theme)}
            >
              {theme}
            </button>
          ))}
        </div>
      </div>

      <div className={rowClass}>
        <span className={labelClass}>Colours</span>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {COLOR_FIELDS.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="font-mono text-[11px] text-foreground">{label}</span>
              <div className="flex items-center gap-1">
                <input
                  type="color"
                  value={pickerValue(key)}
                  disabled={autoTheme}
                  onChange={(event) => updateConfig({ [key]: event.target.value })}
                  className="h-6 w-8 cursor-pointer rounded border border-border bg-transparent disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label={`${label} colour`}
                />
                <button
                  type="button"
                  disabled={autoTheme || config[key] === undefined}
                  onClick={() => updateConfig({ [key]: undefined })}
                  title="Reset to theme default"
                  className="cursor-pointer font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
        {autoTheme && (
          <p className="font-mono text-[10px] text-muted-foreground">
            Auto follows the visitor's OS — pick fixed colours only with a fixed theme.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2">
        <span className={labelClass}>Radius (px)</span>
        <input
          type="number"
          min={0}
          max={24}
          value={config.radius}
          onChange={(event) => {
            const parsed = parseRadius(event.target.value)
            if (parsed !== undefined) updateConfig({ radius: parsed })
          }}
          className="w-16 rounded-md border border-border bg-transparent px-2 py-1 text-right font-mono text-xs text-foreground outline-none focus:border-primary"
        />
      </div>

      <FontField label="Font" value={config.font} onValue={(font) => updateConfig({ font })} />
      <FontField label="Mono font" value={config.fontMono} onValue={(fontMono) => updateConfig({ fontMono })} />

      <div className={rowClass}>
        <span className={labelClass}>Show</span>
        <div className="flex gap-4">
          {(
            [
              ['controls', 'Controls'],
              ['minimap', 'MiniMap'],
              ['toolbar', 'Toolbar'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-foreground">
              <input
                type="checkbox"
                checked={config[key]}
                onChange={(event) => updateConfig({ [key]: event.target.checked })}
                className="accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      <div className={rowClass}>
        <span className={labelClass}>Size</span>
        <div className="flex flex-wrap items-center gap-1.5">
          {SIZE_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => onChange({ ...settings, sizeId: preset.id })}
              className={segmentClass(sizeId === preset.id)}
            >
              {preset.label}
            </button>
          ))}
          {sizeId === 'fixed' && (
            <input
              type="number"
              min={MIN_FIXED_HEIGHT}
              max={MAX_FIXED_HEIGHT}
              value={fixedHeight}
              onChange={(event) => {
                const parsed = Number(event.target.value)
                if (Number.isFinite(parsed)) {
                  onChange({
                    ...settings,
                    fixedHeight: Math.min(MAX_FIXED_HEIGHT, Math.max(MIN_FIXED_HEIGHT, Math.round(parsed))),
                  })
                }
              }}
              className="w-20 rounded-md border border-border bg-transparent px-2 py-1 text-right font-mono text-xs text-foreground outline-none focus:border-primary"
              aria-label="Fixed height in px"
            />
          )}
        </div>
      </div>
    </div>
  )
}
