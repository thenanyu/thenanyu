# Gmail Order Tracker

Automatically track all your e-commerce orders from Gmail to Google Sheets. This utility monitors your Gmail inbox, identifies order-related emails, extracts order information, and maintains an up-to-date Google Sheet with the current status of all your orders.

## Features

- 🔍 **Automatic Email Detection**: Identifies e-commerce emails from popular retailers
- 📦 **Order State Tracking**: Tracks orders through their lifecycle (placed, shipped, delivered, returns, etc.)
- 📊 **Google Sheets Integration**: Maintains a clean, organized spreadsheet of all orders
- 🤖 **AI-Powered Parsing**: Optional Claude AI integration for intelligent email parsing
- 🔄 **Continuous Monitoring**: Can run continuously to monitor for new emails
- 🎯 **Smart Updates**: Only updates orders when new information is available

## Order States Tracked

The tracker monitors and records the following order states:

- **placed**: Order has been placed
- **confirmed**: Order confirmed by merchant
- **shipped**: Order has been shipped
- **in_transit**: Order is on the way
- **out_for_delivery**: Order is out for delivery
- **delivered**: Order has been delivered
- **return_pending**: Return has been initiated
- **return_approved**: Return has been approved
- **return_shipped**: Return package has been shipped
- **refunded**: Refund has been processed
- **cancelled**: Order has been cancelled

## Prerequisites

- Node.js 18+ and npm
- A Google account with Gmail
- A Google Cloud project with Gmail and Google Sheets APIs enabled
- (Optional but recommended) An Anthropic API key for enhanced parsing

## Setup Instructions

### 1. Set Up Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Gmail API
   - Google Sheets API

**Enable APIs:**
```bash
# Visit these URLs and click "Enable"
https://console.cloud.google.com/apis/library/gmail.googleapis.com
https://console.cloud.google.com/apis/library/sheets.googleapis.com
```

### 2. Create OAuth 2.0 Credentials

1. Go to [Credentials](https://console.cloud.google.com/apis/credentials)
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Desktop app" as the application type
4. Download the credentials JSON file
5. Rename it to `credentials.json` and place it in the `credentials/` directory

### 3. Create a Google Sheet

1. Create a new [Google Sheet](https://sheets.google.com)
2. Copy the Sheet ID from the URL (the long string between `/d/` and `/edit`)
   - Example: `https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID_HERE/edit`
3. You'll need this ID for the configuration

### 4. Install Dependencies

```bash
npm install
```

### 5. Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and fill in your values:
```bash
# Required: Path to your Google OAuth credentials
GOOGLE_CREDENTIALS_FILE=credentials/credentials.json

# Required: Your Google Sheet ID
GOOGLE_SHEET_ID=your_sheet_id_here

# Optional: Anthropic API key for AI-powered parsing (recommended)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# Optional: Gmail search query to filter emails
# Examples:
#   from:(amazon.com OR ebay.com OR etsy.com)
#   subject:order
GMAIL_QUERY=

# Optional: How many days back to search (default: 30)
LOOKBACK_DAYS=30

# Optional: Enable debug logging (default: false)
DEBUG=false
```

### 6. First Run - Authentication

On first run, the application will open a browser window asking you to authorize access to your Gmail and Google Sheets. After authorizing, a `token.json` file will be created to store your credentials for future runs.

```bash
npm run build
npm start
```

## Usage

### One-Time Processing

Process all emails from the lookback period and update the spreadsheet:

```bash
npm start
```

Or in development mode:

```bash
npm run dev
```

### Continuous Monitoring

Run continuously and check for new emails every 15 minutes:

```bash
npm start -- --monitor
```

Check every 5 minutes instead:

```bash
npm start -- --monitor --interval=5
```

### Development

Build the TypeScript code:

```bash
npm run build
```

Watch for changes and rebuild:

```bash
npm run watch
```

Clean build directory:

```bash
npm run clean
```

## How It Works

1. **Authentication**: Connects to Gmail and Google Sheets using OAuth 2.0
2. **Email Fetching**: Retrieves emails from Gmail based on the configured query and lookback period
3. **Email Parsing**: Analyzes each email to determine if it's order-related
4. **Information Extraction**: Extracts order ID, merchant, state, tracking numbers, etc.
5. **Spreadsheet Update**: Updates the Google Sheet with order information
6. **Smart Updates**: Only updates orders when newer information is found

## Spreadsheet Format

The Google Sheet will contain the following columns:

| Column | Description |
|--------|-------------|
| Order ID | Unique order identifier |
| Merchant | Store or retailer name |
| Order Date | Date the order was placed |
| Current State | Current order status |
| Total Amount | Order total (if available) |
| Tracking Number | Package tracking number |
| Items | List of items in the order |
| Last Updated | Last time this order was updated |
| Email IDs | Gmail message IDs related to this order |

## Configuration Options

### Gmail Query

You can filter which emails to process using Gmail's search syntax:

```bash
# Only process emails from specific merchants
GMAIL_QUERY=from:(amazon.com OR ebay.com OR etsy.com OR shopify.com)

# Only process emails with "order" in subject
GMAIL_QUERY=subject:order

# Combine filters
GMAIL_QUERY=from:(amazon.com OR ebay.com) subject:(order OR shipping)
```

### Anthropic API Key

While optional, using Claude AI significantly improves parsing accuracy, especially for:
- Non-standard email formats
- International merchants
- Complex order structures
- Extracting additional details like item descriptions and prices

Get an API key at [Anthropic Console](https://console.anthropic.com/)

## Supported Merchants

The tracker works with most e-commerce platforms including:

- Amazon
- eBay
- Etsy
- Shopify stores
- Walmart
- Target
- Best Buy
- Apple Store
- Nike
- And many more...

The pattern-based parser handles standard e-commerce email formats, and with Claude AI enabled, it can handle virtually any merchant.

## Troubleshooting

### "Token has been expired or revoked"

Delete `token.json` and run the application again to re-authenticate:

```bash
rm token.json
npm start
```

### "Unable to find credentials.json"

Make sure you've placed your Google OAuth credentials file in `credentials/credentials.json`

### "Sheet not found"

Verify that:
1. The `GOOGLE_SHEET_ID` in your `.env` is correct
2. Your Google account has access to the sheet
3. The sheet hasn't been deleted

### No orders found

Try:
1. Increase `LOOKBACK_DAYS` to search further back
2. Adjust or remove `GMAIL_QUERY` to include more emails
3. Enable `DEBUG=true` to see which emails are being processed

## Privacy & Security

- **Local Processing**: All email processing happens locally on your machine
- **OAuth 2.0**: Uses Google's secure OAuth 2.0 for authentication
- **Minimal Permissions**: Only requests read-only access to Gmail
- **No Data Storage**: Email content is processed in memory and not stored
- **Token Security**: Your authentication token is stored locally in `token.json`

## Development

### Project Structure

```
gmail-order-tracker/
├── src/
│   ├── index.ts           # Main entry point
│   ├── orderTracker.ts    # Main orchestration service
│   ├── gmailClient.ts     # Gmail API client
│   ├── sheetsClient.ts    # Google Sheets API client
│   ├── orderParser.ts     # Email parsing logic
│   ├── types.ts           # TypeScript type definitions
│   └── config.ts          # Configuration management
├── credentials/
│   └── credentials.json   # Google OAuth credentials (not in git)
├── .env                   # Environment variables (not in git)
├── token.json            # OAuth token (not in git)
├── package.json
├── tsconfig.json
└── README.md
```

### Adding Custom Parsers

You can extend the `OrderParser` class to add custom parsing logic for specific merchants:

```typescript
// In src/orderParser.ts
private extractOrderInfoPattern(email: EmailMessage, text: string): OrderUpdate | null {
  // Add your custom parsing logic here
}
```

## License

MIT

## Contributing

Contributions are welcome! Feel free to submit issues or pull requests.

## Support

If you encounter any issues or have questions, please open an issue on GitHub.
