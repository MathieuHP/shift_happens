# ElevenLabs replacement offer agent

## Project values

- Agent ID: `agent_01jykm2ma8e8cbbjg71ah8fafc`
- Twilio number connected to ElevenLabs: `+12187876943` (voice enabled in the supplied screenshots)
- Public backend: `https://hackaton-stripe-031026.vercel.app`
- The app resolves ElevenLabs' internal `agent_phone_number_id` from the assigned agent and phone number through `GET /v1/convai/phone-numbers`; set `ELEVENLABS_AGENT_PHONE_NUMBER_ID` only if that lookup cannot be used.

## Agent system prompt

```text
Tu es l'assistant automatique de {{restaurant_name}}. Annonce-le dès la première phrase : « Bonjour {{employee_first_name}}, ici l'assistant automatique de {{restaurant_name}}. » Tu proposes un remplacement : un shift de {{role}} le {{shift_date}}, de {{shift_start}} à {{shift_end}}, payé {{hourly_rate}} € de l'heure, soit {{total_amount}} € au total. Demande : « Est-ce que vous pouvez le prendre ? Il faut répondre avant {{response_deadline}}. » Écoute la réponse, puis appelle l'outil respond_to_offer avec yes ou no. Si la réponse est ambiguë, pose UNE question de clarification ; si c'est encore ambigu, considère que c'est « non ». Ne promets rien : si {{manager_approval_required}} vaut true, dis que le gérant doit valider. Ne demande jamais de raison médicale ni de donnée personnelle. Si la personne veut parler à un humain, dis que le gérant la rappellera. Sois bref (moins de 30 secondes), poli, et raccroche après la réponse.

Après l'outil : pour accepted, confirme que le shift est attribué ; pour pending_approval, précise que le gérant doit valider ; pour declined, remercie la personne ; pour ignored, excuse-toi et dis que l'offre n'est plus disponible. Ne révèle aucun identifiant technique.
```

Configure the first message to use the same automatic-assistant disclosure. Enable the agent to use the dynamic variables listed below. Do not enable call recording, audio retention, or post-call transcription webhooks.

## Only agent tool: `respond_to_offer`

- Method: `POST`
- URL: `https://hackaton-stripe-031026.vercel.app/api/voice/respond`
- Headers:
  - `x-voice-secret`: the secret stored in the ElevenLabs secret manager that matches server-side `VOICE_TOOL_SECRET`.
  - `x-conversation-id`: `{{system__conversation_id}}` (ElevenLabs system dynamic variable).
- JSON body schema: `{"answer":"yes"}` or `{"answer":"no"}`. Expose no other tool parameters.

The tool returns one of `accepted`, `pending_approval`, `declined`, or `ignored`. The backend derives the offer from the persisted conversation ID and ignores duplicate/closed responses.

## Server configuration

Set these only in Vercel server environment variables or `backend/.env.local`, never in frontend code or Git:

- `VOICE_ENABLED=true` to enable actual calling; the code default is `false`.
- `ELEVENLABS_API_KEY`, with permission to list the configured phone number and initiate Twilio outbound calls.
- `ELEVENLABS_AGENT_ID=agent_01jykm2ma8e8cbbjg71ah8fafc`
- `ELEVENLABS_PHONE_NUMBER=+12187876943`
- `VOICE_TOOL_SECRET` (shared with the tool header above).
- `ELEVENLABS_WEBHOOK_SECRET` (workspace webhook HMAC secret).
- `PUBLIC_BASE_URL=https://hackaton-stripe-031026.vercel.app`
- `DEMO_PHONE_OVERRIDE` set to an allowed, reachable test number before the first live test.

Configure the ElevenLabs workspace call-initiation-failure webhook to `https://hackaton-stripe-031026.vercel.app/api/voice/status` and validate it with `ELEVENLABS_WEBHOOK_SECRET`. Do not configure the post-call transcription event. A scheduler must call `POST /api/voice/advance` every 15–30 seconds with the `x-voice-secret` header.
