// Données factices utilisées tant que le backend n'est pas prêt (VITE_API_URL vide).
// Restaurant « Chez Odile », semaine du 5 au 11 octobre 2026, fermé le lundi.
// Les noms des champs (snake_case) sont ceux décrits dans API_CONTRACT.md.
import { addDays } from './format.js'

// ---------- Écran 1 : disponibilités de l'extra ----------

// On garde les choix en mémoire : "2026-10-06|midi" -> "dispo"
const availabilityChoices = {}

// Valeur de départ (avant que l'extra ait tapé quoi que ce soit)
function defaultStatus(index, slot) {
  if (slot === 'midi') return index % 3 === 0 ? 'dispo' : 'indispo'
  return index % 2 === 0 ? 'dispo' : 'si_besoin'
}

export function getAvailability(weekStart) {
  const days = []
  for (let i = 0; i < 7; i++) {
    const date = addDays(weekStart, i)
    const closed = i === 0 // lundi fermé
    days.push({
      date,
      closed,
      slots: closed
        ? null
        : {
            midi: availabilityChoices[date + '|midi'] ?? defaultStatus(i, 'midi'),
            soir: availabilityChoices[date + '|soir'] ?? defaultStatus(i, 'soir'),
          },
    })
  }
  return { week_start: weekStart, days }
}

export function setAvailability(date, slot, status) {
  availabilityChoices[date + '|' + slot] = status
  return { date, slot, status }
}

// ---------- Écran 2 : shifts ouverts ----------

let openShifts = [
  {
    id: 'shift-1',
    role: 'Bar',
    restaurant: 'Chez Odile',
    date: '2026-10-07',
    start: '18:00',
    end: '23:00',
    hourly_rate: 16,
    urgent: true,
  },
  {
    id: 'shift-2',
    role: 'Commis de cuisine',
    restaurant: 'Chez Odile',
    date: '2026-10-08',
    start: '11:30',
    end: '15:30',
    hourly_rate: 15,
    urgent: false,
  },
  {
    id: 'shift-3',
    role: 'Service en salle',
    restaurant: 'Chez Odile',
    date: '2026-10-10',
    start: '18:30',
    end: '23:30',
    hourly_rate: 16.5,
    urgent: false,
  },
]

export function getOpenShifts() {
  return openShifts
}

// Accepter ou refuser : dans les deux cas le shift disparaît de la liste
export function answerShift(id, status) {
  openShifts = openShifts.filter((shift) => shift.id !== id)
  return { id, status }
}

// ---------- Écran 3 : gains ----------

let withdrawn = false

const earningItems = [
  { id: 'g1', type: 'shift', label: 'Salle · Chez Odile', date: '2026-10-05', amount: 80, status: 'paid' },
  { id: 'g2', type: 'shift', label: 'Bar · Chez Odile', date: '2026-10-06', amount: 82.5, status: 'paid' },
  { id: 'g3', type: 'tip', label: 'Pourboires du 6 oct.', date: '2026-10-06', amount: 18.4, status: 'paid' },
  { id: 'g4', type: 'shift', label: 'Bar · Chez Odile', date: '2026-10-07', amount: 80, status: 'upcoming' },
  { id: 'g5', type: 'shift', label: 'Salle · Chez Odile', date: '2026-10-10', amount: 82.5, status: 'upcoming' },
]

export function getEarnings() {
  const paid = earningItems.filter((item) => item.status === 'paid')
  const total = paid.reduce((sum, item) => sum + item.amount, 0)
  const last = paid[paid.length - 1]
  return {
    week_total: withdrawn ? 0 : total,
    withdrawn,
    last_payment: { amount: last.amount, date: last.date },
    items: earningItems,
  }
}

export function withdrawEarnings() {
  withdrawn = true
  return { status: 'requested' }
}

// ---------- Écran 4 : gérant, ce soir ----------

let hoursStatus = 'to_validate'

export function getTonight() {
  const lines = [
    { name: 'Sacha', hours: 4, hourly_rate: 16 },
    { name: 'Eli', hours: 4.5, hourly_rate: 15 },
  ]
  return {
    date: '2026-10-07',
    open_shift: { role: 'Bar', start: '19:00', end: '23:00', contacted_count: 2 },
    team: [
      { name: 'Inès', role: 'Salle', status: 'present' },
      { name: 'Tom', role: 'Salle', status: 'present' },
      { name: 'Lucie', role: 'Cuisine', status: 'present' },
      { name: 'Mehdi', role: 'Cuisine', status: 'late' },
      { name: 'Jade', role: 'Bar', status: 'absent' },
    ],
    hours_to_validate: {
      service: 'Service de midi',
      status: hoursStatus,
      lines,
      total: lines.reduce((sum, line) => sum + line.hours * line.hourly_rate, 0),
    },
  }
}

export function validateHours() {
  hoursStatus = 'paid'
  return { status: 'paid' }
}

// ---------- Écran 5 : gérant, planning de la semaine ----------

// Une pastille : un employé fixe, un extra, ou un shift à pourvoir
const fixe = (name, role) => ({ name, role, kind: 'fixe' })
const extra = (name, role) => ({ name, role, kind: 'extra' })
const aPourvoir = (role) => ({ name: null, role, kind: 'a_pourvoir' })

export function getPlanning(weekStart) {
  const week = [
    { closed: true },
    { midi: [fixe('Inès', 'Salle'), fixe('Lucie', 'Cuisine')], soir: [fixe('Tom', 'Salle'), fixe('Mehdi', 'Cuisine'), fixe('Jade', 'Bar')] },
    { midi: [fixe('Inès', 'Salle'), fixe('Mehdi', 'Cuisine')], soir: [fixe('Tom', 'Salle'), fixe('Lucie', 'Cuisine'), aPourvoir('Bar')] },
    { midi: [fixe('Inès', 'Salle'), fixe('Mehdi', 'Cuisine')], soir: [fixe('Tom', 'Salle'), fixe('Lucie', 'Cuisine'), fixe('Jade', 'Bar')] },
    { midi: [fixe('Inès', 'Salle'), fixe('Lucie', 'Cuisine')], soir: [fixe('Tom', 'Salle'), fixe('Mehdi', 'Cuisine'), fixe('Jade', 'Bar'), extra('Sacha', 'Salle')] },
    { midi: [fixe('Inès', 'Salle'), fixe('Mehdi', 'Cuisine'), extra('Noor', 'Cuisine')], soir: [fixe('Tom', 'Salle'), fixe('Lucie', 'Cuisine'), fixe('Jade', 'Bar'), extra('Sacha', 'Salle'), aPourvoir('Cuisine')] },
    { midi: [fixe('Inès', 'Salle'), fixe('Lucie', 'Cuisine'), extra('Eli', 'Bar')], soir: [fixe('Tom', 'Salle'), fixe('Mehdi', 'Cuisine'), aPourvoir('Bar')] },
  ]
  return {
    week_start: weekStart,
    budget: { planned: 3180, limit: 4000 },
    days: week.map((day, i) => ({
      date: addDays(weekStart, i),
      closed: Boolean(day.closed),
      midi: day.midi ?? [],
      soir: day.soir ?? [],
    })),
  }
}

// ---------- Écran 6 : gérant, équipe ----------

export function getTeam() {
  return {
    members: [
      { id: 'e1', name: 'Inès', role: 'Salle', type: 'fixe', hourly_rate: 16 },
      { id: 'e2', name: 'Tom', role: 'Salle', type: 'fixe', hourly_rate: 16 },
      { id: 'e3', name: 'Lucie', role: 'Cuisine', type: 'fixe', hourly_rate: 17 },
      { id: 'e4', name: 'Mehdi', role: 'Cuisine', type: 'fixe', hourly_rate: 16 },
      { id: 'e5', name: 'Jade', role: 'Bar', type: 'fixe', hourly_rate: 16 },
      { id: 'x1', name: 'Sacha', role: 'Salle', type: 'extra', hourly_rate: 16 },
      { id: 'x2', name: 'Noor', role: 'Cuisine', type: 'extra', hourly_rate: 15 },
      { id: 'x3', name: 'Eli', role: 'Bar', type: 'extra', hourly_rate: 15 },
    ],
  }
}

// ---------- Écran 7 : gérant, paiements ----------

export function getPayments() {
  // Les heures du service de midi sont "en attente" tant que le gérant n'a pas validé sur l'écran Ce soir
  const validated = hoursStatus === 'paid'
  return {
    items: [
      { id: 'p1', name: 'Sacha', label: 'Salle · service de midi', date: '2026-10-07', amount: 64, status: validated ? 'paid' : 'pending' },
      { id: 'p2', name: 'Eli', label: 'Bar · service de midi', date: '2026-10-07', amount: 67.5, status: validated ? 'paid' : 'pending' },
      { id: 'p3', name: 'Noor', label: 'Cuisine · service du soir', date: '2026-10-06', amount: 82.5, status: 'paid' },
      { id: 'p4', name: 'Sacha', label: 'Salle · service du soir', date: '2026-10-06', amount: 80, status: 'paid' },
    ],
  }
}
