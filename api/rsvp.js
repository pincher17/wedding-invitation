export default async function handler(req) {
  if (req.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let payload;

  try {
    payload = await req.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON body" }, 400);
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return json({ ok: false, error: validationError }, 400);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return json({ ok: false, error: "ENV переменные не найдены" }, 500);
  }

  // 🔥 ВАЖНО: таймаут
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);

  try {
    const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramMessage(payload)
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    const text = await tgRes.text();

    if (!tgRes.ok) {
      console.error("Telegram error:", text);
      return json({ ok: false, error: text }, 500);
    }

    return json({ ok: true, mode: "telegram" });

  } catch (error) {
    console.error("Fetch error:", error);

    return json({
      ok: false,
      error: "Telegram не отвечает (timeout или сеть)"
    }, 500);
  }
}

function validatePayload(payload) {
  if (!payload?.name?.trim()) return "Укажите имя и фамилию.";
  if (!payload?.attendance) return "Укажите, планируете ли присутствовать.";
  if (!payload?.secondDay) return "Укажите присутствие на втором дне.";
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

function json(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}