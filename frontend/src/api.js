// Tous les appels réseau de l'app passent par ce fichier.
// - VITE_API_URL vide   -> on renvoie les données factices de mock.js
// - VITE_API_URL rempli -> on appelle la vraie API FastAPI
//
// Les routes et le format du JSON sont décrits dans API_CONTRACT.md.
import * as mock from './mock.js'

const API_URL = import.meta.env.VITE_API_URL

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Appelle la vraie API et renvoie le JSON de la réponse.
async function request(path, method = 'GET', body) {
  const response = await fetch(API_URL + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!response.ok) throw new Error('Erreur API ' + response.status)
  return response.json()
}

// Si on a une API : on l'appelle. Sinon : on attend un peu (comme un vrai serveur) puis on utilise le mock.
async function call(path, method, body, mockFunction) {
  if (API_URL) return request(path, method, body)
  await wait(250)
  return mockFunction()
}

// Écran 1 — Disponibilités
export const getAvailability = (weekStart) =>
  call('/availability?week_start=' + weekStart, 'GET', undefined, () => mock.getAvailability(weekStart))

export const saveAvailability = (date, slot, status) =>
  call('/availability', 'PUT', { date, slot, status }, () => mock.setAvailability(date, slot, status))

// Écran 2 — Shifts ouverts
export const getOpenShifts = () =>
  call('/shifts/open', 'GET', undefined, () => mock.getOpenShifts())

export const acceptShift = (id) =>
  call(`/shifts/${id}/accept`, 'POST', undefined, () => mock.answerShift(id, 'accepted'))

export const refuseShift = (id) =>
  call(`/shifts/${id}/refuse`, 'POST', undefined, () => mock.answerShift(id, 'refused'))

// Écran 3 — Gains
export const getEarnings = () =>
  call('/earnings', 'GET', undefined, () => mock.getEarnings())

export const withdrawEarnings = () =>
  call('/earnings/withdraw', 'POST', undefined, () => mock.withdrawEarnings())

// Écran 4 — Gérant, ce soir
export const getTonight = () =>
  call('/tonight', 'GET', undefined, () => mock.getTonight())

export const validateHours = () =>
  call('/tonight/validate-hours', 'POST', undefined, () => mock.validateHours())

// Écran 5 — Gérant, planning
export const getPlanning = (weekStart) =>
  call('/planning?week_start=' + weekStart, 'GET', undefined, () => mock.getPlanning(weekStart))
