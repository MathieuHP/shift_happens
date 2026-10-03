// Branchement de l'outil de l'agent (`respond_to_offer`) et des événements du fournisseur sur l'état en mémoire.
// Les fonctions de ton collègue (`handleVoiceRespond`, `handleElevenLabsCallEvent`) restent inchangées :
// on leur fournit seulement ces dépendances à la place de Supabase.
import { endCallNoAnswer, failCall, respondToOffer } from "@/lib/inapp/service";
import type { AppState } from "@/lib/inapp/types";
import type { ProviderEventDependencies } from "@/lib/voice/providerEvents";
import type { VoiceOfferAnswer, VoiceRespondDependencies } from "@/lib/voice/respondToOffer";

function findByConversationId(state: AppState, conversationId: string) {
  const call = state.calls.find((c) => c.conversation_id === conversationId);
  return call ? { id: call.id, absenceCaseId: call.report_id } : null;
}

export function voiceRespondDependencies(state: AppState, now: Date): VoiceRespondDependencies {
  return {
    async findAttemptByConversationId(conversationId) {
      return findByConversationId(state, conversationId);
    },
    async respondToOffer(callId: string, answer: VoiceOfferAnswer) {
      const call = state.calls.find((c) => c.id === callId);
      if (!call) return "ignored";
      // Le serveur retrouve l'offre et le candidat à partir de l'appel : jamais à partir de ce que dit le modèle.
      const result = respondToOffer(state, { offerId: call.offer_id, employeeId: call.employee_id, accept: answer === "yes" }, now);
      return result.outcome;
    },
    // Le serveur passe tout seul au candidat suivant (voir lib/inapp/service.ts) : rien à faire ici.
    async advanceCascade() {},
  };
}

export function providerEventDependencies(state: AppState, now: Date): ProviderEventDependencies {
  return {
    async findAttemptByConversationId(conversationId) {
      return findByConversationId(state, conversationId);
    },
    async finishAttempt(callId, status) {
      return status === "no_answer" ? endCallNoAnswer(state, callId, now) : failCall(state, callId, "échec signalé par le fournisseur", now);
    },
    async advanceCascade() {},
  };
}
