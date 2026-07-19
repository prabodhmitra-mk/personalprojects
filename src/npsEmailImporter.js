import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const DEFAULT_SUBJECT_KEYWORDS = ["nps", "statement"];
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_MESSAGES = 50;
const DEFAULT_SCAN_LIMIT = 150;

export async function importNpsStatementsFromEmail(settings) {
  const normalized = normalizeSettings(settings);
  const client = new ImapFlow({
    host: normalized.host,
    port: normalized.port,
    secure: normalized.secure,
    auth: {
      user: normalized.username,
      pass: normalized.password
    },
    logger: false
  });

  const messages = [];
  const attachments = [];
  const textParts = [];

  try {
    await runImapStep("connect to IMAP server", () => client.connect());
    const mailbox = await runImapStep(`open mailbox "${normalized.mailbox}"`, () => client.mailboxOpen(normalized.mailbox));

    const sinceDate = new Date(Date.now() - normalized.sinceDays * 24 * 60 * 60 * 1000);
    const candidates = await fetchCandidateMessages(client, mailbox, normalized);
    let matchedMessages = 0;

    for (const message of candidates) {
      const subject = message.envelope?.subject || "";
      const messageDate = message.envelope?.date || null;

      if (messageDate && messageDate < sinceDate) {
        continue;
      }

      if (!subjectMatches(subject, normalized.subjectKeywords)) {
        continue;
      }

      matchedMessages += 1;

      const parsed = await simpleParser(message.source);
      const relevantAttachments = parsed.attachments.filter((attachment) => attachment.content?.length > 0);

      if (relevantAttachments.length === 0) {
        continue;
      }

      const messageInfo = {
        uid: message.uid,
        subject,
        date: parsed.date?.toISOString() || messageDate?.toISOString() || null,
        from: parsed.from?.text || "",
        attachmentCount: relevantAttachments.length
      };
      messages.push(messageInfo);

      for (const attachment of relevantAttachments) {
        const extracted = await extractAttachmentText(attachment, normalized.attachmentPassword);
        attachments.push({
          messageUid: message.uid,
          messageSubject: subject,
          filename: attachment.filename || "attachment",
          contentType: attachment.contentType || "",
          size: attachment.content.length,
          status: extracted.status,
          error: extracted.error || null,
          textLength: extracted.text.length
        });

        if (extracted.text) {
          textParts.push(`Email Subject: ${subject}
Attachment: ${attachment.filename || "attachment"}
${extracted.text}`);
        }
      }

      if (matchedMessages >= normalized.maxMessages) {
        break;
      }
    }
  } finally {
    try {
      await client.logout();
    } catch {
      // The connection may already be closed after authentication/network errors.
    }
  }

  return {
    ok: true,
    messageCount: messages.length,
    attachmentCount: attachments.length,
    textLength: textParts.join("\n\n").length,
    scannedMessageLimit: normalized.scanLimit,
    messages,
    attachments,
    statementText: textParts.join("\n\n")
  };
}

export function normalizeSettings(settings) {
  const host = String(settings.host || "").trim();
  const username = String(settings.username || "").trim();
  const password = String(settings.password || "");

  if (!host) {
    throw new Error("IMAP host is required.");
  }

  if (!username) {
    throw new Error("Email username is required.");
  }

  if (!password) {
    throw new Error("Email password or app password is required.");
  }

  return {
    host,
    username,
    password,
    port: Number(settings.port || 993),
    secure: settings.secure !== false,
    mailbox: String(settings.mailbox || "INBOX").trim() || "INBOX",
    subjectKeywords: normalizeSubjectKeywords(settings.subjectKeywords),
    attachmentPassword: String(settings.attachmentPassword || ""),
    sinceDays: clampInteger(settings.sinceDays, 1, 3650, 365),
    maxMessages: clampInteger(settings.maxMessages, 1, MAX_MESSAGES, 25),
    scanLimit: clampInteger(settings.scanLimit, 10, 1000, DEFAULT_SCAN_LIMIT)
  };
}

async function fetchCandidateMessages(client, mailbox, normalized) {
  const exists = mailbox.exists || client.mailbox?.exists || 0;

  if (!exists) {
    return [];
  }

  const start = Math.max(1, exists - normalized.scanLimit + 1);
  const range = `${start}:*`;
  const messages = [];

  await runImapStep(`fetch latest ${exists - start + 1} message(s)`, async () => {
    for await (const message of client.fetch(range, {
      uid: true,
      envelope: true,
      source: true
    })) {
      messages.push(message);
    }
  });

  return messages.sort((left, right) => {
    const leftDate = left.envelope?.date?.getTime() || 0;
    const rightDate = right.envelope?.date?.getTime() || 0;

    if (leftDate !== rightDate) {
      return rightDate - leftDate;
    }

    return (right.uid || 0) - (left.uid || 0);
  });
}

async function runImapStep(step, operation) {
  try {
    return await operation();
  } catch (error) {
    throw new Error(`IMAP ${step} failed: ${formatImapError(error)}`);
  }
}

function formatImapError(error) {
  const details = [
    error.responseText,
    error.serverResponse,
    error.response,
    error.code,
    error.command,
    error.message
  ]
    .filter(Boolean)
    .map((item) => String(item));

  return details.length > 0 ? [...new Set(details)].join(" | ") : "Unknown IMAP error";
}

function normalizeSubjectKeywords(value) {
  if (Array.isArray(value)) {
    const keywords = value.map((item) => String(item).trim().toLowerCase()).filter(Boolean);
    return keywords.length > 0 ? keywords : DEFAULT_SUBJECT_KEYWORDS;
  }

  const keywords = String(value || DEFAULT_SUBJECT_KEYWORDS.join(","))
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return keywords.length > 0 ? keywords : DEFAULT_SUBJECT_KEYWORDS;
}

function subjectMatches(subject, keywords) {
  const normalizedSubject = String(subject || "").toLowerCase();
  return keywords.every((keyword) => normalizedSubject.includes(keyword));
}

async function extractAttachmentText(attachment, password) {
  if (attachment.content.length > MAX_ATTACHMENT_BYTES) {
    return {
      status: "skipped",
      text: "",
      error: "Attachment is larger than the local import limit."
    };
  }

  const filename = attachment.filename || "";
  const contentType = attachment.contentType || "";

  try {
    if (/pdf/i.test(contentType) || /\.pdf$/i.test(filename)) {
      return {
        status: "parsed",
        text: await extractPdfText(attachment.content, password)
      };
    }

    if (/text|csv|html|xml/i.test(contentType) || /\.(txt|csv|html|htm|xml)$/i.test(filename)) {
      return {
        status: "parsed",
        text: attachment.content.toString("utf8")
      };
    }

    return {
      status: "skipped",
      text: "",
      error: "Unsupported attachment type. Supported: PDF, text, HTML, CSV."
    };
  } catch (error) {
    return {
      status: "error",
      text: "",
      error: formatAttachmentError(error)
    };
  }
}

async function extractPdfText(buffer, password) {
  const loadingTask = getDocument({
    data: new Uint8Array(buffer),
    password: password || undefined,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true
  });
  let pdf = null;

  try {
    pdf = await loadingTask.promise;
    const pages = [];

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(extractTextRows(content.items));
    }

    return pages.join("\n");
  } finally {
    if (pdf && typeof pdf.destroy === "function") {
      await pdf.destroy();
    } else if (typeof loadingTask.destroy === "function") {
      await loadingTask.destroy();
    }
  }
}

function extractTextRows(items) {
  const rows = new Map();

  for (const item of items) {
    const text = String(item.str || "").trim();
    if (!text) {
      continue;
    }

    const transform = item.transform || [];
    const x = Number(transform[4] || 0);
    const y = Math.round(Number(transform[5] || 0) * 2) / 2;
    const row = rows.get(y) || [];

    row.push({ x, text });
    rows.set(y, row);
  }

  return [...rows.entries()]
    .sort((left, right) => right[0] - left[0])
    .map(([, row]) => row
      .sort((left, right) => left.x - right.x)
      .map((item) => item.text)
      .join(" "))
    .join("\n");
}

function formatAttachmentError(error) {
  if (/password/i.test(error.message || "") || error.name === "PasswordException") {
    return "Could not open PDF attachment. Check the NPS statement password.";
  }

  if (/destroy is not a function/i.test(error.message || "")) {
    return "PDF text was read but cleanup failed because of a PDF library API mismatch. Update to the latest app code and retry.";
  }

  return error.message || "Could not parse attachment.";
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}
