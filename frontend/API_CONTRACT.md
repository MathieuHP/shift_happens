# Contrat d'API (proposition du front)

À valider avec l'équipe backend (FastAPI). Le front utilise exactement ces routes et ces noms de champs (snake_case).
Tant que `VITE_API_URL` est vide dans `frontend/.env`, le front utilise `src/mock.js`, qui renvoie les mêmes formes de JSON.

Conventions : dates `"AAAA-MM-JJ"`, heures `"HH:MM"`, montants en euros (nombre, ex. `82.5`). Pas d'authentification pour l'instant. Toute erreur = code HTTP ≠ 2xx (le front affiche un message générique).
Le backend doit autoriser le CORS pour l'adresse du front (`http://localhost:5173`).

For the current hackathon integration, Vite proxies `/api/*` to the Next backend at `http://localhost:3000`, so no browser CORS setup is needed during local development.

---

## Écran démo — Cascade ShiftSaver

### `GET /api/demo/state`
Returns the current manager dashboard state: `status`, `roster`, `schedule`, `currentCase`, `timeline`, `managerNotification`.

### `POST /api/demo/absence`
Triggers the autonomous replacement cascade.
```json
{ "fromPhone": "+15550001001", "body": "I am sick and cannot make my 8 AM shift" }
```

---

## Écran 1 — Disponibilités de l'extra

### `GET /availability?week_start=2026-10-05`
`week_start` est toujours un lundi. Statuts possibles : `dispo`, `si_besoin`, `indispo`. Créneaux : `midi`, `soir`.
```json
{
  "week_start": "2026-10-05",
  "days": [
    { "date": "2026-10-05", "closed": true, "slots": null },
    { "date": "2026-10-06", "closed": false, "slots": { "midi": "dispo", "soir": "si_besoin" } }
  ]
}
```
(7 jours, du lundi au dimanche. Jour fermé : `closed: true` et `slots: null`.)

### `PUT /availability` — appelé à chaque tap
```json
// requête
{ "date": "2026-10-06", "slot": "midi", "status": "indispo" }
// réponse
{ "date": "2026-10-06", "slot": "midi", "status": "indispo" }
```

---

## Écran 2 — Shifts ouverts (extra)

### `GET /shifts/open`
```json
[
  {
    "id": "shift-1",
    "role": "Bar",
    "restaurant": "Chez Odile",
    "date": "2026-10-07",
    "start": "18:00",
    "end": "23:00",
    "hourly_rate": 16,
    "urgent": true
  }
]
```
Le front calcule lui-même la durée (5 h), « 5 h × 16 € » et le total (80,00 €).

### `POST /shifts/{id}/accept` et `POST /shifts/{id}/refuse`
Sans corps de requête.
```json
{ "id": "shift-1", "status": "accepted" }
```
(`"refused"` pour le refus.)

---

## Écran 3 — Gains (extra)

### `GET /earnings`
`items[].type` : `shift` ou `tip`. `items[].status` : `paid` ou `upcoming`.
`week_total` = total déjà reçu cette semaine (peut valoir 0 après un retrait).
```json
{
  "week_total": 180.9,
  "withdrawn": false,
  "last_payment": { "amount": 18.4, "date": "2026-10-06" },
  "items": [
    { "id": "g1", "type": "shift", "label": "Salle · Chez Odile", "date": "2026-10-05", "amount": 80, "status": "paid" },
    { "id": "g3", "type": "tip", "label": "Pourboires du 6 oct.", "date": "2026-10-06", "amount": 18.4, "status": "paid" },
    { "id": "g4", "type": "shift", "label": "Bar · Chez Odile", "date": "2026-10-07", "amount": 80, "status": "upcoming" }
  ]
}
```

### `POST /earnings/withdraw` — « Retirer vers mon compte »
Sans corps. Le front rappelle ensuite `GET /earnings`.
```json
{ "status": "requested" }
```

---

## Écran 4 — Gérant : Ce soir

### `GET /tonight`
`team[].status` : `present`, `late` ou `absent`. `hours_to_validate.status` : `to_validate` ou `paid`.
```json
{
  "date": "2026-10-07",
  "open_shift": { "role": "Bar", "start": "19:00", "end": "23:00", "contacted_count": 2 },
  "team": [
    { "name": "Inès", "role": "Salle", "status": "present" },
    { "name": "Mehdi", "role": "Cuisine", "status": "late" },
    { "name": "Jade", "role": "Bar", "status": "absent" }
  ],
  "hours_to_validate": {
    "service": "Service de midi",
    "status": "to_validate",
    "lines": [
      { "name": "Sacha", "hours": 4, "hourly_rate": 16 },
      { "name": "Eli", "hours": 4.5, "hourly_rate": 15 }
    ],
    "total": 131.5
  }
}
```

### `POST /tonight/validate-hours` — « Valider et payer »
Sans corps. Le front rappelle ensuite `GET /tonight` (le statut doit alors valoir `paid`).
```json
{ "status": "paid" }
```

---

## Écran 5 — Gérant : Planning de la semaine

### `GET /planning?week_start=2026-10-05`
Une pastille (`midi` / `soir`) : `kind` vaut `fixe` (employé fixe), `extra`, ou `a_pourvoir` (alors `name` est `null`).
Le front compte lui-même les shifts à pourvoir et les extras. Le coût de main-d'œuvre vient du backend.
```json
{
  "week_start": "2026-10-05",
  "budget": { "planned": 3180, "limit": 4000 },
  "days": [
    { "date": "2026-10-05", "closed": true, "midi": [], "soir": [] },
    {
      "date": "2026-10-06",
      "closed": false,
      "midi": [
        { "name": "Inès", "role": "Salle", "kind": "fixe" },
        { "name": "Noor", "role": "Cuisine", "kind": "extra" }
      ],
      "soir": [
        { "name": null, "role": "Bar", "kind": "a_pourvoir" }
      ]
    }
  ]
}
```
