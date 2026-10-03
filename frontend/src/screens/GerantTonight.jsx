import { useEffect, useState } from 'react'
import { getTonight, validateHours } from '../api'
import Badge from '../components/Badge'
import Button from '../components/Button'
import Card from '../components/Card'
import Icon from '../components/Icon'
import { formatDayLong, formatHours, formatMoney, formatRate } from '../format'

// Statut d'un membre de l'équipe -> texte + couleur de l'étiquette
const TEAM_STATUS = {
  present: { label: 'Présent', color: 'vert' },
  late: { label: 'En retard', color: 'jaune' },
  absent: { label: 'Absent', color: 'orange' },
}

export default function GerantTonight() {
  const [tonight, setTonight] = useState(null) // null = chargement
  const [error, setError] = useState('')
  const [paying, setPaying] = useState(false)

  useEffect(() => {
    getTonight()
      .then(setTonight)
      .catch(() => setError('Impossible de charger le service.'))
  }, [])

  async function handleValidate() {
    setPaying(true)
    setError('')
    try {
      await validateHours()
      setTonight(await getTonight()) // le statut passe à "paid"
    } catch {
      setError('Le paiement a échoué. Réessayez.')
    }
    setPaying(false)
  }

  if (error && !tonight) return <p role="alert" className="text-orange">{error}</p>
  if (!tonight) return <p className="text-secondaire">Chargement…</p>

  const { open_shift, team, hours_to_validate: hours } = tonight

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-titre text-2xl font-bold">Ce soir</h1>
        <p className="text-secondaire capitalize">{formatDayLong(tonight.date)} · Chez Odile</p>
      </div>

      {/* Shift à pourvoir */}
      <Card className="border-2 border-orange bg-orange-clair">
        <p className="text-sm font-semibold text-orange-texte">Shift à pourvoir</p>
        <p className="mt-1 font-titre text-2xl font-bold text-orange-texte">{open_shift.role}</p>
        <p className="font-medium text-orange-texte">
          {open_shift.start} – {open_shift.end}
        </p>
        <p className="mt-2 text-sm text-orange-texte">
          {open_shift.contacted_count} extras contactés
        </p>
      </Card>

      {/* Équipe du service */}
      <section>
        <h2 className="mb-2 font-titre text-lg font-bold">Équipe du service</h2>
        <Card className="divide-y divide-bordure py-0">
          {team.map((person) => (
            <div key={person.name} className="flex items-center justify-between py-3">
              <div>
                <p className="font-medium">{person.name}</p>
                <p className="text-sm text-secondaire">{person.role}</p>
              </div>
              <Badge color={TEAM_STATUS[person.status].color}>{TEAM_STATUS[person.status].label}</Badge>
            </div>
          ))}
        </Card>
      </section>

      {/* Heures à valider */}
      <section>
        <h2 className="mb-2 font-titre text-lg font-bold">Heures à valider</h2>
        <Card>
          <p className="text-sm text-secondaire">{hours.service}</p>
          <ul className="mt-2 divide-y divide-bordure">
            {hours.lines.map((line) => (
              <li key={line.name} className="flex items-center justify-between py-2">
                <span className="font-medium">{line.name}</span>
                <span className="text-sm text-secondaire">
                  {formatHours(line.hours)} × {formatRate(line.hourly_rate)} ={' '}
                  <span className="font-semibold text-texte">{formatMoney(line.hours * line.hourly_rate)}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-2 flex items-end justify-between border-t border-bordure pt-3">
            <p className="text-sm text-secondaire">Total</p>
            <p className="font-titre text-3xl font-bold">{formatMoney(hours.total)}</p>
          </div>

          {hours.status === 'paid' ? (
            <p role="status" className="mt-4 flex min-h-[44px] items-center justify-center gap-2 rounded-[14px] bg-vert-clair font-semibold text-vert-texte">
              <Icon name="check" size={18} /> Payé
            </p>
          ) : (
            <Button className="mt-4 w-full" disabled={paying} onClick={handleValidate}>
              {paying ? 'Paiement…' : 'Valider et payer'}
            </Button>
          )}
          {error && <p role="alert" className="mt-3 text-orange">{error}</p>}
        </Card>
      </section>
    </div>
  )
}
