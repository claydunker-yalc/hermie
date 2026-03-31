/**
 * Session Memory Management
 * Handles conversation history, context loading, and write-triggered re-pulls
 */

const clayMate = require('./clay-mate');

// In-memory session store keyed by Slack user ID
const sessions = new Map();

// Session timeout: 2 hours in milliseconds
const SESSION_TIMEOUT_MS = 2 * 60 * 60 * 1000;

// Max messages to keep in rolling window
const MAX_MESSAGES = 20;

/**
 * Get or create a session for a user
 */
function getSession(userId) {
  if (!sessions.has(userId)) {
    sessions.set(userId, {
      messages: [],
      lastActivity: null,
      contextLoaded: false,
      clayMateContext: null
    });
  }
  return sessions.get(userId);
}

/**
 * Check if session needs a fresh boot (first message or 2+ hour gap)
 */
function needsBootContext(session) {
  if (!session.contextLoaded) return true;
  if (!session.lastActivity) return true;

  const timeSinceLastActivity = Date.now() - session.lastActivity;
  return timeSinceLastActivity > SESSION_TIMEOUT_MS;
}

/**
 * Format Clay-Mate context for system prompt injection
 */
function formatClayMateContext(bootData) {
  const sections = [];

  if (bootData.briefing) {
    sections.push(`## Today's Briefing\n${JSON.stringify(bootData.briefing, null, 2)}`);
  }

  if (bootData.tasks && Array.isArray(bootData.tasks) && bootData.tasks.length > 0) {
    const taskList = bootData.tasks.map(t => {
      const due = t.due_date ? ` (due: ${t.due_date})` : '';
      const domain = t.domain ? ` [${t.domain}]` : '';
      return `- ${t.title}${domain}${due} (id: ${t.id})`;
    }).join('\n');
    sections.push(`## Open Tasks\n${taskList}`);
  }

  if (bootData.projects && Array.isArray(bootData.projects) && bootData.projects.length > 0) {
    const projectList = bootData.projects.map(p => {
      return `- ${p.name}: ${p.description || 'No description'} (id: ${p.id})`;
    }).join('\n');
    sections.push(`## Active Projects\n${projectList}`);
  }

  if (bootData.agentState && Array.isArray(bootData.agentState) && bootData.agentState.length > 0) {
    const stateList = bootData.agentState.map(s => {
      return `- ${s.key}: ${s.value}`;
    }).join('\n');
    sections.push(`## Agent State / Reminders\n${stateList}`);
  }

  if (bootData.errors && bootData.errors.length > 0) {
    sections.push(`## Context Load Issues\nSome Clay-Mate data couldn't be loaded: ${bootData.errors.join(', ')}`);
  }

  return sections.length > 0
    ? `\n\n---\n# CLAY-MATE CONTEXT (Current as of ${new Date().toLocaleString()})\n\n${sections.join('\n\n')}\n---\n`
    : '\n\n[Clay-Mate context unavailable]\n';
}

/**
 * Load boot context and update session
 */
async function bootSession(userId) {
  const session = getSession(userId);

  console.log(`Booting Clay-Mate context for user ${userId}...`);
  const bootData = await clayMate.loadBootContext();

  session.clayMateContext = formatClayMateContext(bootData);
  session.contextLoaded = true;
  session.lastActivity = Date.now();

  console.log(`Clay-Mate context loaded for user ${userId}`);
  return session;
}

/**
 * Add a message to the session history
 */
function addMessage(userId, role, content) {
  const session = getSession(userId);

  session.messages.push({ role, content });
  session.lastActivity = Date.now();

  // Trim to rolling window
  if (session.messages.length > MAX_MESSAGES) {
    session.messages = session.messages.slice(-MAX_MESSAGES);
  }

  return session;
}

/**
 * Get conversation history for Claude API
 */
function getMessages(userId) {
  const session = getSession(userId);
  return session.messages;
}

/**
 * Get Clay-Mate context for system prompt
 */
function getClayMateContext(userId) {
  const session = getSession(userId);
  return session.clayMateContext || '';
}

/**
 * Mark session as needing re-pull (after a write operation)
 */
function invalidateContext(userId) {
  const session = getSession(userId);
  session.contextLoaded = false;
  console.log(`Context invalidated for user ${userId} - will re-pull on next message`);
}

/**
 * Process an incoming message - handle boot if needed
 */
async function processIncomingMessage(userId, userMessage) {
  const session = getSession(userId);

  // Check if we need to boot
  if (needsBootContext(session)) {
    await bootSession(userId);
  }

  // Add user message to history
  addMessage(userId, 'user', userMessage);

  return session;
}

/**
 * Record assistant response
 */
function recordAssistantResponse(userId, response) {
  addMessage(userId, 'assistant', response);
}

module.exports = {
  getSession,
  needsBootContext,
  bootSession,
  addMessage,
  getMessages,
  getClayMateContext,
  invalidateContext,
  processIncomingMessage,
  recordAssistantResponse
};
