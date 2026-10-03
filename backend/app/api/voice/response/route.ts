import { handleCandidateResponse } from "@/lib/cascade/handleCandidateResponse";
import { parseOfferAcceptance } from "@/lib/voice/parseOfferAcceptance";

export async function POST(request: Request) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get("attemptId");

  if (!attemptId) {
    return new Response("Missing attemptId", { status: 400 });
  }

  const formData = await request.formData();
  const digits = formData.get("Digits")?.toString() ?? null;
  const speech = formData.get("SpeechResult")?.toString() ?? null;
  const accepted = parseOfferAcceptance({ digits, speech });

  await handleCandidateResponse({
    attemptId,
    accepted,
    rawResponse: speech ?? digits,
  });

  const message = accepted
    ? "Thanks. You are confirmed for the shift. Goodbye."
    : "No problem. I will ask the next available teammate. Goodbye.";

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="alice">${message}</Say><Hangup /></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}
