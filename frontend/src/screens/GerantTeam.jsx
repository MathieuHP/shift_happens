import { useEffect, useState } from 'react'
import { getTeam } from '../api'
import Badge from '../components/Badge'
import Card from '../components/Card'
import { formatRate } from '../format'

export default function GerantTeam() {
  const [members, setMembers] = useState(null) // null = chargement
  const [error, setError] = useState('')

  useEffect(() => {
    getTeam()
      .then((data) => setMembers(data.members))
      .catch(() => setError("Impossible de charger l'équipe."))
  }, [])

  if (error) return <p role="alert" className="text-orange">{error}</p>
  if (!members) return <p className="text-secondaire">Chargement…</p>

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold">Équipe</h1>
      <Group title="Employés fixes" members={members.filter((m) => m.type === 'fixe')} />
      <Group title="Extras" members={members.filter((m) => m.type === 'extra')} />
    </div>
  )
}

// Une liste de personnes (employés fixes ou extras)
function Group({ title, members }) {
  return (
    <section className="mt-6">
      <h2 className="mb-2 font-titre text-lg font-bold">
        {title} <span className="text-base font-medium text-secondaire">({members.length})</span>
      </h2>
      <Card className="divide-y divide-bordure py-0">
        {members.map((member) => (
          <div key={member.id} className="flex items-center justify-between py-3">
            <div>
              <p className="font-medium">{member.name}</p>
              <p className="text-sm text-secondaire">{formatRate(member.hourly_rate)} / h</p>
            </div>
            <Badge color={member.type === 'extra' ? 'vert' : 'gris'}>{member.role}</Badge>
          </div>
        ))}
      </Card>
    </section>
  )
}
