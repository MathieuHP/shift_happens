# Backend — appels vocaux pour les remplacements (état actuel)

La voix est branchée sur l'état **en mémoire** de la démo « Remplacements » (pas de Supabase). Pour tester en direct : `docs/voice-live-test.md`. Prompt et outil de l'agent : `docs/elevenlabs-agent-config.md`.

## 1. Comment ça marche

```
Déclencheur (POST /api/demo/no-show, absence, ou « Trouver un remplaçant » si VOICE_ENABLED=true)
   └─ le serveur décide : éligibles + ordre (Kash, puis Mathieu) → announceNextCall demande UN appel
        └─ dispatchPendingCalls : consentement + plage horaire OK ? → ElevenLabs lance l'appel (idempotent par offre)
             ├─ la personne décroche  → « a décroché » : le délai de 30 s est suspendu tant qu'elle parle
             ├─ l'agent appelle l'outil respond_to_offer → POST /api/voice/respond → oui / non enregistré
             ├─ 30 s sans décrocher / refus / échec / conversation finie sans réponse → candidat suivant
             └─ plus personne → alerte gérant (« Personne n'a répondu »)
```

Le **serveur décide de tout** (éligibilité, ordre, délai, gagnant). L'agent propose et transmet la réponse ; il ne choisit jamais un destinataire.

## 2. Routes

### `POST /api/voice/respond` — outil `respond_to_offer` de l'agent
- En-têtes : `x-voice-secret` (= `VOICE_TOOL_SECRET`), `x-conversation-id` (= `{{system__conversation_id}}`).
- Corps : `{ "answer": "yes" }` ou `{ "answer": "no" }`.
- L'offre est retrouvée à partir du `conversation_id` mémorisé au lancement de l'appel, jamais à partir de ce que dit le modèle.
- Réponse 200 : `{ "result": "accepted" | "pending_approval" | "declined" | "ignored" }`.
  `ignored` = rien n'a changé (trop tard : le tour est passé ; déjà pourvu ; doublon).
- Erreurs : `401 unauthorized` (secret), `400 missing_conversation_id` / `invalid_answer` / `invalid_json`, `404 conversation_not_found`.

### `POST /api/voice/status` — webhook ElevenLabs « échec d'initiation d'appel »
Signé (`elevenlabs-signature`, secret `ELEVENLABS_WEBHOOK_SECRET`). Occupé / injoignable / échec : on passe au suivant tout de suite. Facultatif.

### `POST /api/voice/advance` — fait avancer les délais (secret `x-voice-secret`)
Utile si personne ne lit l'état. L'écran Remplacements le fait déjà toutes les 3 s via `GET /api/demo/state`.

### `GET /api/voice/health` — diagnostic, aucun appel passé
Dit ce qui manque dans la configuration et vérifie chez ElevenLabs (lecture seule) que la clé est acceptée, que l'agent existe et que le numéro lui est assigné.

### Routes de l'application (toujours valables)
`POST /api/shifts/{offer_id}/accept|refuse` avec `{ "employee_id": "kash" }` : réponse donnée dans l'app (même logique, un seul gagnant). Voir `frontend/API_CONTRACT.md`.

## 3. Règles de timing
- **Délai sans réponse : `CALL_TIMEOUT_SECONDS` (30 s)**, compté depuis le début de l'appel.
- **Tant que la personne parle, le délai est suspendu.** Le décroché est détecté en lisant le statut de la conversation chez ElevenLabs (`in-progress`) à chaque lecture de l'état. Plafond de sécurité : `CALL_MAX_SECONDS` (180 s).
- Conversation terminée sans réponse enregistrée → tour terminé, candidat suivant.
- Les délais sont évalués à la lecture (pas de chronomètre) : si personne ne lit pendant un moment, ils sont rejoués dans l'ordre avec leurs vraies heures dans la timeline.

## 4. Règles de contact
Un candidat n'est appelé que s'il a donné son consentement (`contact_consent_at`) **et** si l'heure est dans la plage `CONTACT_WINDOW_START`–`CONTACT_WINDOW_END` (heure de Bruxelles). Sinon il est ignoré (« non contacté ») et on passe au suivant. `DEMO_PHONE_OVERRIDE` redirige tous les appels vers un seul numéro de test.

## 5. Variables d'environnement (`backend/.env.local`, jamais dans git)
`VOICE_ENABLED`, `ELEVENLABS_API_KEY`, `ELEVENLABS_AGENT_ID`, `ELEVENLABS_PHONE_NUMBER`, `ELEVENLABS_AGENT_PHONE_NUMBER_ID`, `VOICE_TOOL_SECRET`, `ELEVENLABS_WEBHOOK_SECRET` (facultatif), `CALL_TIMEOUT_SECONDS`, `CALL_MAX_SECONDS`, `CONTACT_WINDOW_START/END`, `DEMO_PHONE_KASH`, `DEMO_PHONE_MATHIEU`, `DEMO_PHONE_OVERRIDE`, `VOICE_AGENT_NAME` (défaut « Eleven »). Modèle : `backend/.env.example`.

## 6. Points d'attention
- **Variables du premier message de l'agent** : il commence par `{{greeting}} {{user_name}}, ici {{agent_name}}`. Elles doivent être envoyées à chaque appel (le backend le fait), sinon ElevenLabs raccroche dès le décroché.
- **Twilio** : le compte doit être autorisé à appeler la Belgique (Voice → Geo permissions), et, en mode essai, les numéros doivent être vérifiés.
- **Tunnel** : l'état est en mémoire dans un seul processus, donc l'outil de l'agent doit joindre ton backend via un tunnel. Son adresse change à chaque redémarrage : mettre alors à jour l'URL de l'outil chez ElevenLabs.
- **Ancien flux** (`/api/voice/twiml`, `/api/sms/inbound`, `lib/cascade/`, Supabase) : plus utilisé par la voix, ne pas brancher dessus.
- **Sécurité** : les routes `/api/shifts/*` et `/api/demo/*` n'ont pas d'authentification ; un tunnel les expose. À n'utiliser que pendant le test.
- Un redémarrage du backend remet la démo à zéro.
