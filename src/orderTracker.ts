/**
 * Main order tracking service that coordinates Gmail, Sheets, and order parsing
 */
import { GmailClient } from './gmailClient';
import { SheetsClient } from './sheetsClient';
import { OrderParser } from './orderParser';
import { Order, OrderState, OrderUpdate } from './types';
import { config } from './config';

export class OrderTracker {
  private gmailClient: GmailClient;
  private sheetsClient: SheetsClient;
  private orderParser: OrderParser;

  constructor() {
    this.gmailClient = new GmailClient(config.googleCredentialsFile);
    this.sheetsClient = new SheetsClient(config.googleCredentialsFile, config.googleSheetId);
    this.orderParser = new OrderParser(config.anthropicApiKey);
  }

  /**
   * Initialize the order tracker
   */
  async initialize(): Promise<void> {
    console.log('Initializing Gmail Order Tracker...');

    await this.gmailClient.authenticate();
    console.log('✓ Gmail authenticated');

    await this.sheetsClient.authenticate();
    console.log('✓ Google Sheets authenticated');

    await this.sheetsClient.initializeSheet();
    console.log('✓ Spreadsheet initialized');
  }

  /**
   * Process emails and update the order tracking sheet
   */
  async processEmails(): Promise<void> {
    console.log('\nFetching emails...');

    const messageIds = await this.gmailClient.getMessages(
      config.gmailQuery || '',
      500,
      config.lookbackDays
    );

    console.log(`Found ${messageIds.length} emails to process`);

    let processedCount = 0;
    let ordersFound = 0;
    let ordersUpdated = 0;

    // Process emails in batches
    for await (const emails of this.gmailClient.getMessagesBatch(messageIds, 10)) {
      for (const email of emails) {
        processedCount++;

        if (config.debug) {
          console.log(`\nProcessing [${processedCount}/${messageIds.length}]: ${email.subject}`);
        } else if (processedCount % 50 === 0) {
          console.log(`Processed ${processedCount}/${messageIds.length} emails...`);
        }

        // Parse email for order information
        const orderUpdate = await this.orderParser.parseEmail(email);

        if (orderUpdate) {
          ordersFound++;

          if (config.debug) {
            console.log(`  ✓ Found order: ${orderUpdate.orderId} - ${orderUpdate.state}`);
          }

          // Update or create order in spreadsheet
          const updated = await this.updateOrder(orderUpdate);
          if (updated) {
            ordersUpdated++;
          }
        }
      }
    }

    console.log(`\n✓ Processing complete!`);
    console.log(`  - Processed ${processedCount} emails`);
    console.log(`  - Found ${ordersFound} order-related emails`);
    console.log(`  - Updated ${ordersUpdated} orders in spreadsheet`);
  }

  /**
   * Update or create an order based on email information
   */
  private async updateOrder(orderUpdate: OrderUpdate): Promise<boolean> {
    try {
      // Check if order already exists
      const existing = await this.sheetsClient.findOrder(orderUpdate.orderId);

      if (existing) {
        // Only update if this email has newer information
        const existingOrder = existing.order;

        // Check if email is newer than last update
        if (orderUpdate.emailDate <= existingOrder.lastUpdated) {
          if (config.debug) {
            console.log(`  - Skipping older email for order ${orderUpdate.orderId}`);
          }
          return false;
        }

        // Check if state should be updated (only if it's a progression)
        const shouldUpdate = this.shouldUpdateState(existingOrder.state, orderUpdate.state);

        if (!shouldUpdate && !orderUpdate.trackingNumber) {
          if (config.debug) {
            console.log(`  - No update needed for order ${orderUpdate.orderId}`);
          }
          return false;
        }

        // Update order
        const updatedOrder: Order = {
          ...existingOrder,
          state: shouldUpdate ? orderUpdate.state : existingOrder.state,
          trackingNumber: orderUpdate.trackingNumber || existingOrder.trackingNumber,
          lastUpdated: orderUpdate.emailDate,
          emailIds: [...existingOrder.emailIds, orderUpdate.emailId],
        };

        await this.sheetsClient.upsertOrder(updatedOrder);
        return true;
      } else {
        // Create new order
        const newOrder: Order = {
          orderId: orderUpdate.orderId,
          merchant: orderUpdate.merchant,
          orderDate: orderUpdate.emailDate,
          state: orderUpdate.state,
          trackingNumber: orderUpdate.trackingNumber,
          totalAmount: orderUpdate.rawInfo?.totalAmount,
          lastUpdated: orderUpdate.emailDate,
          emailIds: [orderUpdate.emailId],
        };

        await this.sheetsClient.upsertOrder(newOrder);
        return true;
      }
    } catch (error) {
      console.error(`Error updating order ${orderUpdate.orderId}:`, error);
      return false;
    }
  }

  /**
   * Determine if order state should be updated
   * Only update if the new state is a logical progression
   */
  private shouldUpdateState(currentState: OrderState, newState: OrderState): boolean {
    // Define state progression order
    const stateOrder: OrderState[] = [
      OrderState.PLACED,
      OrderState.CONFIRMED,
      OrderState.SHIPPED,
      OrderState.IN_TRANSIT,
      OrderState.OUT_FOR_DELIVERY,
      OrderState.DELIVERED,
    ];

    const returnStates = [
      OrderState.RETURN_PENDING,
      OrderState.RETURN_APPROVED,
      OrderState.RETURN_SHIPPED,
      OrderState.REFUNDED,
    ];

    // Always update to terminal states
    if (newState === OrderState.CANCELLED || newState === OrderState.REFUNDED) {
      return true;
    }

    // If current state is in return flow, stay in return flow
    if (returnStates.includes(currentState)) {
      const currentReturnIndex = returnStates.indexOf(currentState);
      const newReturnIndex = returnStates.indexOf(newState);
      return newReturnIndex > currentReturnIndex;
    }

    // If new state is return-related, allow transition
    if (returnStates.includes(newState)) {
      return true;
    }

    // For normal flow, only update if progressing forward
    const currentIndex = stateOrder.indexOf(currentState);
    const newIndex = stateOrder.indexOf(newState);

    if (currentIndex === -1 || newIndex === -1) {
      return true; // Unknown state, allow update
    }

    return newIndex > currentIndex;
  }

  /**
   * Monitor for new emails (continuous mode)
   */
  async monitor(intervalMinutes: number = 15): Promise<void> {
    console.log(`\nStarting monitoring mode (checking every ${intervalMinutes} minutes)...`);
    console.log('Press Ctrl+C to stop\n');

    // Process existing emails first
    await this.processEmails();

    // Set up periodic checking
    setInterval(async () => {
      console.log(`\n[${new Date().toISOString()}] Checking for new emails...`);
      await this.processEmails();
    }, intervalMinutes * 60 * 1000);
  }
}
