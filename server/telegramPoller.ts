import { state, telegramController } from './init.js';

let pollerRunning = false;
let lastUpdateId = 0;

export async function startTelegramPoller() {
  if (pollerRunning) return;
  pollerRunning = true;

  console.log('🤖 Iniciando Poller en Vivo de Telegram Bot API...');

  const pollLoop = async () => {
    while (pollerRunning) {
      const token = state.db.telegramConfig.botToken || process.env.TELEGRAM_BOT_TOKEN;
      if (!token) {
        await new Promise((r) => setTimeout(r, 5000));
        continue;
      }

      try {
        const url = `https://api.telegram.org/bot${token}/getUpdates?offset=${lastUpdateId + 1}&timeout=15`;
        const resp = await fetch(url);
        if (!resp.ok) {
          await new Promise((r) => setTimeout(r, 6000));
          continue;
        }

        const data = (await resp.json()) as any;
        if (data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            lastUpdateId = Math.max(lastUpdateId, update.update_id);
            try {
              await telegramController.handleUpdate(update);
            } catch (err) {
              console.error('Error handling polled update:', err);
            }
          }
        }
      } catch (err) {
        await new Promise((r) => setTimeout(r, 4000));
      }
    }
  };

  pollLoop();
}

export function stopTelegramPoller() {
  pollerRunning = false;
}
