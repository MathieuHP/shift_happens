import { useEffect, useState } from 'react'
import { getPayments } from '../api'
import Badge from '../components/Badge'
import Card from '../components/Card'
import { formatDay, formatMoney } from '../format'

export default function GerantPayments() {
  const [items, setItems] = useState(null) // null = chargement
  const [error, setError] = useState('')

  useEffect(() => {
    getPayments()
      .then((data) => setItems(data.items))
      .catch(() => setError('Impossible de charger les paiements.'))
  }, [])

  if (error) return <p role="alert" className="text-orange">{error}</p>
  if (!items) return <p className="text-secondaire">Chargement…</p>

  const pending = items.filter((item) => item.status === 'pending')
  const paid = items.filter((item) => item.status === 'paid')
  const sum = (list) => list.reduce((total, item) => total + item.amount, 0)

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold">Paiements</h1>

      {/* Deux totaux côte à côte */}
      <div className="mt-4 grid grid-cols-2 gap-3">
        <Card>
          <p className="text-sm text-secondaire">À valider</p>
          <p className="font-titre text-2xl font-bold text-orange">{formatMoney(sum(pending))}</p>
        </Card>
        <Card>
          <p className="text-sm text-secondaire">Payé</p>
          <p className="font-titre text-2xl font-bold text-vert">{formatMoney(sum(paid))}</p>
        </Card>
      </div>

      <Group title="À valider" items={pending} emptyText="Rien à valider." />
      <Group title="Payés" items={paid} emptyText="Aucun paiement." />
    </div>
  )
}

function Group({ title, items, emptyText }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-titre text-lg font-bold">{title}</h2>
      {items.length === 0 ? (
        <p className="text-secondaire">{emptyText}</p>
      ) : (
        <Card className="divide-y divide-bordure py-0">
          {items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-3 py-3">
              <div>
                <p className="font-medium">{item.name}</p>
                <p className="text-sm text-secondaire">
                  {item.label} · <span className="capitalize">{formatDay(item.date)}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <p className="font-titre text-lg font-bold">{formatMoney(item.amount)}</p>
                <Badge color={item.status === 'paid' ? 'vert' : 'jaune'}>
                  {item.status === 'paid' ? 'Payé' : 'À valider'}
                </Badge>
              </div>
            </div>
          ))}
        </Card>
      )}
    </section>
  )
}
