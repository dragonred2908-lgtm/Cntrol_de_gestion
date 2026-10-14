import dotenv from 'dotenv';

dotenv.config();

export const config = {
  env: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  appUrl: process.env.APP_URL || '',
  adminPin: process.env.ADMIN_PIN || '123456',
  telegramBotToken: process.env.TELEGRAM_BOT_TOKEN || '',
  telegramGroupChatId: process.env.TELEGRAM_GROUP_CHAT_ID || '',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
};

export function assertRequiredEnv() {
  const missing: string[] = [];
  if (!config.geminiApiKey || config.geminiApiKey === 'MY_GEMINI_API_KEY') {
    missing.push('GEMINI_API_KEY');
  }
  if (!config.telegramBotToken) {
    missing.push('TELEGRAM_BOT_TOKEN');
  }
  if (!config.telegramGroupChatId) {
    missing.push('TELEGRAM_GROUP_CHAT_ID');
  }
  return missing;
}

export function getRuntimeStatus() {
  return {
    port: config.port,
    env: config.env,
    hasGeminiKey: Boolean(config.geminiApiKey && config.geminiApiKey !== 'MY_GEMINI_API_KEY'),
    hasTelegramToken: Boolean(config.telegramBotToken),
    hasTelegramGroup: Boolean(config.telegramGroupChatId),
    hasAdminPin: Boolean(config.adminPin),
  };
}
