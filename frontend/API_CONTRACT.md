# Contrat d'API (proposition du front)

À valider avec l'équipe backend (FastAPI). Le front utilise exactement ces routes et ces noms de champs (snake_case).
Tant que `VITE_API_URL` est vide dans `frontend/.env`, les écrans sans backend utilisent `src/mock.js`, qui renvoie les mêmes formes de JSON. Le flux in-app (section ci-dessous) a besoin du backend : `npm run backend:dev`.

Conventions : dates `"AAAA-MM-JJ"`, heures `"HH:MM"`, montants en euros (nombre, ex. `82.5`). Pas d'authentification pour l'instant. Toute erreur = code HTTP ≠ 2xx (le front affiche un message générique).
Le backend doit autoriser le CORS pour l'adresse du front (`http://localhost:5173`).

For the current hackathon integration, Vite proxies `/api/*` to the Next backend at `http://localhost:3000`, so no browser CORS setup is needed during local development.

---

## Écran « Remplacements » (démo en direct)

Toute l'équipe fixe est en poste ce soir ; Kash et Mathieu sont les seuls extras disponibles. Un déclenchement lance la recherche de remplaçant tout de suite (autopilot) : **Kash est contacté en premier, puis Mathieu**. L'écran se rafraîchit toutes les 3 s. Les horaires sont ceux du restaurant (Europe/Brussels, variable `RESTAURANT_TIMEZONE`). Ces routes sont protégées par `x-demo-secret` si `DEMO_SECRET` est défini.

### `GET /api/demo/state`
```json
{
  "mode": "live", "simulated": false, "status": "calling", "updatedAt": "2026-10-03T14:20:00.000Z",
  "managerNotification": "Jade n'a pas pointé. J'appelle Kash…",
  "roster": [
    { "id": "jade", "name": "Jade", "role": "Bar", "phone": "+3255500…", "status": "absent" },
    { "id": "kash", "name": "Kash", "role": "Salle", "phone": "+32…", "status": "called" },
    { "id": "mathieu", "name": "Mathieu", "role": "Bar", "phone": "+32…", "status": "queued" }
  ],
  "schedule": [ { "id": "tonight-jade", "role": "Bar", "startsAt": "16:25", "endsAt": "21:20", "status": "vacant", "employeeName": null, "replacementFor": null } ],
  "currentCase": { "id": "…", "trigger": "no_show", "absentEmployee": "Jade", "replacementEmployee": null, "shiftRole": "Bar", "startsAt": "16:25", "endsAt": "21:20", "candidateCount": 2, "cascadeStatus": "searching" },
  "timeline": [
    { "type": "no_show_detected", "message": "Jade n'a pas pointé : son shift commence dans 5 minutes.", "at": "2026-10-03T14:20:01.120Z", "time": "16:20:01" },
    { "type": "search_started", "message": "Offre envoyée à Kash, puis Mathieu.", "at": "2026-10-03T14:20:01.130Z", "time": "16:20:01" },
    { "type": "call_started", "message": "Appel de Kash…", "at": "2026-10-03T14:20:01.131Z", "time": "16:20:01" }
  ]
}
```
`timeline[].at` : instant exact (ISO) ; `timeline[].time` : heure du restaurant avec secondes. Types : `no_show_detected`, `absence_reported`, `search_started`, `call_started` (« Appel de Kash… », un par candidat, dans l'ordre), `offer_declined`, `replacement_accepted`, `case_resolved`, `no_replacement`.

`roster[].status` : `scheduled` (en poste), `available` (extra disponible), `queued` (dans la file), `called` (appelé en ce moment), `declined`, `accepted`, `absent`. `status` global : `idle`, `calling`, `resolved`. `schedule[].status` : `scheduled`, `vacant`, `covered`.

### `POST /api/demo/no-show`
Simule : Jade n'a pas pointé 5 minutes avant son shift. Renvoie `{ "started": true|false, …état comme ci-dessus }`. Un second clic pendant l'incident ne crée rien (`started: false`). Quand l'incident est fini, un nouveau clic repart d'un état propre.

### `POST /api/demo/absence`
Même cascade, déclenchée comme une absence signalée par SMS (`currentCase.trigger: "sick_sms"`). Aucun corps de requête.

### `POST /api/demo/reset`
Remet la démo à zéro (voir plus haut).

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

Ces routes sont **implémentées dans `backend/`** (Next.js, `backend/app/api/`). Le front les appelle toujours via le proxy `/api` (jamais de données factices). Pas d'authentification : l'employé est identifié par `employee_id` (comptes de démo : `mathieu`, `kash` (les deux seuls extras, de vraies personnes), `ines`, `tom`, `lucie`, `mehdi`, `jade`).
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

### `GET /api/shifts/open?employee_id=mathieu` — les offres reçues (écran « Shifts ouverts »)
Le champ `id` est l'identifiant de l'**offre**. Une offre reste valable jusqu'au début du shift.
```json
[ { "id": "6217…", "role": "Bar", "restaurant": "Coli Brasserie", "date": "2026-10-04",
    "start": "18:00", "end": "23:00", "hourly_rate": 16, "urgent": false } ]
```
`urgent` = le shift commence dans moins de 24 h. Le front calcule la durée et le total.

### `POST /api/shifts/{offer_id}/accept` et `/refuse`
```json
// requête
{ "employee_id": "mathieu" }
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

## Écran 4 — Gérant : Ce soir

### `GET /tonight`
`team[].status` : `present`, `late` ou `absent`. (Les heures à valider viennent maintenant de `GET /api/payables`.)
```json
{
  "date": "2026-10-07",
  "open_shift": { "role": "Bar", "start": "19:00", "end": "23:00", "contacted_count": 2 },
  "team": [
    { "name": "Inès", "role": "Salle", "status": "present" },
    { "name": "Mehdi", "role": "Cuisine", "status": "late" },
    { "name": "Jade", "role": "Bar", "status": "absent" }
  ]
}
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
        { "name": "Kash", "role": "Salle", "kind": "extra" }
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
    { "id": "x1", "name": "Kash", "role": "Salle", "type": "extra", "hourly_rate": 16 }
  ]
}
```

---

---

## Stripe : abonnement et paiement des shifts (backend réel, mode test)

Voir `docs/stripe-setup.md` pour la mise en place. Toutes ces routes sont dans `backend/app/api/`.

### Abonnement du restaurant (50 €/mois)
- `GET /api/billing/status` → `{ "status": "inactive|trialing|active|past_due|canceled", "entitled": true, "current_period_end": "2026-11-03T13:39:37.000Z", "has_customer": true }`. Mis à jour **uniquement** par les webhooks Stripe (le retour de la page de paiement n'active rien).
- `POST /api/billing/checkout` → `{ "url": "https://checkout.stripe.com/…" }` (le front redirige). Erreur `already_subscribed` (409) si déjà actif.
- `POST /api/billing/portal` → `{ "url": "https://billing.stripe.com/…" }` (gérer / annuler). Erreur `no_customer` (409) avant le premier abonnement.
- `POST /api/billing/webhook` : appelé par Stripe (signature `stripe-signature` vérifiée), pas par le front.
- Si `REQUIRE_SUBSCRIPTION=true` : `POST /api/absences` et `POST /api/absences/{id}/find-replacement` répondent **402** `entitlement_inactive` tant que l'abonnement n'est pas actif.

### Paiement des shifts
`status` : `to_validate`, `processing`, `paid`, `reversed`. Une ligne est créée pour chaque shift couvert par un remplaçant.
- `GET /api/payables`
```json
{ "items": [ { "id": "…", "shift_id": "shift-5", "employee_id": "mathieu", "employee_name": "Mathieu",
  "label": "Bar · Coli Brasserie", "date": "2026-10-04", "hours": 5, "hourly_rate": 16,
  "amount": 80, "amount_cents": 8000, "currency": "eur", "status": "to_validate",
  "stripe_transfer_id": null, "error": null, "has_payout_account": false } ],
  "to_validate_total": 80 }
```
- `POST /api/payables/pay-all` → `{ "results": [ { "id": "…", "employee_name": "Mathieu", "ok": false, "error": "…" } ], "paid": 0, "failed": 1 }`. Une ligne en échec n'empêche pas les autres ; un virement n'est jamais créé deux fois.
- `POST /api/payables/{id}/pay` → `{ "id": "…", "status": "paid", "stripe_transfer_id": "tr_…" }`. Erreurs : `payout_account_missing`, `payout_account_not_ready` (409), `shift_not_finished` (409, sauf `ALLOW_EARLY_PAYOUT=true`), `transfer_failed` (502).
- `GET /api/earnings?employee_id=mathieu` → `{ "week_total": 80, "last_payment": { "amount": 80, "date": "2026-10-04" } | null, "items": [ { "id": "…", "type": "shift", "label": "Bar · Coli Brasserie", "date": "2026-10-04", "amount": 80, "status": "paid|upcoming" } ] }`
- `GET /api/payout-account?employee_id=mathieu` → `{ "status": "none|pending|ready" }`
- `POST /api/payout-account` `{ "employee_id": "mathieu", "email": "mathieu@example.com" }` → `{ "url": "https://connect.stripe.com/…" }` (inscription hébergée par Stripe). Erreur `sandbox_required` (501) tant que les clés ne sont pas celles d'un sandbox Stripe.
