import test from "node:test";
import assert from "node:assert/strict";
import { createPairCode, isValidCode, makeSession } from "../src/session.js";

test("pairing code is six numeric digits", () => {
  const code = createPairCode();
  assert.match(code, /^\d{6}$/);
});
test("pairing code validation rejects malformed values", () => {
  assert.equal(isValidCode("123456"), true);
  assert.equal(isValidCode("12345"), false);
  assert.equal(isValidCode("12ab56"), false);
});
test("session expires five minutes after creation", () => {
  const session = makeSession("123456", 1000);
  assert.equal(session.expiresAt, 301000);
  assert.equal(session.tv, null);
  assert.equal(session.phone, null);
});
