import { useEffect, useState } from 'react'
import { getDemoState, triggerDemoAbsence, triggerDemoNoShow } from '../api'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Icon from '../components/Icon'

const ROSTER_STATUS = {
  scheduled: { label: 'Planifié', color: 'gris' },
  available: { label: 'Disponible', color: 'vert' },
  absent: { label: 'Absent', color: 'orange' },
  called: { label: 'Appelé', color: 'jaune' },
  declined: { label: 'Refusé', color: 'gris' },
  accepted: { label: 'Accepte', color: 'vert' },
}

export default function GerantCascade() {
  const [state, setState] = useState(null)
  const [error, setError] = useState('')
  const [triggering, setTriggering] = useState(false)
  const [lastAction, setLastAction] = useState('')

  useEffect(() => {
    let cancelled = false

    getDemoState()
      .then((demoState) => {
        if (!cancelled) setState(demoState)
      })
      .catch(() => {
        if (!cancelled) setError('Backend indisponible. Lancez `npm run backend:dev`, puis rechargez.')
      })

    return () => {
      cancelled = true
    }
  }, [])

  async function runDemo(action, successMessage) {
    setTriggering(true)
    setError('')
    setLastAction('')
    try {
      await action()
      setState(await getDemoState())
      setLastAction(successMessage)
    } catch {
      setError("Impossible de déclencher la cascade de démo. Vérifiez que `npm run backend:dev` tourne sur le port 3000.")
    }
    setTriggering(false)
  }

  if (!state && !error) return <p className="text-secondaire">Chargement…</p>

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-titre text-2xl font-bold">Cascade autonome</h1>
        <p className="text-secondaire">Le manager dort, ShiftSaver trouve le remplaçant.</p>
      </div>

      {error && <p role="alert" className="rounded-[14px] bg-orange-clair p-3 font-medium text-orange-texte">{error}</p>}

      <div className="grid gap-3 sm:grid-cols-2">
        <Button
          className="w-full"
          disabled={triggering}
          onClick={() => runDemo(triggerDemoAbsence, 'SMS malade traité. Le dashboard a été mis à jour.')}
        >
          <Icon name="phone" size={18} />
          {triggering ? 'Cascade en cours…' : 'Simuler le SMS malade'}
        </Button>
        <Button
          variant="secondary"
          className="w-full"
          disabled={triggering}
          onClick={() => runDemo(triggerDemoNoShow, 'No-show détecté et remplacé automatiquement.')}
        >
          <Icon name="phone" size={18} />
          Simuler un no-show
        </Button>
      </div>

      {lastAction && (
        <p role="status" className="rounded-[14px] bg-vert-clair p-3 font-medium text-vert-texte">
          {lastAction}
        </p>
      )}

      {state && (
        <>
          <Card className={state.status === 'resolved' ? 'border-2 border-vert bg-vert-clair' : ''}>
            <p className="text-sm font-semibold text-secondaire">Notification manager</p>
            <p className="mt-1 font-titre text-2xl font-bold">
              {state.managerNotification ?? 'Aucune absence active.'}
            </p>
            {state.currentCase && (
              <p className="mt-2 text-sm font-semibold text-secondaire">
                Cas: {state.currentCase.trigger === 'no_show' ? 'no-show automatique' : 'SMS malade'} · {state.updatedAt}
              </p>
            )}
          </Card>

          <section>
            <h2 className="mb-2 font-titre text-lg font-bold">Planning</h2>
            <Card>
              {state.schedule.map((shift) => (
                <div key={shift.id} className="flex items-center justify-between gap-3">
                  <div>
                    <p className="font-titre text-xl font-bold">{shift.role}</p>
                    <p className="text-secondaire">{shift.startsAt} – {shift.endsAt}</p>
                    <p className="mt-1 text-sm">
                      {shift.employeeName}
                      {shift.replacementFor ? ` remplace ${shift.replacementFor}` : ''}
                    </p>
                  </div>
                  <Badge color={shift.status === 'covered' ? 'vert' : 'orange'}>{shift.status}</Badge>
                </div>
              ))}
            </Card>
          </section>

          <section>
            <h2 className="mb-2 font-titre text-lg font-bold">Équipe appelée</h2>
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
            <h2 className="mb-2 font-titre text-lg font-bold">Timeline live</h2>
            <Card className="py-0">
              {state.timeline.length === 0 ? (
                <p className="py-4 text-secondaire">En attente du SMS malade.</p>
              ) : (
                <ol className="divide-y divide-bordure">
                  {state.timeline.map((event, index) => (
                    <li key={index} className="py-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-secondaire">{event.type}</p>
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
