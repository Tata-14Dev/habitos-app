/** "Colores" in Settings: preset themes or a custom primary + accent + base. */
import { updateSettings } from '../../data/repo'
import { Card, cx, SectionTitle } from '../components'
import { LANG, t } from '../i18n'
import {
  BASE_IDS,
  isCompatible,
  PRESETS,
  resolvePalette,
  setPalette,
  SWATCH_IDS,
  usePaletteChoice,
  type BaseId,
  type PaletteChoice,
  type PresetId,
  type SwatchId,
} from '../palette'
import { BASES, SWATCHES } from '../palette.data'

const lang = LANG === 'en' ? 1 : 0

function choose(choice: PaletteChoice) {
  setPalette(choice)
  void updateSettings({ palette: choice })
}

function Dot({ color, size = 'size-5' }: { color: string; size?: string }) {
  return <span className={cx('inline-block shrink-0 rounded-full ring-1 ring-black/10', size)} style={{ background: color }} aria-hidden />
}

/** Mini preview of a theme: its base color with the primary and accent dots. */
function Preview({ primary, accent, base }: { primary: SwatchId; accent: SwatchId; base: BaseId }) {
  return (
    <span className="flex items-center gap-1 rounded-full px-2 py-1" style={{ background: BASES[base].neutral[900] }} aria-hidden>
      <Dot color={SWATCHES[primary].dark.button} size="size-4" />
      <Dot color={SWATCHES[accent].dark.button} size="size-4" />
    </span>
  )
}

function SwatchRow({
  label,
  value,
  disabled,
  onPick,
}: {
  label: string
  value: SwatchId
  disabled?: (id: SwatchId) => boolean
  onPick: (id: SwatchId) => void
}) {
  return (
    <div>
      <p className="mb-1 text-sm text-ink-soft dark:text-neutral-400">{label}</p>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {SWATCH_IDS.map((id) => {
          const off = disabled?.(id) ?? false
          const name = SWATCHES[id].name[lang]
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={value === id}
              aria-label={off ? t('{name} (poco contraste con el principal)', { name }) : name}
              title={off ? t('{name} (poco contraste con el principal)', { name }) : name}
              disabled={off}
              onClick={() => onPick(id)}
              className={cx(
                'grid size-11 place-items-center rounded-full transition',
                value === id ? 'ring-2 ring-ink ring-offset-2 ring-offset-white dark:ring-neutral-100 dark:ring-offset-neutral-800' : '',
                off && 'cursor-not-allowed opacity-25',
              )}
            >
              <span className="size-8 rounded-full" style={{ background: `linear-gradient(135deg, ${SWATCHES[id].light.button}, ${SWATCHES[id].dark.button})` }} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function ColorsCard() {
  const choice = usePaletteChoice()
  const current = resolvePalette(choice)

  const pickCustom = (patch: Partial<{ primary: SwatchId; accent: SwatchId; base: BaseId }>) => {
    const next = { ...current, ...patch }
    // Keep the accent valid when the primary changes.
    if (!isCompatible(next.primary, next.accent)) next.accent = resolvePalette({ preset: 'custom', primary: next.primary }).accent
    choose({ preset: 'custom', ...next })
  }

  return (
    <Card>
      <SectionTitle>{t('Colores')}</SectionTitle>
      <div className="grid grid-cols-2 gap-2">
        {(Object.keys(PRESETS) as PresetId[]).map((id) => {
          const p = PRESETS[id]
          const active = choice.preset === id
          return (
            <button
              key={id}
              type="button"
              aria-pressed={active}
              onClick={() => choose({ preset: id })}
              className={cx(
                'flex min-h-12 items-center justify-between gap-2 rounded-xl border-2 px-3 py-2 text-left',
                active ? 'border-primary bg-primary/10' : 'border-transparent bg-paper dark:bg-neutral-900',
              )}
            >
              <span className="font-medium">{p.name[lang]}</span>
              <Preview primary={p.primary} accent={p.accent} base={p.base} />
            </button>
          )
        })}
      </div>
      <button
        type="button"
        aria-pressed={choice.preset === 'custom'}
        onClick={() => choose({ preset: 'custom', ...current })}
        className={cx(
          'mt-2 flex min-h-12 w-full items-center justify-between rounded-xl border-2 px-3 py-2 text-left',
          choice.preset === 'custom' ? 'border-primary bg-primary/10' : 'border-transparent bg-paper dark:bg-neutral-900',
        )}
      >
        <span className="font-medium">{t('🎨 Personalizado')}</span>
        <Preview {...current} />
      </button>

      {choice.preset === 'custom' && (
        <div className="mt-4 space-y-4">
          <SwatchRow label={t('Color principal')} value={current.primary} onPick={(primary) => pickCustom({ primary })} />
          <SwatchRow
            label={t('Color de acento')}
            value={current.accent}
            disabled={(id) => id === current.primary || !isCompatible(current.primary, id)}
            onPick={(accent) => pickCustom({ accent })}
          />
          <div>
            <p className="mb-1 text-sm text-ink-soft dark:text-neutral-400">{t('Fondo')}</p>
            <div className="grid grid-cols-2 gap-2">
              {BASE_IDS.map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={current.base === id}
                  onClick={() => pickCustom({ base: id })}
                  className={cx(
                    'flex min-h-11 items-center gap-2 rounded-xl border-2 px-3',
                    current.base === id ? 'border-primary bg-primary/10' : 'border-transparent bg-paper dark:bg-neutral-900',
                  )}
                >
                  <Dot color={BASES[id].neutral[900]} />
                  {BASES[id].name[lang]}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-ink-soft dark:text-neutral-400">
            {t('Los acentos deshabilitados se confunden con el principal para personas con daltonismo o en los gráficos.')}
          </p>
        </div>
      )}
    </Card>
  )
}
