import { useEffect, useState } from 'react'
import { getAvailability, saveAvailability } from '../api'
import Icon from '../components/Icon'
import WeekNav from '../components/WeekNav'
import { addDays, formatDayLong, formatDayShort } from '../format'

// Les 3 états d'une case. À chaque tap on passe à l'état suivant.
// L'état est toujours indiqué par couleur + icône + texte.
const STATUSES = {
  dispo: { label: 'Dispo', icon: 'check', style: 'bg-vert-clair text-vert-texte', next: 'si_besoin' },
  si_besoin: { label: 'Si besoin', icon: 'wave', style: 'bg-jaune-clair text-jaune-texte', next: 'indispo' },
  indispo: { label: 'Indispo', icon: 'cross', style: 'bg-gris-clair text-gris-texte', next: 'dispo' },
}

const SLOTS = [
  { key: 'midi', label: 'Midi' },
  { key: 'soir', label: 'Soir' },
]

const FIRST_WEEK = '2026-10-05' // lundi de la semaine affichée au départ

export default function ExtraDispos() {
  const [weekStart, setWeekStart] = useState(FIRST_WEEK)
  const [days, setDays] = useState(null) // null = en cours de chargement
  const [saveState, setSaveState] = useState('idle') // idle | saving | saved | error

  // Recharge la grille chaque fois qu'on change de semaine
  useEffect(() => {
    let cancelled = false
    getAvailability(weekStart)
      .then((data) => {
        if (!cancelled) setDays(data.days)
      })
      .catch(() => {
        if (!cancelled) setSaveState('error')
      })
    return () => {
      cancelled = true
    }
  }, [weekStart])

  // Changer de semaine : on vide la grille (affiche "Chargement…") puis l'effet recharge
  function changeWeek(days) {
    setDays(null)
    setWeekStart(addDays(weekStart, days))
  }

  async function handleTap(date, slot) {
    const newStatus = STATUSES[days.find((d) => d.date === date).slots[slot]].next

    // 1. On met à jour l'écran tout de suite
    setDays(days.map((d) => (d.date === date ? { ...d, slots: { ...d.slots, [slot]: newStatus } } : d)))

    // 2. On enregistre via l'API
    setSaveState('saving')
    try {
      await saveAvailability(date, slot, newStatus)
      setSaveState('saved')
    } catch {
      setSaveState('error')
    }
  }

  const saveMessage = {
    idle: 'Enregistré automatiquement',
    saving: 'Enregistrement…',
    saved: 'Enregistré automatiquement',
    error: "Erreur : les changements n'ont pas été enregistrés",
  }[saveState]

  return (
    <div>
      <h1 className="font-titre text-2xl font-bold">Mes disponibilités</h1>

      <div className="mt-4">
        <WeekNav weekStart={weekStart} onChange={changeWeek} />
      </div>

      {days === null ? (
        <p className="mt-6 text-secondaire">Chargement…</p>
      ) : (
        <div className="mt-4 grid grid-cols-[64px_1fr_1fr] items-center gap-2">
          {/* En-têtes de colonnes */}
          <div />
          {SLOTS.map((slot) => (
            <p key={slot.key} className="text-center text-sm font-semibold text-secondaire">
              {slot.label}
            </p>
          ))}

          {/* Une ligne par jour */}
          {days.map((day) => (
            <DayRow key={day.date} day={day} onTap={handleTap} />
          ))}
        </div>
      )}

      <p
        role="status"
        className={'mt-4 text-center text-sm ' + (saveState === 'error' ? 'text-orange' : 'text-secondaire')}
      >
        {saveMessage}
      </p>
    </div>
  )
}

// Une ligne de la grille : le nom du jour + deux cases (ou "Fermé")
function DayRow({ day, onTap }) {
  return (
    <>
      <p className="text-sm font-semibold capitalize">{formatDayShort(day.date)}</p>

      {day.closed ? (
        <p className="col-span-2 flex h-[54px] items-center justify-center rounded-[14px] border border-dashed border-bordure text-sm text-secondaire">
          Fermé
        </p>
      ) : (
        SLOTS.map((slot) => {
          const status = STATUSES[day.slots[slot.key]]
          return (
            <button
              key={slot.key}
              type="button"
              onClick={() => onTap(day.date, slot.key)}
              aria-label={`${formatDayLong(day.date)}, ${slot.label.toLowerCase()} : ${status.label}. Toucher pour changer.`}
              className={'flex h-[54px] items-center justify-center gap-1.5 rounded-[14px] text-sm font-semibold ' + status.style}
            >
              <Icon name={status.icon} size={18} />
              {status.label}
            </button>
          )
        })
      )}
    </>
  )
}
