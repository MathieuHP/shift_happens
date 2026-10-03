import { useEffect, useState } from 'react'
import { getDemoState, resetDemo, triggerDemoAbsence, triggerDemoNoShow } from '../api'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Icon from '../components/Icon'

// Statut de chaque personne ce soir
const ROSTER_STATUS = {
  scheduled: { label: 'En poste', color: 'gris' },
  available: { label: 'Disponible', color: 'vert' },
  queued: { label: 'En file', color: 'gris' },
  called: { label: 'Appel en cours', color: 'jaune' },
  declined: { label: 'A refusé', color: 'gris' },
  accepted: { label: 'A accepté', color: 'vert' },
  absent: { label: 'Absent', color: 'orange' },
}

// Texte lisible pour chaque étape de la timeline
const EVENT_LABEL = {
  no_show_detected: 'No-show',
  absence_reported: 'Absence',
  search_started: 'Recherche',
  call_started: 'Appel',
  offer_declined: 'Refus',
  replacement_accepted: 'Accepté',
  case_resolved: 'Résolu',
  no_replacement: 'Alerte',
}

// Écran « Remplacements » : toute l'équipe est en poste ce soir, seuls Kash et Mathieu sont disponibles.
// Un no-show lance la recherche : Kash est contacté en premier, puis Mathieu.
export default function GerantReplacements() {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [lastAction, setLastAction] = useState('')
  const [reloadKey, setReloadKey] = useState(0)

  // Charge l'état, puis le rafraîchit toutes les 3 secondes pour suivre les réponses en direct
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const data = await getDemoState()
        if (cancelled) return
        setState(data)
        setError('')
      } catch {
        if (!cancelled) setError('Backend indisponible. Lancez `npm run backend:dev`, puis rechargez.')
      }
    }
    load()
    const timer = setInterval(load, 3000)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [reloadKey])

  async function run(action, message) {
    setBusy(true)
    setError('')
    setLastAction('')
    try {
      await action()
      setLastAction(message)
      setReloadKey((key) => key + 1)
    } catch (err) {
      setError(err.message)
    }
    setBusy(false)
  }

  if (!state && !error) return <p className="text-secondaire">Chargement…</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-titre text-2xl font-bold">Remplacements</h1>
        <p className="text-secondaire">Le gérant dort, ShiftSaver trouve le remplaçant.</p>
      </div>

      {error && <p role="alert" className="rounded-[14px] bg-orange-clair p-3 font-medium text-orange-texte">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button className="w-full" disabled={busy} onClick={() => run(triggerDemoNoShow, 'No-show détecté : la recherche de remplaçant est lancée.')}>
          <Icon name="phone" size={18} />
          Simuler un no-show
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() => run(triggerDemoAbsence, 'Absence signalée par SMS : la recherche de remplaçant est lancée.')}
        >
          <Icon name="phone" size={18} />
          Simuler le SMS malade
        </Button>
      </div>
      <Button variant="secondary" className="w-full" disabled={busy} onClick={() => run(resetDemo, 'Démo réinitialisée.')}>
        Réinitialiser la démo
      </Button>

      {lastAction && (
        <p role="status" className="rounded-[14px] bg-vert-clair p-3 font-medium text-vert-texte">
          {lastAction}
        </p>
      )}

      {state && (
        <>
          <Card className={state.status === 'resolved' ? 'border-2 border-vert bg-vert-clair' : ''}>
            <p className="text-sm font-semibold text-secondaire">Notification gérant</p>
            <p className="mt-1 font-titre text-2xl font-bold">{state.managerNotification ?? 'Aucune absence en cours.'}</p>
            {state.currentCase && (
              <p className="mt-2 text-sm font-semibold text-secondaire">
                Cas : {state.currentCase.trigger === 'no_show' ? 'no-show automatique' : 'absence signalée par SMS'} · shift{' '}
                {state.currentCase.shiftRole} {state.currentCase.startsAt} – {state.currentCase.endsAt}
              </p>
            )}
          </Card>

          <section>
            <h2 className="mb-2 font-titre text-lg font-bold">Planning de ce soir</h2>
            <Card className="divide-y divide-bordure py-0">
              {state.schedule.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium">
                      {shift.role} · {shift.employeeName ?? 'à pourvoir'}
                      {shift.replacementFor ? ` (remplace ${shift.replacementFor})` : ''}
                    </p>
                    <p className="text-sm text-secondaire">{shift.startsAt} – {shift.endsAt}</p>
                  </div>
                  <Badge color={shift.status === 'covered' ? 'vert' : shift.status === 'vacant' ? 'orange' : 'gris'}>
                    {{ scheduled: 'Planifié', vacant: 'À pourvoir', covered: 'Couvert' }[shift.status]}
                  </Badge>
                </div>
              ))}
            </Card>
          </section>

          <section>
            <h2 className="mb-2 font-titre text-lg font-bold">Équipe</h2>
            <Card className="divide-y divide-bordure py-0">
              {state.roster.map((employee) => (
                <div key={employee.id} className="flex items-center justify-between py-3">
                  <div>
                    <p className="font-medium">{employee.name}</p>
                    <p className="text-sm text-secondaire">{employee.role}</p>
                  </div>
                  <Badge color={ROSTER_STATUS[employee.status]?.color ?? 'gris'}>
                    {ROSTER_STATUS[employee.status]?.label ?? employee.status}
                  </Badge>
                </div>
              ))}
            </Card>
          </section>

          <section>
            <h2 className="mb-2 font-titre text-lg font-bold">Déroulé en direct</h2>
            <Card className="py-0">
              {state.timeline.length === 0 ? (
                <p className="py-4 text-secondaire">En attente d'un no-show ou d'une absence.</p>
              ) : (
                <ol className="divide-y divide-bordure">
                  {state.timeline.map((event, index) => (
                    <li key={index} className="py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondaire">
                        <time dateTime={event.at}>{event.time}</time> · {EVENT_LABEL[event.type] ?? event.type}
                      </p>
                      <p className="font-medium">{event.message}</p>
                    </li>
                  ))}
                </ol>
              )}
            </Card>
          </section>
        </>
      )}
    </div>
  )
}
