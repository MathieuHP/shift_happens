import { useEffect, useState } from 'react'
import { acceptShift, getOpenShifts, refuseShift } from '../api'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { formatDay, formatHours, formatMoney, formatRate, hoursBetween } from '../format'

export default function ExtraShifts() {
  const [shifts, setShifts] = useState(null) // null = chargement
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null) // shift en cours d'envoi

  useEffect(() => {
    getOpenShifts()
      .then(setShifts)
      .catch(() => setError('Impossible de charger les shifts.'))
  }, [])

  async function handleAnswer(shift, accept) {
    setBusyId(shift.id)
    setError('')
    try {
      if (accept) await acceptShift(shift.id)
      else await refuseShift(shift.id)

      // La carte disparaît de la liste
      setShifts(shifts.filter((s) => s.id !== shift.id))
      setConfirmation(accept ? `Shift accepté : ${shift.role}, ${formatDay(shift.date)} · le gérant est prévenu` : '')
    } catch {
      setError("Une erreur s'est produite. Réessayez.")
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

      {shifts === null && !error && <p className="mt-6 text-secondaire">Chargement…</p>}
      {shifts !== null && shifts.length === 0 && (
        <p className="mt-6 text-secondaire">Aucun shift ouvert pour le moment.</p>
      )}

      <ul className="mt-4 flex flex-col gap-3">
        {shifts?.map((shift) => {
          const hours = hoursBetween(shift.start, shift.end)
          return (
            <li key={shift.id}>
              <Card className={shift.urgent ? 'border-2 border-orange' : ''}>
                {shift.urgent && (
                  <div className="mb-2">
                    <Badge color="orange">Urgent · ce soir</Badge>
                  </div>
                )}
                <p className="font-titre text-xl font-bold">{shift.role}</p>
                <p className="text-secondaire">{shift.restaurant}</p>
                <p className="mt-2 font-medium capitalize">
                  {formatDay(shift.date)} · {shift.start} – {shift.end}
                </p>

                <div className="mt-3 flex items-end justify-between">
                  <p className="text-sm text-secondaire">
                    {formatHours(hours)} × {formatRate(shift.hourly_rate)}
                  </p>
                  <p className="font-titre text-3xl font-bold">{formatMoney(hours * shift.hourly_rate)}</p>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button variant="secondary" disabled={busyId === shift.id} onClick={() => handleAnswer(shift, false)}>
                    Refuser
                  </Button>
                  <Button disabled={busyId === shift.id} onClick={() => handleAnswer(shift, true)}>
                    Accepter
                  </Button>
                </div>
              </Card>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
