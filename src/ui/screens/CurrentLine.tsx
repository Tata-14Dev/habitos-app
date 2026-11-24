import { currentItem } from '../../domain/plans'
import type { PlanItem } from '../../data/types'
import { t } from '../i18n'

/** "Vas por: Room 32" (first pending item), or nothing when the plan is done. */
export function CurrentLine({ items }: { items: PlanItem[] }) {
  const cur = currentItem(items)
  if (!cur) return null
  return (
    <p className="mt-2 text-sm">
      {t('📍 Vas por:')} <strong>{cur.title}</strong>
    </p>
  )
}
