import { createReadStream, existsSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";

loadEnv();

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp"
};

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    sendJson(res, 400, { ok: false, error: "Bad request" });
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "POST" && url.pathname === "/api/rsvp") {
    await handleRsvp(req, res);
    return;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    sendJson(res, 405, { ok: false, error: "Method not allowed" });
    return;
  }

  await serveStatic(url.pathname, res, req.method === "HEAD");
});

server.listen(port, host, () => {
  console.log(`Wedding invitation is running on http://${host}:${port}`);
});

async function handleRsvp(req, res) {
  const body = await readJson(req);
  if (!body) {
    sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    return;
  }

  const validationError = validatePayload(body);
  if (validationError) {
    sendJson(res, 400, { ok: false, error: validationError });
    return;
  }

  const message = formatTelegramMessage(body);
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    console.warn("Telegram credentials are not configured. RSVP payload:", body);
    sendJson(res, 200, {
      ok: true,
      mode: "local",
      message: "Анкета сохранена локально. Для Telegram добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID."
    });
    return;
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message
      })
    });

    if (!response.ok) {
      const telegramError = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${telegramError}`);
    }

    sendJson(res, 200, { ok: true, mode: "telegram" });
  } catch (error) {
    console.error(error);
    sendJson(res, 502, { ok: false, error: "Не удалось отправить данные в Telegram." });
  }
}

async function serveStatic(requestPath, res, headOnly = false) {
  const safePath = requestPath === "/" ? "/index.html" : requestPath;
  const normalizedPath = path.normalize(safePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(publicDir, normalizedPath);

  if (!filePath.startsWith(publicDir) || !existsSync(filePath)) {
    sendPlain(res, 404, "Not found");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
  if (headOnly) {
    res.end();
    return;
  }
  createReadStream(filePath).pipe(res);
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  try {
    const raw = Buffer.concat(chunks).toString("utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function validatePayload(payload) {
  if (!payload.name?.trim()) return "Укажите имя и фамилию.";
  if (!payload.attendance) return "Укажите, планируете ли присутствовать.";
  if (!payload.secondDay) return "Укажите присутствие на втором дне.";
  return "";
}

function formatTelegramMessage(payload) {
  const drinks = Array.isArray(payload.drinks) && payload.drinks.length
    ? payload.drinks.join(", ")
    : "Не указано";

  return [
    "Новая анкета гостя",
    `Имя: ${payload.name}`,
    `Присутствие: ${payload.attendance}`,
    `Спутник: ${payload.plusOne || "Нет"}`,
    `Напитки: ${drinks}`,
    `Второй день: ${payload.secondDay}`,
    `Комментарий: ${payload.comment || "Нет"}`
  ].join("\n");
}

function sendJson(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function sendPlain(res, statusCode, message) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(message);
}

function loadEnv() {
  const envPath = path.join(__dirname, ".env");
  if (!existsSync(envPath)) {
    return;
  }

  const raw = readFileSyncUtf8(envPath);
  for (const line of raw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim();
    if (key && !process.env[key]) {
      process.env[key] = value;
    }
  }
}

function readFileSyncUtf8(filePath) {
  return readFileSync(filePath, "utf8");
}
