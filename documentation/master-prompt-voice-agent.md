# Master prompt — Agent vocal (Twilio + ElevenLabs) qui appelle les extras

Copier-coller le bloc « PROMPT » ci-dessous dans Claude Code (ou un autre agent de code) à la racine du dépôt, après avoir rempli le tableau des variables. Les valeurs secrètes vont dans `backend/.env.local` (jamais dans le dépôt).

## Variables à fournir

| Variable | Exemple | Rôle |
|---|---|---|
| `ELEVENLABS_API_KEY` | `sk_…` | Clé API ElevenLabs (backend uniquement) |
| `ELEVENLABS_AGENT_ID` | `agent_…` | Agent « Conversational AI » qui parle aux extras |
| `ELEVENLABS_PHONE_NUMBER_ID` | `phnum_…` | Numéro Twilio importé dans ElevenLabs (champ `agent_phone_number_id`) |
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` | `AC…` | Uniquement pour importer/configurer le numéro côté ElevenLabs |
| `TWILIO_PHONE_NUMBER` | `+32…` | Numéro de l'appelant affiché (E.164) |
| `VOICE_ENABLED` | `true` / `false` | Interrupteur général (faux = mode simulé étiqueté) |
| `VOICE_TOOL_SECRET` | chaîne aléatoire | Secret partagé : ElevenLabs l'envoie dans un en-tête quand l'agent appelle nos routes |
| `PUBLIC_BASE_URL` | `https://xxxx.ngrok.app` | URL publique du backend (les outils de l'agent doivent l'atteindre) |
| `DEMO_PHONE_MATHIEU` / `DEMO_PHONE_KASH` | `+32…` | Numéros réels des deux extras de la démo (seuls extras du seed, `backend/lib/inapp/state.ts`) ; lus depuis `.env.local`, jamais dans git |
| `DEMO_PHONE_OVERRIDE` | `+32…` | Si défini, TOUS les appels vont à ce numéro de test (jamais d'appel à un vrai extra pendant la démo) |
| `CALL_TIMEOUT_SECONDS` | `30` | Délai sans réponse avant de passer au candidat suivant. **Déjà géré côté serveur** (`advanceExpiredCalls` dans `backend/lib/inapp/service.ts`) : il suffit de lancer l'appel, de ne pas réimplémenter la minuterie |
| `CONTACT_WINDOW_START` / `_END` | `08:00` / `21:00` | Plage horaire autorisée pour appeler (heure du restaurant) |
| `VOICE_LANGUAGE` | `fr` | Langue de l'agent |

Variables dynamiques envoyées à l'agent au début de chaque appel (`conversation_initiation_client_data.dynamic_variables`) : `employee_first_name`, `restaurant_name`, `role`, `shift_date`, `shift_start`, `shift_end`, `hourly_rate`, `total_amount`, `response_deadline`, `language`. **Ne jamais y mettre d'identifiant d'offre ni de donnée sensible.**

---

## PROMPT

Tu es un ingénieur backend senior. Tu travailles dans le dépôt ShiftSaver (hackathon). Tu dois ajouter des **appels vocaux sortants** : quand le gérant lance la recherche d'un remplaçant, un agent IA vocal ElevenLabs, via un numéro Twilio, appelle les extras éligibles **un par un** pour leur proposer le shift. Avance par **petites étapes**, un commit par étape, avec tests, sur une **nouvelle branche** (`voice-agent`) — jamais directement sur `main`.

### 0. À lire avant de coder
- `backend/AGENTS.md` : cette version de Next.js a des changements incompatibles. Lis `backend/node_modules/next/dist/docs/` avant d'écrire une route (ex. `params` est une promesse).
- `documentation/09-open-decisions.md` (journal de décisions) et `documentation/05-architecture.md` / `documentation/07-risks.md` (principes voix, outils étroits, rien ne contourne le gérant). Les docs 04/05 décrivent déjà la voix ; l'in-app est la base actuelle.
- Code existant à **réutiliser, pas réécrire** : `backend/lib/inapp/service.ts` (`findReplacement`, `respondToOffer`, éligibilité), `backend/lib/inapp/state.ts` (état en mémoire), `backend/lib/inapp/http.ts` (`handle`), `backend/lib/security.ts`. L'ancien code SMS/voix (`backend/lib/cascade/`, `backend/lib/twilio/`, `backend/app/api/voice/`, `sms/`) est **obsolète** : ne t'y appuie pas, propose sa suppression dans une étape dédiée.
- Doc ElevenLabs : intégration Twilio native, API `POST /v1/convai/twilio/outbound-call`, outils webhook. **Vérifie les noms exacts des champs dans la doc officielle** avant de coder (ne les devine pas).

### 1. Règles non négociables
1. **Le serveur décide, pas l'IA.** L'éligibilité, l'ordre des candidats, l'affectation et les permissions restent du code déterministe (`respondToOffer` garantit un seul gagnant). L'agent vocal ne choisit jamais un destinataire et ne démarre jamais un appel.
2. **Le backend lance chaque appel**, un seul appel actif par recherche, dans l'ordre d'éligibilité. Délai `CALL_TIMEOUT_SECONDS` (30 s, minuterie déjà dans `advanceExpiredCalls`), puis candidat suivant.
3. **Outils de l'agent étroits et authentifiés.** L'agent n'a que : `respond_to_offer(answer: "yes" | "no")`. Le serveur retrouve l'offre à partir du `conversation_id` mémorisé à la création de l'appel — **jamais** à partir d'un identifiant dit par le modèle. Chaque requête d'outil exige l'en-tête secret `VOICE_TOOL_SECRET`.
4. **Consentement et horaires.** N'appelle que si `contact_consent_at` est renseigné **et** si l'heure est dans la plage `CONTACT_WINDOW_*`. Sinon, saute le candidat et journalise.
5. **Transparence.** L'agent annonce dès la première phrase qu'il est un assistant automatique. Enregistrement audio et transcription **désactivés** ; ne stocke que les identifiants d'appel et le résultat.
6. **Idempotence.** Enregistre une `CallAttempt` (+ clé d'idempotence) **avant** d'appeler ElevenLabs. Un timeout réseau ne doit jamais créer un second appel : réconcilie par les identifiants renvoyés avant de réessayer.
7. **Mode démo sûr.** Si `VOICE_ENABLED` n'est pas `true`, utilise un `VoiceProvider` simulé, clairement étiqueté « SIMULÉ » dans les logs et l'UI. Si `DEMO_PHONE_OVERRIDE` est défini, tous les appels vont à ce numéro. Aucun test automatisé n'appelle un vrai numéro.
8. L'acceptation vocale fonctionne comme l'acceptation dans l'app : elle passe par `respondToOffer`. Si l'offre n'est plus valable (déjà pourvue, shift commencé), l'agent le dit poliment et raccroche. Le réglage `manager_approval_required` s'applique (acceptation « en attente de confirmation » si activé : l'agent doit le dire).

### 2. Ce que l'agent doit dire (à mettre dans la configuration de l'agent ElevenLabs)
Prompt système de l'agent, en français, avec les variables dynamiques ci-dessus :

> Tu es l'assistant automatique de {{restaurant_name}}. Annonce-le tout de suite : « Bonjour {{employee_first_name}}, ici l'assistant automatique de {{restaurant_name}}. » Tu proposes un remplacement : un shift de {{role}} le {{shift_date}}, de {{shift_start}} à {{shift_end}}, payé {{hourly_rate}} € de l'heure, soit {{total_amount}} € au total. Demande : « Est-ce que vous pouvez le prendre ? Il faut répondre avant {{response_deadline}}. » Écoute la réponse, puis appelle l'outil `respond_to_offer` avec `yes` ou `no`. Si la réponse est ambiguë, pose UNE question de clarification ; si c'est encore ambigu, considère que c'est « non ». Ne promets rien : si le réglage de confirmation est actif, dis que le gérant doit valider. Ne demande jamais de raison médicale ni de donnée personnelle. Si la personne veut parler à un humain, dis que le gérant la rappellera. Sois bref (moins de 30 secondes), poli, et raccroche après la réponse.

Outil webhook `respond_to_offer` : `POST {{PUBLIC_BASE_URL}}/api/voice/respond`, en-têtes `x-voice-secret: {VOICE_TOOL_SECRET}` et `x-conversation-id: {{system__conversation_id}}`, corps `{ "answer": "yes" | "no" }`. La réponse JSON dit à l'agent quoi annoncer (`accepted`, `pending_approval`, `declined`, `ignored`).

### 3. Étapes de travail (un commit chacune)
1. **Contrat** : interface `VoiceProvider` (`placeCall`), implémentation simulée, implémentation ElevenLabs, tests avec un faux fournisseur. Variables d'environnement dans `backend/.env.example`.
2. **Modèle** : `CallAttempt` (offre, candidat, `conversation_id`, `call_sid`, statut `queued|calling|answered|no_answer|failed|completed`, clé d'idempotence). État en mémoire comme le reste, ou fichier JSON (`lib/store/jsonStore.ts`).
3. **Cascade vocale** : après `findReplacement`, lance le premier appel ; avance sur réponse de l'outil, sur statut de fin d'appel ou sur dépassement du délai. Gère : candidat sans consentement, hors plage horaire, offre déjà fermée, liste épuisée (→ alerte gérant existante « aucun remplaçant »).
4. **Route outil** `POST /api/voice/respond` (secret + `conversation_id` → `respondToOffer`). Tests : mauvais secret, conversation inconnue, doublon, offre fermée.
5. **Route de statut** d'appel (fin, pas de réponse, échec) pour faire avancer la cascade, plus un déclencheur de délai (route appelée toutes les 15–30 s ou minuterie serveur).
6. **Front** : dans le panneau gérant (`frontend/src/components/ReportsPanel.jsx`), afficher « Appel en cours : Prénom », « Pas de réponse », « Refus ». Mettre à jour `frontend/API_CONTRACT.md`.
7. **Nettoyage** : supprimer l'ancien code SMS/voix devenu inutile (après accord de l'équipe) ; mettre à jour `documentation/04`, `documentation/05`, `documentation/mvp-testing.md`.

### 4. Critères d'acceptation
- Test unitaire : 3 candidats, le 1er ne répond pas, le 2e refuse, le 3e accepte → shift affecté, appels dans l'ordre, jamais deux appels en même temps.
- Un candidat sans consentement ou hors plage horaire n'est jamais appelé.
- Rejouer le même appel/webhook ne crée ni second appel ni seconde affectation.
- `npm run backend:test`, `backend:lint`, `tsc --noEmit` et `frontend:lint` passent ; aucun secret dans le dépôt.
- Procédure de test manuel documentée : un vrai appel vers un numéro de test (`DEMO_PHONE_OVERRIDE`), journal des identifiants d'appel.

### 5. Hors périmètre
Appels entrants, reconnaissance d'intention d'absence par la voix, paiement (traité par ailleurs avec Stripe), authentification des utilisateurs, enregistrement audio.

Commence par résumer ton plan en 10 lignes et par me poser les questions qui bloquent (identifiants de l'agent et du numéro, URL publique disponible ou non), puis réalise l'étape 1.
