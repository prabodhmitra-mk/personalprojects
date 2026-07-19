import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

import { DEFAULT_OLLAMA_MODEL, extractWithOllama } from "./src/llmExtractor.js";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 5173);
const maxImportSizeBytes = 8 * 1024 * 1024;

let latestImport = null;

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

function resolveRequestPath(urlPath) {
  const safePath = normalize(decodeURIComponent(urlPath)).replace(/^(\.\.[/\\])+/, "");
  const absolutePath = join(root, safePath === "/" ? "index.html" : safePath);

  if (!absolutePath.startsWith(root)) {
    return null;
  }

  if (existsSync(absolutePath) && statSync(absolutePath).isFile()) {
    return absolutePath;
  }

  return join(root, "index.html");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "DELETE, GET, OPTIONS, POST",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(JSON.stringify(payload));
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (Buffer.byteLength(body) > maxImportSizeBytes) {
        reject(new Error("Imported EPFO page is too large."));
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch {
        reject(new Error("Request body must be valid JSON."));
      }
    });

    request.on("error", reject);
  });
}

async function handleApiRequest(request, response, url) {
  if (request.method === "OPTIONS") {
    sendJson(response, 204, {});
    return true;
  }

  if (url.pathname === "/api/latest-import" && request.method === "GET") {
    sendJson(response, 200, { import: latestImport });
    return true;
  }

  if (url.pathname === "/api/latest-import" && request.method === "DELETE") {
    latestImport = null;
    sendJson(response, 200, { ok: true });
    return true;
  }

  if (url.pathname === "/api/import" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const pageText = String(payload.pageText || "").trim();

      if (!pageText) {
        sendJson(response, 400, { error: "pageText is required." });
        return true;
      }

      latestImport = {
        id: randomUUID(),
        importedAt: new Date().toISOString(),
        pageText,
        sourceUrl: String(payload.sourceUrl || ""),
        title: String(payload.title || "")
      };

      sendJson(response, 200, {
        ok: true,
        id: latestImport.id,
        importedAt: latestImport.importedAt,
        length: pageText.length
      });
    } catch (error) {
      sendJson(response, 400, { error: error.message });
    }

    return true;
  }

  if (url.pathname === "/api/llm-extract" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const pageText = String(payload.pageText || "").trim();
      const model = String(payload.model || DEFAULT_OLLAMA_MODEL).trim();

      if (!pageText) {
        sendJson(response, 400, { error: "pageText is required." });
        return true;
      }

      if (!model) {
        sendJson(response, 400, { error: "model is required." });
        return true;
      }

      const result = await extractWithOllama({
        pageText,
        model
      });

      sendJson(response, 200, {
        ok: true,
        ...result
      });
    } catch (error) {
      sendJson(response, 502, {
        ok: false,
        error: error.name === "AbortError"
          ? "Local LLM timed out. Try a smaller model or shorter page content."
          : formatLlmError(error)
      });
    }

    return true;
  }

  if (url.pathname === "/api/nps-email-import" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const { importNpsStatementsFromEmail } = await loadNpsEmailImporter();
      const result = await importNpsStatementsFromEmail(payload);

      sendJson(response, 200, result);
    } catch (error) {
      sendJson(response, 400, {
        ok: false,
        error: formatEmailImportError(error)
      });
    }

    return true;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "Not found." });
    return true;
  }

  return false;
}

function formatLlmError(error) {
  if (/fetch failed|ECONNREFUSED|ECONNRESET/i.test(error.message || "")) {
    return "Local Ollama is not reachable at http://127.0.0.1:11434. Start Ollama and pull the selected model.";
  }

  return error.message;
}

function formatEmailImportError(error) {
  if (/authentication|invalid credentials|login/i.test(error.message || "")) {
    return "Could not log in to the mailbox. Check your email/app password and IMAP settings.";
  }

  if (/Command failed/i.test(error.message || "")) {
    return `${error.message}. Check that IMAP is enabled, mailbox is correct, and you are using an app password. If it still fails, reduce "Scan latest emails" and try again.`;
  }

  if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|network|certificate/i.test(error.message || "")) {
    return "Could not connect to the IMAP server. Check host, port, secure setting, and network access.";
  }

  return error.message;
}

async function loadNpsEmailImporter() {
  try {
    return await import("./src/npsEmailImporter.js");
  } catch (error) {
    if (error.code === "ERR_MODULE_NOT_FOUND" || /Cannot find package/i.test(error.message || "")) {
      throw new Error("NPS email import dependencies are not installed. Run `npm install` in this project folder, then restart with `npm start`.");
    }

    throw error;
  }
}

const server = createServer((request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host}`);

  handleApiRequest(request, response, url).then((handled) => {
    if (handled) {
      return;
    }

    serveStaticFile(url, response);
  });
});

function serveStaticFile(url, response) {
  const filePath = resolveRequestPath(url.pathname);

  if (!filePath) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  response.writeHead(200, {
    "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    "Cache-Control": "no-store"
  });

  createReadStream(filePath).pipe(response);
}

server.listen(port, () => {
  console.log(`EPFO balance dashboard running at http://localhost:${port}`);
});
