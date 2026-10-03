import { useEffect, useState } from 'react'
import { getPayables } from '../api'
import Badge from '../components/Badge'
import Card from '../components/Card'
import PayablesCard from '../components/PayablesCard'
import SubscriptionPanel from '../components/SubscriptionPanel'
import { formatDay, formatMoney } from '../format'

const STATUS = {
  paid: { label: 'Payé', color: 'vert' },
  reversed: { label: 'Annulé', color: 'orange' },
}

export default function GerantPayments() {
  const [items, setItems] = useState(null) // null = chargement
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getPayables()
        if (!cancelled) setItems(data.items)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    const timer = setInterval(load, 5000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [])

  const history = (items ?? []).filter((item) => item.status === 'paid' || item.status === 'reversed')
  const paidTotal = history.filter((item) => item.status === 'paid').reduce((sum, item) => sum + item.amount, 0)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-titre text-2xl font-bold">Paiements</h1>

      <SubscriptionPanel />

      <section>
        <h2 className="mb-2 font-titre text-lg font-bold">Heures à valider</h2>
        <PayablesCard />
      </section>

      <section>
        <div className="mb-2 flex items-end justify-between">
          <h2 className="font-titre text-lg font-bold">Payés aux extras</h2>
          <p className="font-titre text-xl font-bold text-vert">{formatMoney(paidTotal)}</p>
        </div>
        {error && <p role="alert" className="text-orange">{error}</p>}
        {items !== null && history.length === 0 && <p className="text-secondaire">Aucun paiement.</p>}
        {history.length > 0 && (
          <Card className="divide-y divide-bordure py-0">
            {history.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 py-3">
                <div>
                  <p className="font-medium">{item.employee_name}</p>
                  <p className="text-sm text-secondaire">
                    {item.label} · <span className="capitalize">{formatDay(item.date)}</span>
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <p className="font-titre text-lg font-bold">{formatMoney(item.amount)}</p>
                  <Badge color={STATUS[item.status].color}>{STATUS[item.status].label}</Badge>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
