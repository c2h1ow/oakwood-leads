# Oakwood Suites Tiwanon — Lead Capture System

## Quick Start

```bash
cd oakwood-leads
npm install
cp .env.example .env
# fill in .env values
npm start
# → http://localhost:3000
```

## Webhook URLs (expose with ngrok for local dev)

| Platform | URL |
|---|---|
| LINE | `POST /line/webhook` |
| Facebook (verify) | `GET /facebook/webhook` |
| Facebook (events) | `POST /facebook/webhook` |

### ngrok example
```bash
ngrok http 3000
# use the https URL in LINE / Facebook developer consoles
```

## Environment Variables

| Key | Description |
|---|---|
| `LINE_CHANNEL_SECRET` | From LINE Developers console |
| `LINE_CHANNEL_ACCESS_TOKEN` | Channel access token |
| `FB_VERIFY_TOKEN` | Any string you choose (set same in FB console) |
| `FB_PAGE_ACCESS_TOKEN` | Facebook Page access token |
| `GMAIL_USER` | Gmail address for SMTP |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not your login password) |
| `TEAM_EMAIL` | Destination email for lead notifications |

## Package Auto-Detection

| Keywords in message | Detected Package |
|---|---|
| `1990`, `24 ชม`, `24hr` | Stay 24hr |
| `2880`, `executive` | Executive Corner |
| `long stay`, `7 คืน`, `12900` | Long Stay |
