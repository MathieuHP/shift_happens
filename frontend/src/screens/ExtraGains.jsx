import { useEffect, useState } from 'react'
import { getEarnings, withdrawEarnings } from '../api'
import Badge from '../components/Badge'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { formatDay, formatMoney } from '../format'

export default function ExtraGains() {
  const [earnings, setEarnings] = useState(null) // null = chargement
  const [error, setError] = useState('')
  const [withdrawing, setWithdrawing] = useState(false)

  useEffect(() => {
    getEarnings()
      .then(setEarnings)
      .catch(() => setError('Impossible de charger vos gains.'))
  }, [])

  async function handleWithdraw() {
    setWithdrawing(true)
    setError('')
    try {
      await withdrawEarnings()
      setEarnings(await getEarnings()) // on recharge pour afficher le nouveau total
    } catch {
      setError('Le retrait a échoué. Réessayez.')
    }
    setWithdrawing(false)
  }

  if (error && !earnings) return <p role="alert" className="text-orange">{error}</p>
  if (!earnings) return <p className="text-secondaire">Chargement…</p>

  // On range les lignes dans trois groupes
  const upcoming = earnings.items.filter((item) => item.status === 'upcoming')
  const tips = earnings.items.filter((item) => item.status === 'paid' && item.type === 'tip')
  const paidShifts = earnings.items.filter((item) => item.status === 'paid' && item.type === 'shift')

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold">Mes gains</h1>

      {/* Bloc vert : total + retrait */}
      <div className="mt-4 rounded-[14px] bg-vert p-5 text-white">
        <p className="text-sm font-medium opacity-90">Reçu cette semaine</p>
        <p className="mt-1 font-titre text-4xl font-bold">{formatMoney(earnings.week_total)}</p>
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={withdrawing || earnings.withdrawn}
          className="mt-4 flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[14px] bg-white px-4 font-semibold text-vert-texte disabled:opacity-70"
        >
          {earnings.withdrawn ? (
            <>
              <Icon name="check" size={18} /> Retrait demandé
            </>
          ) : (
            'Retirer vers mon compte'
          )}
        </button>
      </div>
      {error && <p role="alert" className="mt-3 text-orange">{error}</p>}

      {/* Dernier paiement */}
      <p className="mt-4 rounded-[14px] bg-vert-clair p-3 font-medium text-vert-texte">
        Dernier paiement reçu : {formatMoney(earnings.last_payment.amount)} · {formatDay(earnings.last_payment.date)}
      </p>

      <Group title="Shifts payés" items={paidShifts} />
      <Group title="Pourboires" items={tips} />
      <Group title="Shifts à venir" items={upcoming} />
    </div>
  )
}

// Un groupe de lignes (ne s'affiche pas s'il est vide)
function Group({ title, items }) {
  if (items.length === 0) return null
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-titre text-lg font-bold">{title}</h2>
      <Card className="divide-y divide-bordure py-0">
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-3 py-3">
            <div>
              <p className="font-medium">{item.label}</p>
              <p className="text-sm capitalize text-secondaire">{formatDay(item.date)}</p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <p className="font-titre text-lg font-bold">{formatMoney(item.amount)}</p>
              <Badge color={item.status === 'paid' ? 'vert' : 'gris'}>
                {item.status === 'paid' ? 'Payé' : 'À venir'}
              </Badge>
            </div>
          </div>
        ))}
      </Card>
    </section>
  )
}
