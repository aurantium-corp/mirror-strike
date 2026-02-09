import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config();

const BOT_TOKEN = process.env.HEX_TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.HEX_TELEGRAM_CHAT_ID;

export async function sendHexNotification(message: string): Promise<void> {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.log('[Hex-Telegram] Bot token or Chat ID missing, skipping notification.');
    return;
  }

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
      parse_mode: 'Markdown'
    });
  } catch (error) {
    console.error('[Hex-Telegram] Failed to send notification:', (error as Error).message);
  }
}
