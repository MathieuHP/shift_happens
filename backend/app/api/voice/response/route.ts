import { handleCandidateResponse } from "@/lib/cascade/handleCandidateResponse";

function isAccepted(input: { digits: string | null; speech: string | null }) {
  const speech = input.speech?.toLowerCase() ?? "";

  if (input.digits === "1") {
    return true;
  }

  if (input.digits === "2") {
    return false;
  }

  return /\b(yes|yeah|yep|sure|accept|okay|ok|i can)\b/.test(speech);
}

export async function POST(request: Request) {
  const url = new URL(request.url);
  const attemptId = url.searchParams.get("attemptId");

  if (!attemptId) {
    return new Response("Missing attemptId", { status: 400 });
  }

  const formData = await request.formData();
  const digits = formData.get("Digits")?.toString() ?? null;
  const speech = formData.get("SpeechResult")?.toString() ?? null;
  const accepted = isAccepted({ digits, speech });

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
