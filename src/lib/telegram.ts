export interface TelegramSendPayload {
  token: string;
  chatId: string;
  text: string;
  disablePreview?: boolean;
  parseMode?: "HTML" | "MarkdownV2" | "Markdown";
}

interface TelegramApiResponse {
  ok: boolean;
  description?: string;
}

const buildTelegramUrl = (token: string, method: string) =>
  `https://api.telegram.org/bot${token}/${method}`;

export const canSendTelegram = (token: string, chatId: string) =>
  token.trim().length > 0 && chatId.trim().length > 0;

export const sendTelegramMessage = async ({
  token,
  chatId,
  text,
  disablePreview = false,
  parseMode
}: TelegramSendPayload) => {
  const response = await fetch(buildTelegramUrl(token, 'sendMessage'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      ...(parseMode ? { parse_mode: parseMode } : {}),
      disable_web_page_preview: disablePreview
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Telegram API error: ${errorText}`);
  }

  const payload = (await response.json()) as TelegramApiResponse;
  if (!payload.ok) {
    throw new Error(payload.description ?? 'Telegram API returned an error');
  }

  return payload;
};
