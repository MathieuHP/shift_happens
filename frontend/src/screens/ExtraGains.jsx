import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getEarnings, getPayoutAccount, startPayoutOnboarding } from '../api'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { getCurrentEmployeeId } from '../config'
import { formatDay, formatMoney } from '../format'

export default function ExtraGains() {
  const employeeId = getCurrentEmployeeId()
  const [searchParams] = useSearchParams()
  const [earnings, setEarnings] = useState(null) // null = chargement
  const [account, setAccount] = useState(null) // { status: 'none' | 'pending' | 'ready' }
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [earningsData, accountData] = await Promise.all([getEarnings(employeeId), getPayoutAccount(employeeId)])
        if (cancelled) return
        setEarnings(earningsData)
        setAccount(accountData)
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
  }, [employeeId])

  if (error && !earnings) return <p role="alert" className="text-orange">{error}</p>
  if (!earnings) return <p className="text-secondaire">Chargement…</p>

  const upcoming = earnings.items.filter((item) => item.status === 'upcoming')
  const paid = earnings.items.filter((item) => item.status === 'paid')

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold">Mes gains</h1>

      {/* Bloc vert : total reçu cette semaine */}
      <div className="mt-4 rounded-[14px] bg-vert p-5 text-white">
        <p className="text-sm font-medium opacity-90">Reçu cette semaine</p>
        <p className="mt-1 font-titre text-4xl font-bold">{formatMoney(earnings.week_total)}</p>
        <p className="mt-2 text-sm opacity-90">Virements Stripe (mode test), puis versés sur votre compte bancaire.</p>
      </div>

      <PayoutAccountCard
        employeeId={employeeId}
        status={account?.status}
        justReturned={searchParams.get('onboarding')}
      />

      {earnings.last_payment && (
        <p className="mt-4 rounded-[14px] bg-vert-clair p-3 font-medium text-vert-texte">
          Dernier paiement reçu : {formatMoney(earnings.last_payment.amount)} · {formatDay(earnings.last_payment.date)}
        </p>
      )}

      {earnings.items.length === 0 && (
        <p className="mt-6 text-secondaire">Aucun shift pour le moment. Vos shifts de remplacement apparaîtront ici.</p>
      )}
      <Group title="Shifts payés" items={paid} />
      <Group title="Shifts à venir" items={upcoming} />
    </div>
  )
}

// Compte de paiement Stripe : l'extra le configure une fois pour recevoir ses virements
function PayoutAccountCard({ employeeId, status, justReturned }) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function handleStart() {
    setBusy(true)
    setError('')
    try {
      const { url } = await startPayoutOnboarding(employeeId, email)
      window.location.assign(url) // formulaire d'inscription hébergé par Stripe
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  if (status === 'ready') {
    return (
      <p role="status" className="mt-4 flex items-center gap-2 rounded-[14px] border border-bordure bg-white p-3 font-medium">
        <Icon name="check" size={18} /> Compte de paiement prêt
      </p>
    )
  }

  return (
    <Card className="mt-4">
      <p className="font-titre text-lg font-bold">Compte de paiement</p>
      <p className="mt-1 text-sm text-secondaire">
        {status === 'pending'
          ? "Votre inscription Stripe n'est pas terminée ou en cours de vérification."
          : 'Pour recevoir vos paiements, créez votre compte de paiement (identité et IBAN, via Stripe).'}
      </p>
      {justReturned === 'done' && status === 'pending' && (
        <p role="status" className="mt-2 text-sm text-jaune-texte">Vérification en cours chez Stripe…</p>
      )}

      <label htmlFor="payout-email" className="mt-3 block text-sm font-medium text-secondaire">
        Votre adresse e-mail
      </label>
      <input
        id="payout-email"
        type="email"
        autoComplete="email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        className="mt-1 min-h-[44px] w-full rounded-[14px] border border-bordure bg-white px-3"
      />
      <Button className="mt-3 w-full" disabled={busy || !email} onClick={handleStart}>
        {status === 'pending' ? "Terminer l'inscription" : 'Configurer mon compte de paiement'}
      </Button>
      {error && <p role="alert" className="mt-2 text-orange">{error}</p>}
    </Card>
  )
}

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
