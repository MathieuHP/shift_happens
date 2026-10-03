// Données factices pour les écrans dont les routes backend ne sont pas encore prêtes.
// Restaurant « Coli Brasserie », semaine du 5 au 11 octobre 2026, fermé le lundi.
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

// ---------- Écran 4 : gérant, ce soir ----------

export function getTonight() {
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
  }
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
    { midi: [fixe('Inès', 'Salle'), fixe('Lucie', 'Cuisine')], soir: [fixe('Tom', 'Salle'), fixe('Mehdi', 'Cuisine'), fixe('Jade', 'Bar'), extra('Kash', 'Salle')] },
    { midi: [fixe('Inès', 'Salle'), fixe('Mehdi', 'Cuisine'), extra('Kash', 'Salle')], soir: [fixe('Tom', 'Salle'), fixe('Lucie', 'Cuisine'), fixe('Jade', 'Bar'), extra('Mathieu', 'Bar'), aPourvoir('Cuisine')] },
    { midi: [fixe('Inès', 'Salle'), fixe('Lucie', 'Cuisine'), extra('Mathieu', 'Bar')], soir: [fixe('Tom', 'Salle'), fixe('Mehdi', 'Cuisine'), aPourvoir('Bar')] },
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
      { id: 'x1', name: 'Mathieu', role: 'Bar', type: 'extra', hourly_rate: 16 },
      { id: 'x2', name: 'Kash', role: 'Salle', type: 'extra', hourly_rate: 16 },
    ],
  }
}
