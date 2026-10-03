// Tous les appels réseau de l'app passent par ce fichier.
// - VITE_API_URL vide   -> on renvoie les données factices de mock.js
// - VITE_API_URL rempli -> on appelle la vraie API FastAPI
//
// Chaque écran ajoute ici ses fonctions (voir API_CONTRACT.md).

export const API_URL = import.meta.env.VITE_API_URL
