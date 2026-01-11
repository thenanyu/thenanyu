/**
 * Google Sheets API client for managing order tracking spreadsheet
 */
import { google, sheets_v4 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import * as fs from 'fs';
import { Order, OrderState } from './types';

const TOKEN_PATH = 'token.json';

export class SheetsClient {
  private sheets: sheets_v4.Sheets | null = null;
  private auth: OAuth2Client | null = null;

  constructor(
    private credentialsPath: string,
    private spreadsheetId: string
  ) {}

  /**
   * Authenticate with Google Sheets API (reuses Gmail token)
   */
  async authenticate(): Promise<void> {
    const credentials = JSON.parse(fs.readFileSync(this.credentialsPath, 'utf8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed || credentials.web;

    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);

    if (fs.existsSync(TOKEN_PATH)) {
      const token = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf8'));
      oAuth2Client.setCredentials(token);
    }

    this.auth = oAuth2Client;
    this.sheets = google.sheets({ version: 'v4', auth: oAuth2Client });
  }

  /**
   * Initialize the spreadsheet with headers
   */
  async initializeSheet(): Promise<void> {
    if (!this.sheets) {
      throw new Error('Sheets client not authenticated');
    }

    try {
      // Check if sheet already has headers
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:I1',
      });

      if (response.data.values && response.data.values.length > 0) {
        console.log('Sheet already initialized');
        return;
      }

      // Create headers
      const headers = [
        'Order ID',
        'Merchant',
        'Order Date',
        'Current State',
        'Total Amount',
        'Tracking Number',
        'Items',
        'Last Updated',
        'Email IDs'
      ];

      await this.sheets.spreadsheets.values.update({
        spreadsheetId: this.spreadsheetId,
        range: 'A1:I1',
        valueInputOption: 'RAW',
        requestBody: {
          values: [headers],
        },
      });

      // Format header row
      await this.sheets.spreadsheets.batchUpdate({
        spreadsheetId: this.spreadsheetId,
        requestBody: {
          requests: [
            {
              repeatCell: {
                range: {
                  sheetId: 0,
                  startRowIndex: 0,
                  endRowIndex: 1,
                },
                cell: {
                  userEnteredFormat: {
                    backgroundColor: { red: 0.2, green: 0.2, blue: 0.2 },
                    textFormat: {
                      foregroundColor: { red: 1, green: 1, blue: 1 },
                      bold: true,
                    },
                  },
                },
                fields: 'userEnteredFormat(backgroundColor,textFormat)',
              },
            },
          ],
        },
      });

      console.log('Sheet initialized with headers');
    } catch (error) {
      console.error('Error initializing sheet:', error);
      throw error;
    }
  }

  /**
   * Get all orders from the sheet
   */
  async getAllOrders(): Promise<Order[]> {
    if (!this.sheets) {
      throw new Error('Sheets client not authenticated');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:I',
      });

      const rows = response.data.values || [];
      return rows.map(row => this.rowToOrder(row));
    } catch (error) {
      console.error('Error getting orders:', error);
      return [];
    }
  }

  /**
   * Find order by order ID
   */
  async findOrder(orderId: string): Promise<{ order: Order; row: number } | null> {
    if (!this.sheets) {
      throw new Error('Sheets client not authenticated');
    }

    try {
      const response = await this.sheets.spreadsheets.values.get({
        spreadsheetId: this.spreadsheetId,
        range: 'A2:I',
      });

      const rows = response.data.values || [];

      for (let i = 0; i < rows.length; i++) {
        if (rows[i][0] === orderId) {
          return {
            order: this.rowToOrder(rows[i]),
            row: i + 2, // +2 because we start at row 2 (after header)
          };
        }
      }

      return null;
    } catch (error) {
      console.error('Error finding order:', error);
      return null;
    }
  }

  /**
   * Add or update an order
   */
  async upsertOrder(order: Order): Promise<void> {
    if (!this.sheets) {
      throw new Error('Sheets client not authenticated');
    }

    try {
      const existing = await this.findOrder(order.orderId);

      if (existing) {
        // Update existing order
        await this.updateOrder(existing.row, order);
      } else {
        // Add new order
        await this.addOrder(order);
      }
    } catch (error) {
      console.error('Error upserting order:', error);
      throw error;
    }
  }

  /**
   * Add a new order to the sheet
   */
  private async addOrder(order: Order): Promise<void> {
    if (!this.sheets) return;

    const row = this.orderToRow(order);

    await this.sheets.spreadsheets.values.append({
      spreadsheetId: this.spreadsheetId,
      range: 'A2:I',
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log(`Added new order: ${order.orderId}`);
  }

  /**
   * Update an existing order
   */
  private async updateOrder(rowNumber: number, order: Order): Promise<void> {
    if (!this.sheets) return;

    const row = this.orderToRow(order);
    const range = `A${rowNumber}:I${rowNumber}`;

    await this.sheets.spreadsheets.values.update({
      spreadsheetId: this.spreadsheetId,
      range,
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [row],
      },
    });

    console.log(`Updated order: ${order.orderId} to state: ${order.state}`);
  }

  /**
   * Convert a sheet row to an Order object
   */
  private rowToOrder(row: any[]): Order {
    return {
      orderId: row[0] || '',
      merchant: row[1] || '',
      orderDate: row[2] ? new Date(row[2]) : new Date(),
      state: (row[3] as OrderState) || OrderState.UNKNOWN,
      totalAmount: row[4] || undefined,
      trackingNumber: row[5] || undefined,
      items: row[6] ? row[6].split(', ') : undefined,
      lastUpdated: row[7] ? new Date(row[7]) : new Date(),
      emailIds: row[8] ? row[8].split(', ') : [],
    };
  }

  /**
   * Convert an Order object to a sheet row
   */
  private orderToRow(order: Order): any[] {
    return [
      order.orderId,
      order.merchant,
      order.orderDate.toISOString().split('T')[0],
      order.state,
      order.totalAmount || '',
      order.trackingNumber || '',
      order.items?.join(', ') || '',
      order.lastUpdated.toISOString(),
      order.emailIds.join(', '),
    ];
  }
}
