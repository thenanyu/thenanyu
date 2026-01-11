/**
 * Type definitions for the Gmail Order Tracker
 */

export enum OrderState {
  PLACED = 'placed',
  CONFIRMED = 'confirmed',
  SHIPPED = 'shipped',
  IN_TRANSIT = 'in_transit',
  OUT_FOR_DELIVERY = 'out_for_delivery',
  DELIVERED = 'delivered',
  RETURN_PENDING = 'return_pending',
  RETURN_APPROVED = 'return_approved',
  RETURN_SHIPPED = 'return_shipped',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
  UNKNOWN = 'unknown'
}

export interface Order {
  orderId: string;
  merchant: string;
  orderDate: Date;
  state: OrderState;
  totalAmount?: string;
  trackingNumber?: string;
  items?: string[];
  lastUpdated: Date;
  emailIds: string[];  // Gmail message IDs related to this order
}

export interface EmailMessage {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: Date;
  body: string;
  snippet: string;
}

export interface OrderUpdate {
  orderId: string;
  merchant: string;
  state: OrderState;
  trackingNumber?: string;
  emailDate: Date;
  emailId: string;
  rawInfo?: any;
}

export interface Config {
  googleCredentialsFile: string;
  googleSheetId: string;
  anthropicApiKey?: string;
  gmailQuery?: string;
  lookbackDays: number;
  debug: boolean;
}
