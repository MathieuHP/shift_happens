# Test en direct des appels vocaux (ElevenLabs + Twilio)

État : la voix est branchée sur l'état **en mémoire** de la démo « Remplacements ». Cliquer sur **Simuler un no-show** appelle **Kash**, puis **Mathieu** s'il ne répond pas (30 s) ou refuse. Tant que la personne **parle**, le délai de 30 s est suspendu (plafond de sécurité : `CALL_MAX_SECONDS`, 180 s).

## 0. Ce qui est déjà configuré (`backend/.env.local`, jamais dans git)
`VOICE_ENABLED=true`, clé et identifiants ElevenLabs, `VOICE_TOOL_SECRET` (généré), `CALL_TIMEOUT_SECONDS=30`, plage d'appel `09:00–20:00` (heure de Bruxelles : **hors de cette plage, les candidats sont ignorés** ; à élargir si le test a lieu plus tard), numéros réels de Kash et Mathieu.

## 1. Vérifier la configuration (aucun appel n'est passé)
```bash
curl localhost:3000/api/voice/health
```
Doit répondre `"ready": true` et `provider_check: "ok : agent …"`. Sinon, `problems` dit ce qui manque.

## 2. Rendre le backend joignable par ElevenLabs
L'agent doit appeler `POST /api/voice/respond` : le backend (processus unique, état en mémoire) doit donc avoir une adresse publique. Un tunnel suffit :
```bash
cloudflared tunnel --url http://localhost:3000     # ou : ngrok http 3000
```
Noter l'adresse `https://xxxx…` affichée. ⚠️ Elle expose tout le backend : à n'utiliser que pendant le test.

## 3. Configurer l'outil de l'agent dans ElevenLabs (une fois par tunnel)
Outil webhook `respond_to_offer` :
- Méthode `POST`, URL : `https://<adresse-du-tunnel>/api/voice/respond`
- En-têtes : `x-voice-secret` = la valeur de `VOICE_TOOL_SECRET` (`grep VOICE_TOOL_SECRET backend/.env.local`), `x-conversation-id` = `{{system__conversation_id}}`
- Corps : `{ "answer": "yes" }` ou `{ "answer": "no" }`
Le prompt de l'agent est dans `documentation/elevenlabs-agent-config.md`. Ne pas activer l'enregistrement audio.

## 4. Premier test, seul
Pour ne pas appeler Kash par erreur, mettre dans `backend/.env.local` : `DEMO_PHONE_OVERRIDE=<votre numéro>` (tous les appels vont alors à ce numéro), relancer le backend, puis :
1. `curl -X POST localhost:3000/api/demo/reset`
2. Écran **Remplacements** → **Simuler un no-show** : le téléphone sonne, l'agent propose le shift de Jade.
3. Répondre « oui » : « Mathieu/Kash couvre son shift ». Répondre « non » ou ne pas décrocher : passage au suivant.
Retirer ensuite `DEMO_PHONE_OVERRIDE` pour appeler Kash puis Mathieu.

## Comportements à connaître
- Le **décroché** est détecté en interrogeant ElevenLabs (statut `in-progress`) à chaque rafraîchissement de l'écran (toutes les 3 s). La ligne « X a décroché » apparaît alors dans le déroulé et le badge passe à « En conversation ».
- Si la conversation se termine sans réponse enregistrée, le serveur passe au suivant.
- Appel refusé, occupé ou injoignable : passage au suivant tout de suite (webhook ElevenLabs d'échec d'appel, optionnel : `ELEVENLABS_WEBHOOK_SECRET` + URL `https://<tunnel>/api/voice/status`).
- Le backend garde tout **en mémoire** : un redémarrage remet la démo à zéro.
- La clé ElevenLabs a été partagée dans une conversation : la renouveler après la démo.
