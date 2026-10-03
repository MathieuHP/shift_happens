import { afterEach, describe, expect, it, vi } from "vitest";

import { handle } from "@/lib/inapp/http";
import { DomainError } from "@/lib/inapp/types";
import { checkDemoSecret } from "@/lib/security";

afterEach(() => {
  vi.unstubAllEnvs();
});

const request = (secret?: string) =>
  new Request("http://localhost/api/demo/state", { headers: secret ? { "x-demo-secret": secret } : {} });

describe("checkDemoSecret", () => {
  it("lets everything through when DEMO_SECRET is not set (local dev)", () => {
    vi.stubEnv("DEMO_SECRET", "");
    expect(checkDemoSecret(request())).toBeNull();
  });

  it("blocks requests without the right secret when DEMO_SECRET is set", async () => {
    vi.stubEnv("DEMO_SECRET", "s3cret");

    expect((checkDemoSecret(request()) as Response).status).toBe(403);
    expect((checkDemoSecret(request("wrong")) as Response).status).toBe(403);
    expect(checkDemoSecret(request("s3cret"))).toBeNull();
  });
});

describe("handle", () => {
  it("turns a DomainError into a JSON error with its status", async () => {
    const response = await handle(() => {
      throw new DomainError("not_your_shift", "Ce shift n'est pas le vôtre.", 403);
    });

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: { code: "not_your_shift", message: "Ce shift n'est pas le vôtre." } });
  });

  it("returns 200 with the JSON result otherwise", async () => {
    const response = await handle(() => ({ ok: true }));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
