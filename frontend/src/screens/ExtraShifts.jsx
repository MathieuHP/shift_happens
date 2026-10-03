import { useEffect, useState } from 'react'
import { acceptShift, getMyShifts, getOpenShifts, refuseShift, reportShift } from '../api'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { getCurrentEmployeeId } from '../config'
import { formatDay, formatHours, formatMoney, formatRate, hoursBetween } from '../format'

export default function ExtraShifts() {
  const employeeId = getCurrentEmployeeId()
  const [offers, setOffers] = useState(null) // offres de remplacement ; null = chargement
  const [myShifts, setMyShifts] = useState([]) // mes prochains shifts
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null) // offre en cours d'envoi
  const [reloadKey, setReloadKey] = useState(0) // on l'augmente pour recharger les données

  // Charge les données, puis les rafraîchit toutes les 5 secondes (pour voir les nouvelles offres)
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [offersData, shiftsData] = await Promise.all([getOpenShifts(employeeId), getMyShifts(employeeId)])
        if (cancelled) return
        setOffers(offersData)
        setMyShifts(shiftsData.shifts)
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
  }, [employeeId, reloadKey])

  async function handleAnswer(offer, accept) {
    setBusyId(offer.id)
    setError('')
    try {
      const result = accept ? await acceptShift(offer.id, employeeId) : await refuseShift(offer.id, employeeId)

      if (result.outcome === 'ignored') {
        setConfirmation("Ce shift n'est plus disponible.")
      } else if (result.outcome === 'pending_approval') {
        setConfirmation(`Réponse envoyée : ${offer.role}, ${formatDay(offer.date)} · en attente de la confirmation du gérant`)
      } else if (accept) {
        setConfirmation(`Shift accepté : ${offer.role}, ${formatDay(offer.date)} · le gérant est prévenu`)
      } else {
        setConfirmation('')
      }
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err.message)
    }
    setBusyId(null)
  }

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold">Shifts ouverts</h1>

      {confirmation && (
        <p role="status" className="mt-4 flex items-start gap-2 rounded-[14px] bg-vert-clair p-3 font-medium text-vert-texte">
          <Icon name="check" />
          {confirmation}
        </p>
      )}
      {error && <p role="alert" className="mt-4 text-orange">{error}</p>}

      {offers === null && !error && <p className="mt-6 text-secondaire">Chargement…</p>}
      {offers !== null && offers.length === 0 && (
        <p className="mt-6 text-secondaire">Aucun shift ouvert pour le moment.</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {offers?.map((offer) => {
          const hours = hoursBetween(offer.start, offer.end)
          return (
            <li key={offer.id}>
              <Card className={offer.urgent ? 'border-2 border-orange' : ''}>
                {offer.urgent && (
                  <div className="mb-2">
                    <Badge color="orange">Urgent · ce soir</Badge>
                  </div>
                )}
                <p className="font-titre text-xl font-bold">{offer.role}</p>
                <p className="text-secondaire">{offer.restaurant}</p>
                <p className="mt-2 font-medium capitalize">
                  {formatDay(offer.date)} · {offer.start} – {offer.end}
                </p>

                <div className="mt-3 flex items-end justify-between">
                  <p className="text-sm text-secondaire">
                    {formatHours(hours)} × {formatRate(offer.hourly_rate)}
                  </p>
                  <p className="font-titre text-3xl font-bold">{formatMoney(hours * offer.hourly_rate)}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" disabled={busyId === offer.id} onClick={() => handleAnswer(offer, false)}>
                    Refuser
                  </Button>
                  <Button disabled={busyId === offer.id} onClick={() => handleAnswer(offer, true)}>
                    Accepter
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>

      <h2 className="mt-8 font-titre text-xl font-bold">Mes prochains shifts</h2>
      {myShifts.length === 0 && <p className="mt-2 text-secondaire">Aucun shift prévu.</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {myShifts.map((shift) => (
          <li key={shift.id}>
            <MyShiftCard
              shift={shift}
              employeeId={employeeId}
              onReported={() => setReloadKey((key) => key + 1)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

// Un de mes shifts, avec les boutons "Retard" et "Absence"
function MyShiftCard({ shift, employeeId, onReported }) {
  const [mode, setMode] = useState(null) // null | 'delay' | 'absence' : formulaire ouvert
  const [eta, setEta] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')

  const hasAbsence = shift.reported.includes('absence')
  const hasDelay = shift.reported.includes('delay')

  async function send(kind) {
    setSending(true)
    setError('')
    try {
      await reportShift(employeeId, shift.id, kind, kind === 'delay' && eta ? eta : null)
      setMode(null)
      onReported()
    } catch (err) {
      setError(err.message)
    }
    setSending(false)
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-titre text-lg font-bold">{shift.role}</p>
          <p className="font-medium capitalize">
            {formatDay(shift.date)} · {shift.start} – {shift.end}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {hasAbsence && <Badge color="orange">Absence signalée</Badge>}
          {hasDelay && <Badge color="jaune">Retard signalé</Badge>}
        </div>
      </div>

      {/* Boutons de départ (pas d'absence déjà signalée, pas de formulaire ouvert) */}
      {!hasAbsence && mode === null && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          {!hasDelay && (
            <Button variant="secondary" onClick={() => setMode('delay')}>
              Retard
            </Button>
          )}
          <Button variant="secondary" className={hasDelay ? 'col-span-2' : ''} onClick={() => setMode('absence')}>
            Absence
          </Button>
        </div>
      )}

      {mode === 'delay' && (
        <div className="mt-3">
          <label htmlFor={'eta-' + shift.id} className="block text-sm font-medium text-secondaire">
            Heure d'arrivée estimée (facultatif)
          </label>
          <input
            id={'eta-' + shift.id}
            type="time"
            value={eta}
            onChange={(event) => setEta(event.target.value)}
            className="mt-1 min-h-[44px] w-full rounded-[14px] border border-bordure bg-white px-3"
          />
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button variant="secondary" disabled={sending} onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button disabled={sending} onClick={() => send('delay')}>
              Prévenir
            </Button>
          </div>
        </div>
      )}

      {mode === 'absence' && (
        <div className="mt-3">
          <p className="font-medium">Confirmer votre absence ? Le gérant en sera informé.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <Button variant="secondary" disabled={sending} onClick={() => setMode(null)}>
              Annuler
            </Button>
            <Button disabled={sending} onClick={() => send('absence')}>
              Confirmer
            </Button>
          </div>
        </div>
      )}

      {error && <p role="alert" className="mt-3 text-orange">{error}</p>}
    </Card>
  )
}
