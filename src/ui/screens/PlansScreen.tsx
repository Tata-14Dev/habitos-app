import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { createPlan } from '../../data/repo'
import { loadExample } from '../../data/seed'
import type { Plan } from '../../data/types'
import { Button, Card, Empty, ProgressBar, SectionTitle, Sheet } from '../components'
import { usePlanItems, usePlans, useToday } from '../hooks'
import { usePlanModel } from '../usePlanModel'
import { AmountSummary } from './AmountPlan'
import { CurrentLine } from './CurrentLine'
import { PlanForm } from './PlanForm'
import { fmtDate, marginText } from '../format'
import { t } from '../i18n'

export function PlansScreen() {
  const plans = usePlans()
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between pt-2">
        <h1 className="text-2xl font-semibold">{t('Planes')}</h1>
        <Button variant="primary" onClick={() => setCreating(true)}>
          {t('+ Nuevo')}
        </Button>
      </header>

      {!plans?.length ? (
        <Card>
          <Empty>{t('Todavía no tenés planes.')}</Empty>
          <Button className="w-full" onClick={() => void loadExample()}>
            {t('Cargar ejemplo (SOC Level 1)')}
          </Button>
        </Card>
      ) : (
        plans.map((p) => <PlanCard key={p.id} plan={p} />)
      )}

      <Sheet open={creating} onClose={() => setCreating(false)} title={t('Nuevo plan')}>
        <PlanForm
          submitLabel={t('Crear plan')}
          onSubmit={async (v) => {
            const plan = await createPlan(v)
            setCreating(false)
            navigate(`/planes/${plan.id}`)
          }}
        />
      </Sheet>
    </div>
  )
}

function PlanCard({ plan }: { plan: Plan }) {
  const today = useToday()
  return (
    <Link to={`/planes/${plan.id}`} className="block">
      <Card>
        <SectionTitle right={<span className="text-sm">{t('límite {date}', { date: fmtDate(plan.deadline, false) })}</span>}>{plan.name}</SectionTitle>
        {plan.kind === 'amount' ? <AmountSummary plan={plan} today={today} /> : <ItemsSummary plan={plan} today={today} />}
      </Card>
    </Link>
  )
}

function ItemsSummary({ plan, today }: { plan: Plan; today: string }) {
  const items = usePlanItems(plan.id)
  const model = usePlanModel(plan, items, today)
  return (
    <>
        <div className="mb-1 flex justify-between text-sm">
          <span>
            {model?.doneCount ?? 0}/{model?.total ?? 0} {plan.unit ?? t('hechos')}
          </span>
          {model?.metrics.ok && model.metrics.value.marginDays !== null && <span>{marginText(model.metrics.value.marginDays)}</span>}
        </div>
        <ProgressBar value={model?.total ? model.doneCount / model.total : null} />
        {items && <CurrentLine items={items} />}
    </>
  )
}
