import Icon from './Icon'
import { formatWeek } from '../format'

// Flèches "semaine précédente / suivante" avec la semaine affichée au milieu.
// onChange reçoit -7 (semaine précédente) ou 7 (semaine suivante).
const arrowStyle = 'flex h-11 w-11 items-center justify-center rounded-[14px] border border-bordure bg-white'

export default function WeekNav({ weekStart, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <button type="button" aria-label="Semaine précédente" onClick={() => onChange(-7)} className={arrowStyle}>
        <Icon name="chevron-left" />
      </button>
      <p className="font-semibold">{formatWeek(weekStart)}</p>
      <button type="button" aria-label="Semaine suivante" onClick={() => onChange(7)} className={arrowStyle}>
        <Icon name="chevron-right" />
      </button>
    </div>
  )
}
