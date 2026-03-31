# Hermie

Clay's personal life-ops Slack bot, powered by Claude and Clay-Mate.

## What Hermie Does

Hermie is a conversational AI agent that lives in Slack. It knows your life context through Clay-Mate (tasks, projects, thoughts, contacts) and can:

- Answer questions about your tasks, projects, and schedule
- Add, complete, and update tasks
- Save thoughts and reminders
- Search across your entire Clay-Mate history
- Actually be helpful without being a corporate robot

## Tech Stack

- **Runtime:** Node.js
- **Slack:** Slack Bolt SDK with Socket Mode
- **AI:** Claude Sonnet (claude-sonnet-4-20250514)
- **Memory:** Clay-Mate MCP server (Supabase-backed)
- **Deployment:** Railway

---

## Setup Instructions

### Step 1: Create a Slack App

1. Go to [api.slack.com/apps](https://api.slack.com/apps)
2. Click **Create New App**
3. Choose **From scratch**
4. Name it `Hermie` (or whatever you want)
5. Select your workspace
6. Click **Create App**

### Step 2: Configure Bot Token Scopes

1. In your app settings, go to **OAuth & Permissions** (left sidebar)
2. Scroll to **Scopes** → **Bot Token Scopes**
3. Add these scopes:
   - `app_mentions:read` - So Hermie can see when it's @mentioned
   - `channels:history` - To read messages in public channels (when mentioned)
   - `chat:write` - To send messages
   - `groups:history` - To read messages in private channels (when mentioned)
   - `im:history` - To read DM history
   - `im:read` - To access DM metadata
   - `im:write` - To send DMs
   - `mpim:history` - To read group DM history
   - `reactions:read` - To see reactions (optional but nice)
   - `reactions:write` - To add the "thinking" reaction
   - `users:read` - To get user info

### Step 3: Enable Socket Mode

1. Go to **Socket Mode** (left sidebar)
2. Toggle **Enable Socket Mode** to ON
3. You'll be prompted to create an App-Level Token
4. Name it `hermie-socket` (or whatever)
5. Add the scope: `connections:write`
6. Click **Generate**
7. **Copy this token** (starts with `xapp-`) — this is your `SLACK_APP_TOKEN`

### Step 4: Subscribe to Events

1. Go to **Event Subscriptions** (left sidebar)
2. Toggle **Enable Events** to ON
3. Under **Subscribe to bot events**, add:
   - `app_mention` - When someone @mentions Hermie
   - `message.im` - When someone DMs Hermie
4. Click **Save Changes**

### Step 5: Install the App to Your Workspace

1. Go to **Install App** (left sidebar)
2. Click **Install to Workspace**
3. Authorize the permissions
4. **Copy the Bot User OAuth Token** (starts with `xoxb-`) — this is your `SLACK_BOT_TOKEN`

### Step 6: Enable DMs with the Bot

1. Go to **App Home** (left sidebar)
2. Scroll to **Show Tabs**
3. Toggle **Messages Tab** to ON
4. Check **Allow users to send Slash commands and messages from the messages tab**

---

## Deploy to Railway

### Step 1: Push to GitHub

1. Create a new GitHub repo for Hermie
2. Push this code to it:

```bash
cd hermie
git init
git add .
git commit -m "Initial Hermie setup"
git remote add origin https://github.com/YOUR_USERNAME/hermie.git
git push -u origin main
```

### Step 2: Create Railway Project

1. Go to [railway.app](https://railway.app) and sign in
2. Click **New Project**
3. Choose **Deploy from GitHub repo**
4. Select your `hermie` repo
5. Railway will detect it's a Node.js app

### Step 3: Add Environment Variables

1. In your Railway project, click on the service
2. Go to **Variables** tab
3. Add these variables (click **Raw Editor** to paste them all):

```
SLACK_BOT_TOKEN=xoxb-your-bot-token
SLACK_APP_TOKEN=xapp-your-app-token
ANTHROPIC_API_KEY=sk-ant-your-key
CLAY_MATE_MCP_URL=https://bnmupvkjtghnzczkmpxj.supabase.co/functions/v1/clay-mate
CLAY_MATE_MCP_KEY=your-clay-mate-key
```

4. Railway will automatically redeploy with the new variables

### Step 4: Verify It's Running

1. Check the **Deployments** tab for build logs
2. Look for: `Hermie is running on port 3000` and `Socket Mode: connected`
3. Open Slack and DM Hermie: "hey, what's on my plate today?"

---

## Local Development

1. Clone the repo
2. Copy `.env.example` to `.env` and fill in your values
3. Install dependencies:

```bash
npm install
```

4. Run with hot reloading:

```bash
npm run dev
```

5. Or run normally:

```bash
npm start
```

---

## Keeping Hermie Alive

Railway's free tier (and Render, etc.) can spin down after inactivity. To prevent this:

1. Set up [Uptime Robot](https://uptimerobot.com) (free tier works)
2. Create a new HTTP(s) monitor
3. Point it at: `https://your-railway-url.up.railway.app/health`
4. Set interval to 5 minutes

The `/health` endpoint returns `{"status": "ok", "timestamp": "...", "service": "hermie"}`.

---

## How the Memory System Works

Hermie doesn't pull all of Clay-Mate on every message. That would be slow.

**Session boot (first message after 2+ hours):**
- Pulls daily briefing, open tasks, active projects, agent state
- Bundles into system prompt context

**Mid-conversation:**
- Uses rolling window of last 20 messages
- Relies on booted context + conversation history

**After writes:**
- Any write operation (add task, complete task, etc.) invalidates context
- Next message triggers a fresh boot pull

**Deep lookup:**
- When you ask about something specific, Hermie uses `global_search`
- Only pulls what's needed, not everything

---

## Files

- `index.js` — Main Slack app, Claude integration, message handling
- `clay-mate.js` — Clay-Mate MCP API wrapper
- `memory.js` — Session management, context loading
- `hermie-prompt.js` — System prompt builder, tool definitions

---

## Troubleshooting

**"Hermie isn't responding to DMs"**
- Make sure **Messages Tab** is enabled in App Home settings
- Check that `message.im` event subscription is added

**"Hermie isn't responding to @mentions"**
- Make sure `app_mention` event subscription is added
- Make sure the bot is invited to the channel

**"Socket Mode won't connect"**
- Verify your `SLACK_APP_TOKEN` starts with `xapp-`
- Make sure Socket Mode is enabled in app settings

**"Claude API errors"**
- Check your `ANTHROPIC_API_KEY` is valid
- Check you have API credits

**"Clay-Mate calls failing"**
- Verify `CLAY_MATE_MCP_URL` and `CLAY_MATE_MCP_KEY` are correct
- Check the Supabase function logs
