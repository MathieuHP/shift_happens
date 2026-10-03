import { useEffect, useState } from 'react'
import { getPlanning } from '../api'
import Card from '../components/Card'
import WeekNav from '../components/WeekNav'
import { addDays, formatDayShort, formatMoney } from '../format'

const FIRST_WEEK = '2026-10-05' // lundi de la semaine affichée au départ

// Les 3 styles de pastille
const PILL_STYLES = {
  fixe: 'border border-bordure bg-white',
  extra: 'bg-vert-clair text-vert-texte',
  a_pourvoir: 'border border-dashed border-orange bg-orange-clair text-orange-texte',
}

const ROWS = [
  { key: 'midi', label: 'Midi' },
  { key: 'soir', label: 'Soir' },
]

export default function GerantPlanning() {
  const [weekStart, setWeekStart] = useState(FIRST_WEEK)
  const [planning, setPlanning] = useState(null) // null = chargement
  const [error, setError] = useState('')

  // Recharge le planning chaque fois qu'on change de semaine
  useEffect(() => {
    let cancelled = false
    getPlanning(weekStart)
      .then((data) => {
        if (!cancelled) setPlanning(data)
      })
      .catch(() => {
        if (!cancelled) setError('Impossible de charger le planning.')
      })
    return () => {
      cancelled = true
    }
  }, [weekStart])

  // Changer de semaine : on vide l'écran (affiche "Chargement…") puis l'effet recharge
  function changeWeek(days) {
    setPlanning(null)
    setError('')
    setWeekStart(addDays(weekStart, days))
  }

  if (error) return <p role="alert" className="text-orange">{error}</p>
  if (!planning) return <p className="text-secondaire">Chargement…</p>

  // Les indicateurs sont calculés à partir de toutes les pastilles de la semaine
  const allPills = planning.days.flatMap((day) => [...day.midi, ...day.soir])
  const openCount = allPills.filter((pill) => pill.kind === 'a_pourvoir').length
  const extraCount = allPills.filter((pill) => pill.kind === 'extra').length
  const { planned, limit } = planning.budget
  const percent = Math.min(100, Math.round((planned / limit) * 100))

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold">Planning de la semaine</h1>
      <div className="mt-3 max-w-sm">
        <WeekNav weekStart={weekStart} onChange={changeWeek} />
      </div>

      {/* Trois indicateurs */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-secondaire">Shifts à pourvoir</p>
          <p className="font-titre text-3xl font-bold text-orange">{openCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-secondaire">Extras de la semaine</p>
          <p className="font-titre text-3xl font-bold">{extraCount}</p>
        </Card>
        <Card>
          <p className="text-sm text-secondaire">Main-d'œuvre prévue</p>
          <p className="font-titre text-3xl font-bold">
            {formatMoney(planned)} <span className="text-base font-medium text-secondaire">/ {formatMoney(limit)}</span>
          </p>
          <div
            role="progressbar"
            aria-label="Budget de main-d'œuvre utilisé"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
            className="mt-2 h-2 overflow-hidden rounded-full bg-gris-clair"
          >
            <div className="h-full bg-vert" style={{ width: percent + '%' }} />
          </div>
        </Card>
      </div>

      {/* Légende */}
      <ul className="mt-6 flex flex-wrap gap-4 text-sm text-secondaire">
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border border-bordure bg-white" /> Employé fixe
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded bg-vert-clair" /> Extra
        </li>
        <li className="flex items-center gap-2">
          <span className="h-4 w-4 rounded border border-dashed border-orange bg-orange-clair" /> À pourvoir
        </li>
      </ul>

      {/* Grille : défile horizontalement sur petit écran */}
      <div className="mt-3 overflow-x-auto">
        <div className="grid min-w-[860px] grid-cols-[56px_repeat(7,minmax(112px,1fr))] gap-2">
          <div />
          {planning.days.map((day) => (
            <p key={day.date} className="text-center text-sm font-semibold capitalize">
              {formatDayShort(day.date)}
            </p>
          ))}

          {ROWS.map((row) => (
            <Row key={row.key} row={row} days={planning.days} />
          ))}
        </div>
      </div>
    </div>
  )
}

// Une ligne de la grille (Midi ou Soir) : le titre + une cellule par jour
function Row({ row, days }) {
  return (
    <>
      <p className="pt-3 text-sm font-semibold text-secondaire">{row.label}</p>
      {days.map((day) => (
        <div key={day.date} className="flex min-h-[96px] flex-col gap-1.5 rounded-[14px] border border-bordure bg-white/60 p-1.5">
          {day.closed ? (
            <p className="m-auto text-sm text-secondaire">Fermé</p>
          ) : (
            day[row.key].map((pill, i) => (
              <div key={i} className={'rounded-lg px-2 py-1 text-sm leading-tight ' + PILL_STYLES[pill.kind]}>
                <p className="font-semibold">{pill.name ?? 'À pourvoir'}</p>
                <p className="text-xs opacity-80">{pill.role}</p>
              </div>
            ))
          )}
        </div>
      ))}
    </>
  )
}
