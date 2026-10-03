import { useEffect, useState } from 'react'
import { getPayables, payAllPayables } from '../api'
import Button from './Button'
import Card from './Card'
import Icon from './Icon'
import { formatDay, formatHours, formatMoney, formatRate } from '../format'

// Heures à valider : un shift couvert par un remplaçant = une ligne à payer.
// "Valider et payer" envoie un virement Stripe (mode test) à chaque extra.
export default function PayablesCard() {
  const [data, setData] = useState(null) // null = chargement
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)
  const [failures, setFailures] = useState([])
  const [paidCount, setPaidCount] = useState(0)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const result = await getPayables()
        if (cancelled) return
        setData(result)
        setError('')
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
  }, [reloadKey])

  async function handlePay() {
    setPaying(true)
    setError('')
    try {
      const result = await payAllPayables()
      setFailures(result.results.filter((r) => !r.ok))
      setPaidCount(result.paid)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err.message)
    }
    setPaying(false)
  }

  if (!data && !error) return <p className="text-secondaire">Chargement…</p>
  if (!data) return <p role="alert" className="text-orange">{error}</p>

  const pending = data.items.filter((item) => item.status === 'to_validate' || item.status === 'processing')

  return (
    <Card>
      {pending.length === 0 ? (
        <p className="text-secondaire">Rien à valider pour le moment. Les shifts couverts par un remplaçant apparaîtront ici.</p>
      ) : (
        <>
          <ul className="divide-y divide-bordure">
            {pending.map((item) => (
              <li key={item.id} className="py-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{item.employee_name}</span>
                  <span className="text-sm text-secondaire">
                    {formatHours(item.hours)} × {formatRate(item.hourly_rate)} ={' '}
                    <span className="font-semibold text-texte">{formatMoney(item.amount)}</span>
                  </span>
                </div>
                <p className="text-sm text-secondaire">
                  {item.label} · <span className="capitalize">{formatDay(item.date)}</span>
                </p>
                {!item.has_payout_account && (
                  <p className="text-sm text-jaune-texte">Compte de paiement non configuré (à faire par l'extra)</p>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-end justify-between border-t border-bordure pt-3">
            <p className="text-sm text-secondaire">Total</p>
            <p className="font-titre text-3xl font-bold">{formatMoney(data.to_validate_total)}</p>
          </div>
          <Button className="mt-4 w-full" disabled={paying} onClick={handlePay}>
            {paying ? 'Paiement…' : 'Valider et payer'}
          </Button>
        </>
      )}

      {paidCount > 0 && failures.length === 0 && (
        <p role="status" className="mt-3 flex items-center gap-2 rounded-[14px] bg-vert-clair p-3 font-semibold text-vert-texte">
          <Icon name="check" size={18} /> {paidCount} paiement(s) envoyé(s)
        </p>
      )}
      {failures.map((failure) => (
        <p key={failure.id} role="alert" className="mt-3 text-orange">
          {failure.employee_name} : {failure.error}
        </p>
      ))}
      {error && <p role="alert" className="mt-3 text-orange">{error}</p>}
    </Card>
  )
}
