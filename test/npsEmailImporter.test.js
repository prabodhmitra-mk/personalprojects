import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSettings } from "../src/npsEmailImporter.js";

test("normalizes NPS email import settings", () => {
  const settings = normalizeSettings({
    host: " imap.gmail.com ",
    username: "user@example.com",
    password: "app-password",
    subjectKeywords: "nps, statement",
    sinceDays: "30",
    maxMessages: "5",
    scanLimit: "75"
  });

  assert.equal(settings.host, "imap.gmail.com");
  assert.equal(settings.port, 993);
  assert.equal(settings.secure, true);
  assert.equal(settings.mailbox, "INBOX");
  assert.deepEqual(settings.subjectKeywords, ["nps", "statement"]);
  assert.equal(settings.sinceDays, 30);
  assert.equal(settings.maxMessages, 5);
  assert.equal(settings.scanLimit, 75);
});

test("requires mailbox credentials for NPS email import", () => {
  assert.throws(
    () => normalizeSettings({ host: "imap.gmail.com", username: "", password: "" }),
    /Email username is required/
  );
});
