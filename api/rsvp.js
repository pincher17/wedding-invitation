export default async function handler(request) {
  if (request.method !== "POST") {
    return json({ ok: false, error: "Method not allowed" }, 405);
  }

  let payload;

  try {
    payload = await request.json();
  } catch {
    return json(
      {
        ok: false,
        error: "Invalid JSON body"
      },
      400
    );
  }

  const validationError = validatePayload(payload);
  if (validationError) {
    return json({ ok: false, error: validationError }, 400);
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;

  if (!botToken || !chatId) {
    return json({
      ok: true,
      mode: "local",
      message: "Анкета сохранена локально. Для Telegram добавьте TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID."
    });
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: formatTelegramMessage(payload)
      })
    });

    if (!response.ok) {
      const telegramError = await response.text();
      throw new Error(`Telegram API error: ${response.status} ${telegramError}`);
    }

    return json({ ok: true, mode: "telegram" });
  } catch (error) {
    console.error(error);
    return json({ ok: false, error: "Не удалось отправить данные в Telegram." }, 502);
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
