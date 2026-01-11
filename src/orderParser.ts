/**
 * Email parser to extract order information and state from e-commerce emails
 */
import Anthropic from '@anthropic-ai/sdk';
import { JSDOM } from 'jsdom';
import { EmailMessage, OrderUpdate, OrderState } from './types';

export class OrderParser {
  private anthropic: Anthropic | null = null;

  constructor(anthropicApiKey?: string) {
    if (anthropicApiKey) {
      this.anthropic = new Anthropic({ apiKey: anthropicApiKey });
    }
  }

  /**
   * Parse an email to extract order information
   */
  async parseEmail(email: EmailMessage): Promise<OrderUpdate | null> {
    // First check if this looks like an e-commerce email
    if (!this.isEcommerceEmail(email)) {
      return null;
    }

    // Extract text from HTML if needed
    const cleanText = this.extractTextFromHtml(email.body);

    // Try pattern-based extraction first
    const patternResult = this.extractOrderInfoPattern(email, cleanText);

    // If we have Claude AI available, use it for better extraction
    if (this.anthropic && patternResult) {
      try {
        const aiResult = await this.extractOrderInfoAI(email, cleanText);
        if (aiResult) {
          // Merge AI results with pattern results
          return {
            ...patternResult,
            ...aiResult,
          };
        }
      } catch (error) {
        console.error('AI extraction failed, falling back to pattern matching:', error);
      }
    }

    return patternResult;
  }

  /**
   * Check if an email is likely from an e-commerce site
   */
  private isEcommerceEmail(email: EmailMessage): boolean {
    const subject = email.subject.toLowerCase();
    const from = email.from.toLowerCase();

    // Common e-commerce keywords in subject
    const keywords = [
      'order', 'purchase', 'receipt', 'confirmation', 'shipped', 'delivery',
      'tracking', 'invoice', 'refund', 'return', 'payment', 'transaction'
    ];

    const hasKeyword = keywords.some(keyword => subject.includes(keyword));

    // Common e-commerce domains
    const ecommerceDomains = [
      'amazon', 'ebay', 'etsy', 'shopify', 'walmart', 'target',
      'bestbuy', 'apple', 'nike', 'adidas', 'wayfair', 'homedepot',
      'lowes', 'macys', 'nordstrom', 'zappos', 'chewy', 'petco'
    ];

    const hasEcommerceDomain = ecommerceDomains.some(domain => from.includes(domain));

    return hasKeyword || hasEcommerceDomain;
  }

  /**
   * Extract text from HTML email body
   */
  private extractTextFromHtml(html: string): string {
    try {
      const dom = new JSDOM(html);
      const text = dom.window.document.body?.textContent || '';
      return text.replace(/\s+/g, ' ').trim();
    } catch {
      return html;
    }
  }

  /**
   * Extract order information using pattern matching
   */
  private extractOrderInfoPattern(email: EmailMessage, text: string): OrderUpdate | null {
    const orderId = this.extractOrderId(text);
    if (!orderId) {
      return null;
    }

    const merchant = this.extractMerchant(email.from);
    const state = this.detectOrderState(email.subject, text);
    const trackingNumber = this.extractTrackingNumber(text);

    return {
      orderId,
      merchant,
      state,
      trackingNumber,
      emailDate: email.date,
      emailId: email.id,
    };
  }

  /**
   * Extract order ID from email text
   */
  private extractOrderId(text: string): string | null {
    // Common patterns for order IDs
    const patterns = [
      /order\s*#?\s*:?\s*([A-Z0-9\-]{6,})/i,
      /order\s*number\s*:?\s*([A-Z0-9\-]{6,})/i,
      /order\s*id\s*:?\s*([A-Z0-9\-]{6,})/i,
      /confirmation\s*#?\s*:?\s*([A-Z0-9\-]{6,})/i,
      /purchase\s*#?\s*:?\s*([A-Z0-9\-]{6,})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }

  /**
   * Extract merchant name from email sender
   */
  private extractMerchant(from: string): string {
    // Extract domain or company name
    const emailMatch = from.match(/<([^>]+)>/);
    const email = emailMatch ? emailMatch[1] : from;

    // Extract domain
    const domainMatch = email.match(/@([^.]+)/);
    if (domainMatch) {
      const domain = domainMatch[1];
      // Capitalize first letter
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }

    return from;
  }

  /**
   * Detect order state from email content
   */
  private detectOrderState(subject: string, text: string): OrderState {
    const combined = `${subject} ${text}`.toLowerCase();

    // Check for different states
    if (combined.match(/refund(ed)?|money back/)) {
      return OrderState.REFUNDED;
    }

    if (combined.match(/return.*approved|return.*confirmed|return.*accepted/)) {
      return OrderState.RETURN_APPROVED;
    }

    if (combined.match(/return.*shipped|return.*picked up/)) {
      return OrderState.RETURN_SHIPPED;
    }

    if (combined.match(/return|send back|returning/)) {
      return OrderState.RETURN_PENDING;
    }

    if (combined.match(/delivered|delivery complete/)) {
      return OrderState.DELIVERED;
    }

    if (combined.match(/out for delivery|arriving today/)) {
      return OrderState.OUT_FOR_DELIVERY;
    }

    if (combined.match(/in transit|on the way/)) {
      return OrderState.IN_TRANSIT;
    }

    if (combined.match(/shipped|tracking|dispatched/)) {
      return OrderState.SHIPPED;
    }

    if (combined.match(/cancelled|canceled/)) {
      return OrderState.CANCELLED;
    }

    if (combined.match(/confirmed|confirmation/)) {
      return OrderState.CONFIRMED;
    }

    if (combined.match(/placed|purchase|receipt|thank you for your order/)) {
      return OrderState.PLACED;
    }

    return OrderState.UNKNOWN;
  }

  /**
   * Extract tracking number from email text
   */
  private extractTrackingNumber(text: string): string | undefined {
    const patterns = [
      /tracking\s*#?\s*:?\s*([A-Z0-9]{10,})/i,
      /tracking\s*number\s*:?\s*([A-Z0-9]{10,})/i,
      /track\s*your\s*package\s*:?\s*([A-Z0-9]{10,})/i,
      /shipment\s*#?\s*:?\s*([A-Z0-9]{10,})/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[1].trim();
      }
    }

    return undefined;
  }

  /**
   * Extract order information using Claude AI
   */
  private async extractOrderInfoAI(email: EmailMessage, text: string): Promise<Partial<OrderUpdate> | null> {
    if (!this.anthropic) return null;

    const prompt = `Analyze this e-commerce email and extract structured order information.

Subject: ${email.subject}
From: ${email.from}
Date: ${email.date}

Email content:
${text.slice(0, 4000)}

Extract the following information:
1. Order ID/Number
2. Merchant/Store name
3. Order state (one of: placed, confirmed, shipped, in_transit, out_for_delivery, delivered, return_pending, return_approved, return_shipped, refunded, cancelled)
4. Tracking number (if available)
5. Total amount (if available)

Respond ONLY with valid JSON in this exact format:
{
  "orderId": "order id or null",
  "merchant": "merchant name or null",
  "state": "order_state or null",
  "trackingNumber": "tracking number or null",
  "totalAmount": "amount or null"
}`;

    try {
      const message = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const responseText = message.content[0].type === 'text' ? message.content[0].text : '';
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        return {
          orderId: parsed.orderId || undefined,
          merchant: parsed.merchant || undefined,
          state: parsed.state || undefined,
          trackingNumber: parsed.trackingNumber || undefined,
          rawInfo: { totalAmount: parsed.totalAmount },
        };
      }
    } catch (error) {
      console.error('AI extraction error:', error);
    }

    return null;
  }
}
