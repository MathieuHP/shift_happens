// Petites fonctions pour afficher dates, heures et montants en français.

// Montant : 56 -> "56,00 €"
export function formatMoney(amount) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount)
}

// Taux horaire : 16 -> "16 €", 16.5 -> "16,50 €"
export function formatRate(rate) {
  return Number.isInteger(rate) ? rate + ' €' : formatMoney(rate)
}

// Transforme "2026-10-07" en objet Date (à midi, pour éviter les décalages de fuseau)
function toDate(iso) {
  return new Date(iso + 'T12:00:00')
}

// "2026-10-07" -> "mer. 7 oct."
export function formatDay(iso) {
  return toDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })
}

// "2026-10-07" -> "mercredi 7 octobre"
export function formatDayLong(iso) {
  return toDate(iso).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

// "2026-10-07" -> "mer. 7"
export function formatDayShort(iso) {
  return toDate(iso).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}

// Ajoute (ou retire) des jours à une date ISO : addDays("2026-10-05", 7) -> "2026-10-12"
export function addDays(iso, days) {
  const date = toDate(iso)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

// "2026-10-05" + "2026-10-11" -> "5 – 11 oct. 2026"
export function formatWeek(startIso) {
  const start = toDate(startIso)
  const end = toDate(addDays(startIso, 6))
  const month = end.toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' })
  return `${start.getDate()} – ${end.getDate()} ${month}`
}

// Durée en heures entre "18:00" et "23:00" -> 5
export function hoursBetween(start, end) {
  const toHours = (time) => {
    const [h, m] = time.split(':').map(Number)
    return h + m / 60
  }
  let diff = toHours(end) - toHours(start)
  if (diff <= 0) diff += 24 // le shift finit après minuit
  return diff
}

// 5 -> "5 h", 5.5 -> "5,5 h"
export function formatHours(hours) {
  return String(hours).replace('.', ',') + ' h'
}
