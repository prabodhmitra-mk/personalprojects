import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const DEFAULT_SUBJECT_KEYWORDS = ["nps", "statement"];
const MAX_ATTACHMENT_BYTES = 15 * 1024 * 1024;
const MAX_MESSAGES = 50;

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
    await client.connect();
    await client.mailboxOpen(normalized.mailbox);

    const sinceDate = new Date(Date.now() - normalized.sinceDays * 24 * 60 * 60 * 1000);
    const uids = await client.search({ since: sinceDate });
    const latestUids = [...uids].sort((left, right) => right - left).slice(0, normalized.maxMessages);

    for (const uid of latestUids) {
      const message = await client.fetchOne(uid, {
        envelope: true,
        source: true
      });
      const subject = message.envelope?.subject || "";

      if (!subjectMatches(subject, normalized.subjectKeywords)) {
        continue;
      }

      const parsed = await simpleParser(message.source);
      const relevantAttachments = parsed.attachments.filter((attachment) => attachment.content?.length > 0);

      if (relevantAttachments.length === 0) {
        continue;
      }

      const messageInfo = {
        uid,
        subject,
        date: parsed.date?.toISOString() || message.envelope?.date?.toISOString() || null,
        from: parsed.from?.text || "",
        attachmentCount: relevantAttachments.length
      };
      messages.push(messageInfo);

      for (const attachment of relevantAttachments) {
        const extracted = await extractAttachmentText(attachment, normalized.attachmentPassword);
        attachments.push({
          messageUid: uid,
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
    maxMessages: clampInteger(settings.maxMessages, 1, MAX_MESSAGES, 25)
  };
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
  const pdf = await loadingTask.promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str || "").join(" "));
  }

  await pdf.destroy();
  return pages.join("\n");
}

function formatAttachmentError(error) {
  if (/password/i.test(error.message || "") || error.name === "PasswordException") {
    return "Could not open PDF attachment. Check the NPS statement password.";
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
