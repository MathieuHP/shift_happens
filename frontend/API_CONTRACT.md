# Contrat d'API (proposition du front)

À valider avec l'équipe backend (FastAPI). Le front utilise exactement ces routes et ces noms de champs (snake_case).
Tant que `VITE_API_URL` est vide dans `frontend/.env`, les écrans sans backend utilisent `src/mock.js`, qui renvoie les mêmes formes de JSON. Le flux in-app (section ci-dessous) a besoin du backend : `npm run backend:dev`.

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

### `POST /api/demo/no-show`
Triggers the automated no-show escalation: no check-in, one call to the scheduled employee, no answer, then replacement cascade.

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

## Flux in-app — signalement, recherche de remplaçant, offres (backend réel)

Ces routes sont **implémentées dans `backend/`** (Next.js, `backend/app/api/`). Le front les appelle toujours via le proxy `/api` (jamais de données factices). Pas d'authentification : l'employé est identifié par `employee_id` (comptes de démo : `sacha`, `noor`, `eli`, `ines`, `tom`, `lucie`, `mehdi`, `jade`).
Les heures sont en UTC (`"HH:MM"`). Erreur : `{ "error": { "code": "...", "message": "..." } }` avec un code HTTP 4xx/5xx.

### `GET /api/my-shifts?employee_id=jade`
```json
{ "shifts": [ { "id": "shift-5", "role": "Bar", "date": "2026-10-04", "start": "18:00", "end": "23:00", "reported": ["absence"] } ] }
```

### `POST /api/absences` — l'employé signale une absence ou un retard
`kind` : `absence` ou `delay`. `eta` (facultatif, retard seulement) : `"HH:MM"`. Un seul signalement par employé, shift et type (le doublon renvoie `created: false`).
```json
// requête
{ "employee_id": "jade", "shift_id": "shift-5", "kind": "absence" }
// réponse
{ "id": "4b07…", "kind": "absence", "status": "open", "created": true }
```
Erreurs : `not_your_shift` (403), `shift_started` (409), `employee_not_found` (404).

### `GET /api/absences` — liste pour le gérant
`status` : `open` (absence), `delay_noted` (retard), `searching`, `pending_approval`, `resolved`, `unresolved` (alerte : aucun remplaçant).
```json
{ "items": [ {
  "id": "4b07…", "kind": "absence", "status": "searching", "eta": null,
  "employee_name": "Jade", "replacement_name": null,
  "shift": { "role": "Bar", "date": "2026-10-04", "start": "18:00", "end": "23:00" },
  "offers_sent": 2, "offers_declined": 0, "created_at": "2026-10-03T12:53:05.243Z"
} ] }
```

### `POST /api/absences/{id}/find-replacement` — le gérant lance la recherche
Sans corps. Calcule les remplaçants éligibles (rôle ou compétence, pas de chevauchement, repos 11 h avant et après, consentement de contact) et leur envoie une offre à tous. Un second appel ne renvoie pas d'offres (`already_started: true`).
```json
{ "id": "4b07…", "status": "searching", "offers_sent": 2, "already_started": false }
```
Si personne n'est éligible : `status: "unresolved"` (alerte).

### `POST /api/absences/{id}/approve` et `/reject` — seulement si l'approbation est activée
Sans corps. `approve` affecte le remplaçant qui a accepté (`resolved`). `reject` le refuse (retour à `searching`, ou `unresolved` s'il n'y a plus personne).
```json
{ "id": "4b07…", "status": "resolved" }
```

### `GET /api/shifts/open?employee_id=eli` — les offres reçues (écran « Shifts ouverts »)
Le champ `id` est l'identifiant de l'**offre**. Une offre reste valable jusqu'au début du shift.
```json
[ { "id": "6217…", "role": "Bar", "restaurant": "Chez Odile", "date": "2026-10-04",
    "start": "18:00", "end": "23:00", "hourly_rate": 16, "urgent": false } ]
```
`urgent` = le shift commence dans moins de 24 h. Le front calcule la durée et le total.

### `POST /api/shifts/{offer_id}/accept` et `/refuse`
```json
// requête
{ "employee_id": "eli" }
// réponse : outcome = accepted | pending_approval | declined | ignored
{ "id": "6217…", "outcome": "accepted" }
{ "id": "6217…", "outcome": "ignored", "reason": "closed" }
```
Le premier à accepter gagne ; une réponse en double ou tardive est ignorée (`ignored`). Si tout le monde refuse : le signalement passe `unresolved`.

### `GET /api/settings` et `PUT /api/settings`
`manager_approval_required` : `false` (autopilot, par défaut) ou `true` (le gérant confirme chaque remplaçant).
```json
{ "manager_approval_required": true }
```

### `POST /api/demo/reset` — remet les données de démo à zéro
Protégé par l'en-tête `x-demo-secret` si `DEMO_SECRET` est défini côté backend (comme les autres `/api/demo/*`).

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

## Écran 5 — Gérant : Planning de la semaine (navigation de semaine incluse)

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

---

## Écran 6 — Gérant : Équipe

### `GET /team`
`type` : `fixe` ou `extra`.
```json
{
  "members": [
    { "id": "e1", "name": "Inès", "role": "Salle", "type": "fixe", "hourly_rate": 16 },
    { "id": "x1", "name": "Sacha", "role": "Salle", "type": "extra", "hourly_rate": 16 }
  ]
}
```

---

## Écran 7 — Gérant : Paiements

### `GET /payments`
`status` : `pending` (heures pas encore validées) ou `paid`. Après `POST /tonight/validate-hours`, les lignes concernées doivent passer à `paid`.
```json
{
  "items": [
    { "id": "p1", "name": "Sacha", "label": "Salle · service de midi", "date": "2026-10-07", "amount": 64, "status": "pending" },
    { "id": "p3", "name": "Noor", "label": "Cuisine · service du soir", "date": "2026-10-06", "amount": 82.5, "status": "paid" }
  ]
}
```
