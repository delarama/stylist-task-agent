import 'dotenv/config';
import cron from 'node-cron';
import twilio from 'twilio';
import express from 'express';
import fs from 'fs';
import { TASKS } from './tasks.js';

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

const STATE_FILE = './state.json';

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    return { currentDay: 1, completedDays: [], startDate: new Date().toISOString() };
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
}

function saveState(state) {
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function getMotivationBar(day, total) {
  const pct = Math.round((day / total) * 100);
  const filled = Math.round(pct / 10);
  const bar = '█'.repeat(filled) + '░'.repeat(10 - filled);
  return `${bar} ${pct}%`;
}

function buildMessage(state) {
  const total = TASKS.length;
  const day = state.currentDay;
  const task = TASKS[day - 1];

  if (!task) {
    return `🎉 *You did it!* All ${total} days complete.\n\nThe Stylist Marketplace is live and growing. You built this one evening at a time. Incredible work.`;
  }

  const progress = getMotivationBar(day, total);
  const remaining = total - day;

  return `✨ *Stylist Marketplace — Day ${day} of ${total}*\n\n` +
    `📋 *Tonight's task:*\n${task.task}\n\n` +
    `⏱ ${task.time}\n\n` +
    `${progress}\n` +
    `_${remaining} days to launch-ready_\n\n` +
    `Reply *DONE* when finished · *SKIP* to save for tomorrow · *TIRED* for a 5-min version`;
}

function getTiredTask(day) {
  const fallbacks = [
    'Send 2 DMs to potential stylists. Just 2. That\'s it.',
    'Open your stylist tracker and add 5 new names from Instagram.',
    'Reply to any unanswered messages from stylists or users.',
    'Like and comment on 3 posts from potential stylists to warm them up.',
    'Write tomorrow\'s DM template so it\'s ready to copy-paste.',
  ];
  return fallbacks[day % fallbacks.length];
}

async function sendDailyTask() {
  const state = loadState();
  const message = buildMessage(state);

  try {
    await client.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_FROM}`,
      to: `whatsapp:${process.env.YOUR_WHATSAPP_NUMBER}`,
      body: message,
    });
    console.log(`[${new Date().toISOString()}] Task sent — Day ${state.currentDay}`);
  } catch (err) {
    console.error('Failed to send WhatsApp message:', err.message);
  }
}

// Incoming WhatsApp replies
app.post('/webhook', async (req, res) => {
  const body = (req.body.Body || '').trim().toUpperCase();
  const state = loadState();

  let reply = '';

  if (body === 'DONE') {
    state.completedDays.push(state.currentDay);
    state.currentDay = Math.min(state.currentDay + 1, TASKS.length + 1);
    saveState(state);
    const streakMsg = state.completedDays.length % 5 === 0
      ? `\n\n🔥 *${state.completedDays.length}-day streak!* You're on fire.`
      : '';
    reply = `✅ *Day ${state.currentDay - 1} complete!*${streakMsg}\n\nSee you tomorrow at 8:30 PM for Day ${state.currentDay}.`;

  } else if (body === 'SKIP') {
    reply = `⏭ No worries — Day ${state.currentDay} will wait for you. Tomorrow at 8:30 PM.\n\n_Rest is part of the plan._`;

  } else if (body === 'TIRED') {
    const miniTask = getTiredTask(state.currentDay);
    reply = `😴 *5-minute version:*\n\n${miniTask}\n\nWhen done, reply *DONE* to move forward, or just rest — tomorrow's another day.`;

  } else if (body === 'STATUS') {
    const total = TASKS.length;
    const pct = Math.round((state.currentDay / total) * 100);
    reply = `📊 *Your progress*\n\nDay ${state.currentDay} of ${total} (${pct}%)\nCompleted: ${state.completedDays.length} tasks\n\n${getMotivationBar(state.currentDay, total)}`;

  } else if (body === 'HELP') {
    reply = `*Commands:*\n\n*DONE* — mark today complete & advance\n*SKIP* — keep today for tomorrow\n*TIRED* — get a 5-min version\n*STATUS* — see your progress\n*HELP* — show this list`;

  } else {
    reply = `I didn't catch that. Reply *HELP* to see available commands.`;
  }

  // Respond via Twilio TwiML
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>${reply}</Message>
</Response>`);
});

// Health check
app.get('/', (req, res) => {
  const state = loadState();
  res.json({
    status: 'running',
    currentDay: state.currentDay,
    totalDays: TASKS.length,
    completedDays: state.completedDays.length,
    nextTask: TASKS[state.currentDay - 1]?.task || 'All done!',
  });
});

// Manual trigger (for testing)
app.post('/send-now', async (req, res) => {
  await sendDailyTask();
  res.json({ ok: true, message: 'Task sent' });
});

// Cron: 8:30 PM Vancouver (PT) = 04:30 UTC (PST) / 03:30 UTC (PDT)
// We use America/Vancouver TZ in the cron options
cron.schedule('30 20 * * 1-5', sendDailyTask, {
  timezone: 'America/Vancouver',
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Task agent running on port ${PORT}`);
  console.log(`Scheduler: 8:30 PM PT, Mon–Fri`);
  console.log(`Current day: ${loadState().currentDay}`);
});
