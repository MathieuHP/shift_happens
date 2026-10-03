// Il n'y a pas d'authentification : sur l'accueil, on choisit qui on est (compte de démo).
// Le choix est gardé dans le navigateur (localStorage).
const KEY = 'shiftsaver.employee'

// Les identifiants sont ceux du backend (backend/lib/inapp/state.ts).
export const EMPLOYEES = [
  { id: 'sacha', name: 'Sacha', label: 'Extra · Salle' },
  { id: 'noor', name: 'Noor', label: 'Extra · Cuisine' },
  { id: 'eli', name: 'Eli', label: 'Extra · Bar' },
  { id: 'ines', name: 'Inès', label: 'Employée · Salle' },
  { id: 'tom', name: 'Tom', label: 'Employé · Salle' },
  { id: 'lucie', name: 'Lucie', label: 'Employée · Cuisine' },
  { id: 'mehdi', name: 'Mehdi', label: 'Employé · Cuisine' },
  { id: 'jade', name: 'Jade', label: 'Employée · Bar' },
]

export function getCurrentEmployeeId() {
  try {
    return localStorage.getItem(KEY) || 'sacha'
  } catch {
    return 'sacha' // localStorage peut être bloqué : on prend la valeur par défaut
  }
}

export function setCurrentEmployeeId(id) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    // pas grave : le choix ne sera pas gardé
  }
}
