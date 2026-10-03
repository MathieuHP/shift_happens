export function parseOfferAcceptance(input: {
  digits: string | null;
  speech: string | null;
}) {
  const speech = input.speech?.toLowerCase() ?? "";

  if (input.digits === "1") {
    return true;
  }

  if (input.digits === "2") {
    return false;
  }

  return /\b(yes|yeah|yep|sure|accept|okay|ok|i can)\b/.test(speech);
}
