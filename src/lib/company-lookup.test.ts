import test from "node:test";
import assert from "node:assert/strict";

import { CompanyLookupError, lookupCompanyBySiret } from "./company-lookup";

test("returns null when the public API has no matching SIRET result", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ results: [], total_results: 0 }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  try {
    const result = await lookupCompanyBySiret("13002526500013");
    assert.equal(result, null);
  } finally {
    global.fetch = originalFetch;
  }
});

test("raises a retryable, classified error when the API rate-limits the lookup", async () => {
  const originalFetch = global.fetch;
  global.fetch = async () =>
    new Response(JSON.stringify({ error: "rate limited" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });

  try {
    await assert.rejects(
      () => lookupCompanyBySiret("13002526500013"),
      (error: unknown) => {
        assert.ok(error instanceof CompanyLookupError);
        assert.equal(error.code, "rate_limited");
        assert.equal(error.retryable, true);
        return true;
      },
    );
  } finally {
    global.fetch = originalFetch;
  }
});
