/**
 * Configuration management
 */
import dotenv from 'dotenv';
import { Config } from './types';

dotenv.config();

export function getConfig(): Config {
  const config: Config = {
    googleCredentialsFile: process.env.GOOGLE_CREDENTIALS_FILE || 'credentials/credentials.json',
    googleSheetId: process.env.GOOGLE_SHEET_ID || '',
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    gmailQuery: process.env.GMAIL_QUERY,
    lookbackDays: parseInt(process.env.LOOKBACK_DAYS || '30', 10),
    debug: process.env.DEBUG === 'true'
  };

  // Validate required config
  if (!config.googleSheetId) {
    throw new Error('GOOGLE_SHEET_ID is required in .env file');
  }

  return config;
}

export const config = getConfig();
