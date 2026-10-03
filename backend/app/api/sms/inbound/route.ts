import { handleAbsenceMessage } from "@/lib/cascade/handleAbsenceMessage";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fromPhone = String(formData.get("From") ?? "");
    const body = String(formData.get("Body") ?? "");

    if (!fromPhone || !body) {
      return new Response("Missing From or Body", { status: 400 });
    }

    await handleAbsenceMessage({ fromPhone, body });

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><Response><Message>ShiftSaver is handling your shift coverage now.</Message></Response>`,
      {
        headers: { "Content-Type": "text/xml" },
      },
    );
  } catch (error) {
    console.error("Inbound SMS failed", error);
    return new Response("ShiftSaver could not process this SMS", { status: 500 });
  }
}
