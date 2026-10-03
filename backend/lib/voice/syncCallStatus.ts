// Demande au fournisseur où en sont les appels en cours :
// - la personne a décroché -> le délai de 30 s est suspendu (voir `advanceExpiredCalls`)
// - la conversation est terminée ou a échoué sans réponse enregistrée -> on passe au suivant
import { endCallNoAnswer, failCall, markCallAnswered } from "@/lib/inapp/service";
import type { AppState } from "@/lib/inapp/types";
import type { VoiceProvider } from "@/lib/voice/provider";

const MIN_SECONDS_BETWEEN_CHECKS = 1.5;

export async function syncCallStatuses(state: AppState, provider: VoiceProvider, now: Date) {
  if (!provider.getCallStatus) return;

  for (const call of state.calls) {
    if (call.status !== "calling" || !call.conversation_id || call.provider !== "elevenlabs") continue;
    if (call.checked_at && now.getTime() - new Date(call.checked_at).getTime() < MIN_SECONDS_BETWEEN_CHECKS * 1000) continue;
    call.checked_at = now.toISOString();

    let status;
    try {
      status = await provider.getCallStatus(call.conversation_id);
    } catch (error) {
      console.error("Could not read the call status", error); // on garde le délai habituel
      continue;
    }

    if (status === "in_progress") markCallAnswered(state, call.id, now);
    else if (status === "failed") failCall(state, call.id, "échec signalé par le fournisseur", now);
    else if (status === "ended") endCallNoAnswer(state, call.id, now, "la conversation s'est terminée sans réponse");
  }
}
