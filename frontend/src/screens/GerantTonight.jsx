import { useEffect, useState } from 'react'
import { getTonight } from '../api'
import Badge from '../components/Badge'
import Card from '../components/Card'
import PayablesCard from '../components/PayablesCard'
import ReportsPanel from '../components/ReportsPanel'
import { formatDayLong } from '../format'

// Statut d'un membre de l'équipe -> texte + couleur de l'étiquette
const TEAM_STATUS = {
  present: { label: 'Présent', color: 'vert' },
  late: { label: 'En retard', color: 'jaune' },
  absent: { label: 'Absent', color: 'orange' },
}

export default function GerantTonight() {
  const [tonight, setTonight] = useState(null) // null = chargement
  const [error, setError] = useState('')

  useEffect(() => {
    getTonight()
      .then(setTonight)
      .catch(() => setError('Impossible de charger le service.'))
  }, [])

  if (error && !tonight) return <p role="alert" className="text-orange">{error}</p>
  if (!tonight) return <p className="text-secondaire">Chargement…</p>

  const { open_shift, team } = tonight

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-titre text-2xl font-bold">Ce soir</h1>
        <p className="text-secondaire capitalize">{formatDayLong(tonight.date)} · Coli Brasserie</p>
      </div>

      {/* Absences et retards signalés par l'équipe (données du backend) */}
      <ReportsPanel />

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

      {/* Heures à valider : paiements des shifts couverts (données du backend, virement Stripe en mode test) */}
      <section>
        <h2 className="mb-2 font-titre text-lg font-bold">Heures à valider</h2>
        <PayablesCard />
      </section>
    </div>
  )
}
