# Stylist Marketplace — Daily Task Agent

Sends you one task every weekday evening at **8:30 PM Vancouver (PT)** via WhatsApp.
You reply to mark it done, skip it, or get a 5-minute version when you're tired.

---

## How it works

1. Every weekday at 8:30 PM PT, you get a WhatsApp message with today's task + progress bar
2. You reply with a command to interact
3. The agent tracks your progress in a local `state.json` file

**Reply commands:**
| Reply | What happens |
|-------|-------------|
| `DONE` | Marks today complete, advances to next day |
| `SKIP` | Keeps today's task for tomorrow |
| `TIRED` | Sends you a 5-minute micro-task instead |
| `STATUS` | Shows your current progress |
| `HELP` | Lists all commands |

---

## Setup (one-time, ~20 minutes)

### Step 1 — Twilio account
1. Go to [twilio.com](https://twilio.com) and create a free account
2. From the Console dashboard, copy your **Account SID** and **Auth Token**
3. Go to **Messaging → Try it out → Send a WhatsApp message**
4. Follow the sandbox setup — you'll send a join code from your WhatsApp to activate it
5. Note the sandbox number (usually `+14155238886`)

### Step 2 — Install & configure
```bash
# Clone or copy this folder, then:
npm install

# Copy the env template
cp .env.example .env

# Fill in your values:
nano .env
```

Fill in `.env`:
```
TWILIO_ACCOUNT_SID=ACxxxxxxx...
TWILIO_AUTH_TOKEN=your_token
TWILIO_WHATSAPP_FROM=+14155238886
YOUR_WHATSAPP_NUMBER=+16041234567   ← your number with country code
```

### Step 3 — Expose your server for Twilio webhooks

Twilio needs to reach your server to deliver WhatsApp replies. Use **ngrok** for local dev:

```bash
# Install ngrok (one-time): https://ngrok.com/download
ngrok http 3000
```

Copy the `https://xxxx.ngrok.io` URL. In Twilio Console:
- Go to **Messaging → Try it out → WhatsApp sandbox settings**
- Set **"When a message comes in"** webhook to: `https://xxxx.ngrok.io/webhook`
- Method: `POST`

> For production, deploy to Railway, Render, or Fly.io and use that URL instead.

### Step 4 — Run it
```bash
npm start
```

You should see:
```
Task agent running on port 3000
Scheduler: 8:30 PM PT, Mon–Fri
Current day: 1
```

### Step 5 — Test it
Send yourself a test message immediately:
```bash
curl -X POST http://localhost:3000/send-now
```

Check your WhatsApp — you should receive Day 1's task.

---

## Deploying to production (so it runs 24/7 without your laptop)

### Option A — Railway (easiest, free tier available)
1. Push this folder to a GitHub repo
2. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub
3. Add your `.env` variables in the Railway dashboard under Variables
4. Railway gives you a public URL — use that for your Twilio webhook

### Option B — Render
1. Push to GitHub
2. Go to [render.com](https://render.com) → New Web Service
3. Connect your repo, set start command to `npm start`
4. Add environment variables
5. Use the Render URL for your Twilio webhook

---

## Resetting progress
Delete `state.json` to start from Day 1, or edit it directly to jump to any day:
```json
{
  "currentDay": 15,
  "completedDays": [1,2,3,4,5,6,7,8,9,10,11,12,13,14],
  "startDate": "2026-03-01T00:00:00.000Z"
}
```

---

## What a message looks like

```
✨ Stylist Marketplace — Day 14 of 70

📋 Tonight's task:
Send 5 DMs on Instagram. Copy your template — personalise 
the first line with something specific to each account.

⏱ 30 min

████░░░░░░ 20%
_56 days to launch-ready_

Reply DONE when finished · SKIP to save for tomorrow · TIRED for a 5-min version
```

---

## Schedule
- **Runs:** Monday–Friday only (weekends are your rest days)
- **Time:** 8:30 PM Vancouver (America/Vancouver timezone)
- **Auto-adjusts** for Pacific Daylight Time (PDT) and Pacific Standard Time (PST)
