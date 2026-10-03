import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getBillingStatus, openBillingPortal, startCheckout } from '../api'
import Badge from './Badge'
import Button from './Button'
import Card from './Card'

// Étiquette selon le statut de l'abonnement
const STATUS = {
  active: { label: 'Actif', color: 'vert' },
  trialing: { label: 'Essai', color: 'vert' },
  past_due: { label: 'Paiement en retard', color: 'jaune' },
  canceled: { label: 'Annulé', color: 'orange' },
  inactive: { label: 'Pas d\'abonnement', color: 'gris' },
}

// Abonnement ShiftSaver (50 €/mois) — paiement Stripe en mode test
export default function SubscriptionPanel() {
  const [searchParams] = useSearchParams()
  const justPaid = searchParams.get('checkout') === 'success' // retour de la page de paiement Stripe
  const [billing, setBilling] = useState(null) // null = chargement
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  // Charge le statut. Après un paiement, on réessaie toutes les 2 s : c'est le webhook Stripe
  // (et non la page de retour) qui active l'abonnement.
  useEffect(() => {
    let cancelled = false
    let timer
    async function load() {
      try {
        const data = await getBillingStatus()
        if (cancelled) return
        setBilling(data)
        setError('')
        if (justPaid && !data.entitled) timer = setTimeout(load, 2000)
      } catch (err) {
        if (!cancelled) setError(err.message)
      }
    }
    load()
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [justPaid])

  // Redirige vers une page hébergée par Stripe (paiement ou gestion de l'abonnement)
  async function goTo(getUrl) {
    setBusy(true)
    setError('')
    try {
      const { url } = await getUrl()
      window.location.assign(url)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  const status = STATUS[billing?.status] ?? STATUS.inactive

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-titre text-lg font-bold">Abonnement ShiftSaver</p>
          <p className="text-sm text-secondaire">50,00 € par mois · mode test</p>
        </div>
        {billing && <Badge color={status.color}>{status.label}</Badge>}
      </div>

      {billing?.entitled && billing.current_period_end && (
        <p className="mt-2 text-sm text-secondaire">
          Prochain renouvellement : {new Date(billing.current_period_end).toLocaleDateString('fr-FR')}
        </p>
      )}
      {justPaid && billing && !billing.entitled && (
        <p role="status" className="mt-2 text-sm text-jaune-texte">
          Paiement reçu, activation en cours…
        </p>
      )}
      {billing && !billing.entitled && !justPaid && billing.status === 'inactive' && (
        <p className="mt-2 text-sm text-secondaire">Abonnez-vous pour activer le remplacement de shifts.</p>
      )}
      {error && <p role="alert" className="mt-2 text-orange">{error}</p>}

      <div className="mt-3 flex flex-col gap-2">
        {billing && !billing.entitled && (
          <Button disabled={busy} onClick={() => goTo(startCheckout)}>
            S'abonner
          </Button>
        )}
        {billing?.has_customer && (
          <Button variant="secondary" disabled={busy} onClick={() => goTo(openBillingPortal)}>
            Gérer l'abonnement
          </Button>
        )}
      </div>
    </Card>
  )
}
