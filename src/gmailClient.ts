/**
 * Gmail API client for fetching and monitoring emails
 */
import { google, gmail_v1 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import * as path from 'path';
import { EmailMessage } from './types';

const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];
const TOKEN_PATH = 'token.json';

export class GmailClient {
  private gmail: gmail_v1.Gmail | null = null;
  private auth: OAuth2Client | null = null;

  constructor(private credentialsPath: string) {}

  /**
   * Authenticate with Gmail API
   */
  async authenticate(): Promise<void> {
    const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    // Check if we have a token stored
    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
    } else {
      await this.getNewToken(oAuth2Client);
    }

    this.auth = oAuth2Client;
    this.gmail = google.gmail({ version: 'v1', auth: oAuth2Client });
  }

  /**
   * Get new OAuth2 token
   */
  private async getNewToken(oAuth2Client: OAuth2Client): Promise<void> {
    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: SCOPES,
    });

    console.log('Authorize this app by visiting this url:', authUrl);
    console.log('\nAfter authorization, you will be redirected to a URL.');
    console.log('Copy the code from the URL and paste it here:');

    // In a real implementation, you'd use readline or a web server to get the code
    // For now, this will need manual intervention
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    return new Promise((resolve, reject) => {
      rl.question('Enter the code from that page here: ', async (code: string) => {
        rl.close();
        try {
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          console.log('Token stored to', TOKEN_PATH);
          resolve();
        } catch (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * Fetch messages from Gmail
   */
  async getMessages(query: string = '', maxResults: number = 100, daysBack?: number): Promise<string[]> {
    if (!this.gmail) {
      throw new Error('Gmail client not authenticated');
    }

    let searchQuery = query;

    // Add date filter if specified
    if (daysBack) {
      const date = new Date();
      date.setDate(date.getDate() - daysBack);
      const dateStr = date.toISOString().split('T')[0].replace(/-/g, '/');
      searchQuery = searchQuery ? `${searchQuery} after:${dateStr}` : `after:${dateStr}`;
    }

    try {
      const response = await this.gmail.users.messages.list({
        userId: 'me',
        q: searchQuery,
        maxResults,
      });

      return response.data.messages?.map(m => m.id!) || [];
    } catch (error) {
      console.error('Error fetching messages:', error);
      return [];
    }
  }

  /**
   * Get detailed information about a specific message
   */
  async getMessageDetail(messageId: string): Promise<EmailMessage | null> {
    if (!this.gmail) {
      throw new Error('Gmail client not authenticated');
    }

    try {
      const response = await this.gmail.users.messages.get({
        userId: 'me',
        id: messageId,
        format: 'full',
      });

      const message = response.data;
      const headers = message.payload?.headers || [];

      // Extract headers
      const getHeader = (name: string): string => {
        const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
        return header?.value || '';
      };

      const from = getHeader('from');
      const to = getHeader('to');
      const subject = getHeader('subject');
      const dateStr = getHeader('date');
      const date = dateStr ? new Date(dateStr) : new Date(parseInt(message.internalDate || '0'));

      // Extract body
      const body = this.extractBody(message.payload);

      return {
        id: messageId,
        threadId: message.threadId || '',
        from,
        to,
        subject,
        date,
        body,
        snippet: message.snippet || '',
      };
    } catch (error) {
      console.error(`Error fetching message ${messageId}:`, error);
      return null;
    }
  }

  /**
   * Extract email body from message payload
   */
  private extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
    if (!payload) return '';

    let body = '';

    if (payload.parts) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/plain' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
          break;
        } else if (part.mimeType === 'text/html' && part.body?.data) {
          body = Buffer.from(part.body.data, 'base64').toString('utf-8');
        } else if (part.parts) {
          const nestedBody = this.extractBody(part);
          if (nestedBody) body = nestedBody;
        }
      }
    } else if (payload.body?.data) {
      body = Buffer.from(payload.body.data, 'base64').toString('utf-8');
    }

    return body;
  }

  /**
   * Get messages in batches for efficiency
   */
  async *getMessagesBatch(messageIds: string[], batchSize: number = 10): AsyncGenerator<EmailMessage[]> {
    for (let i = 0; i < messageIds.length; i += batchSize) {
      const batch = messageIds.slice(i, i + batchSize);
      const messages = await Promise.all(
        batch.map(id => this.getMessageDetail(id))
      );
      yield messages.filter((m): m is EmailMessage => m !== null);
    }
  }
}
