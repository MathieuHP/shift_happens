// Tous les appels réseau de l'app passent par ce fichier.
// - VITE_API_URL vide   -> on renvoie les données factices de mock.js
// - VITE_API_URL rempli -> on appelle la vraie API FastAPI
//
// Les routes et le format du JSON sont décrits dans API_CONTRACT.md.
import * as mock from './mock.js'

const API_URL = import.meta.env.VITE_API_URL
const API_BASE = API_URL || ''

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// Appelle la vraie API et renvoie le JSON de la réponse.
// Si le backend répond par une erreur, on garde son message (ex. « Ce shift n'est pas le vôtre. »).
async function request(path, method = 'GET', body) {
  let response
  try {
    response = await fetch(API_BASE + path, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    })
  } catch {
    throw new Error('Backend injoignable. Lancez « npm run backend:dev » à la racine du projet.')
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new Error(data?.error?.message ?? 'Erreur API ' + response.status)
  }
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

// Écran 4 — Gérant, ce soir
export const getTonight = () =>
  call('/tonight', 'GET', undefined, () => mock.getTonight())

// Écran 5 — Gérant, planning
export const getPlanning = (weekStart) =>
  call('/planning?week_start=' + weekStart, 'GET', undefined, () => mock.getPlanning(weekStart))

// ShiftSaver live demo — always calls the backend/proxy, never mock data.
export const getDemoState = () => request('/api/demo/state')

export const triggerDemoAbsence = () => request('/api/demo/absence', 'POST')

export const triggerDemoNoShow = () => request('/api/demo/no-show', 'POST')
export const resetDemo = () => request('/api/demo/reset', 'POST')

// Écran 6 — Gérant, équipe
export const getTeam = () =>
  call('/team', 'GET', undefined, () => mock.getTeam())

// Flux "tout dans l'app" (backend Next.js, via le proxy /api) — jamais de données factices.
// Voir API_CONTRACT.md.

// Extra / employé
export const getMyShifts = (employeeId) => request('/api/my-shifts?employee_id=' + employeeId)

export const reportShift = (employeeId, shiftId, kind, eta) =>
  request('/api/absences', 'POST', { employee_id: employeeId, shift_id: shiftId, kind, eta })

export const getOpenShifts = (employeeId) => request('/api/shifts/open?employee_id=' + employeeId)

export const acceptShift = (offerId, employeeId) =>
  request(`/api/shifts/${offerId}/accept`, 'POST', { employee_id: employeeId })

export const refuseShift = (offerId, employeeId) =>
  request(`/api/shifts/${offerId}/refuse`, 'POST', { employee_id: employeeId })

// Gérant
export const getReports = () => request('/api/absences')
export const findReplacement = (reportId) => request(`/api/absences/${reportId}/find-replacement`, 'POST')
export const approveReplacement = (reportId) => request(`/api/absences/${reportId}/approve`, 'POST')
export const rejectReplacement = (reportId) => request(`/api/absences/${reportId}/reject`, 'POST')
export const getSettings = () => request('/api/settings')
export const saveSettings = (settings) => request('/api/settings', 'PUT', settings)

// Abonnement du restaurant (Stripe Checkout, mode test)
export const getBillingStatus = () => request('/api/billing/status')
export const startCheckout = () => request('/api/billing/checkout', 'POST') // -> { url }
export const openBillingPortal = () => request('/api/billing/portal', 'POST') // -> { url }

// Paiement des shifts (Stripe Connect, mode test)
export const getPayables = () => request('/api/payables')
export const payAllPayables = () => request('/api/payables/pay-all', 'POST')
export const getEarnings = (employeeId) => request('/api/earnings?employee_id=' + employeeId)
export const getPayoutAccount = (employeeId) => request('/api/payout-account?employee_id=' + employeeId)
export const startPayoutOnboarding = (employeeId, email) =>
  request('/api/payout-account', 'POST', { employee_id: employeeId, email }) // -> { url }
