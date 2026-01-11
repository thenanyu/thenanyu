# Quick Setup Guide

Follow these steps to get started with Gmail Order Tracker:

## 1. Google Cloud Setup (5 minutes)

### Enable APIs

1. Go to https://console.cloud.google.com/
2. Create a new project or select existing
3. Enable these APIs:
   - Gmail API: https://console.cloud.google.com/apis/library/gmail.googleapis.com
   - Sheets API: https://console.cloud.google.com/apis/library/sheets.googleapis.com

### Create OAuth Credentials

1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "+ CREATE CREDENTIALS" → "OAuth client ID"
3. If prompted, configure the OAuth consent screen:
   - User Type: External
   - App name: "Gmail Order Tracker"
   - User support email: Your email
   - Developer contact: Your email
   - Click "Save and Continue"
   - Add scope: `../auth/gmail.readonly` and `../auth/spreadsheets`
   - Add your email as a test user
4. Back to credentials page:
   - Click "+ CREATE CREDENTIALS" → "OAuth client ID"
   - Application type: "Desktop app"
   - Name: "Gmail Order Tracker"
   - Click "CREATE"
5. Download the JSON file
6. Save it as `credentials/credentials.json` in this project

## 2. Google Sheet Setup (1 minute)

1. Go to https://sheets.google.com
2. Create a new spreadsheet
3. Name it "Order Tracker" (or whatever you prefer)
4. Copy the Sheet ID from the URL:
   ```
   https://docs.google.com/spreadsheets/d/COPY_THIS_PART/edit
   ```

## 3. Install and Configure (2 minutes)

```bash
# Install dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit .env file
nano .env  # or use your favorite editor
```

In the `.env` file, set:
```bash
GOOGLE_CREDENTIALS_FILE=credentials/credentials.json
GOOGLE_SHEET_ID=your_sheet_id_from_step_2
```

## 4. Run First Time (1 minute)

```bash
# Build the project
npm run build

# Run the tracker
npm start
```

On first run:
1. A browser window will open
2. Sign in to your Google account
3. Click "Allow" to grant permissions
4. Copy the authorization code if needed
5. The app will create `token.json` for future runs

## 5. Check Results

Open your Google Sheet - it should now have:
- Headers in the first row
- Order data populated from your emails

## Optional: Add Anthropic API Key

For better parsing accuracy, add an Anthropic API key:

1. Get a key at: https://console.anthropic.com/
2. Add to `.env`:
   ```bash
   ANTHROPIC_API_KEY=sk-ant-...
   ```

## Troubleshooting

### "redirect_uri_mismatch" error

The OAuth client type must be "Desktop app", not "Web application"

### Can't find credentials.json

Make sure the file is in `credentials/credentials.json`

### No orders found

Try increasing the lookback period in `.env`:
```bash
LOOKBACK_DAYS=90
```

### Need help?

Open an issue on GitHub with:
- Error message
- What you were trying to do
- Output of `npm run dev`

---

That's it! You should now have an automated order tracking system. 🎉
