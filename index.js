/**
 * Hermie - Clay's Personal Life-Ops Slack Bot
 * Powered by Claude and Clay-Mate
 */

require('dotenv').config();

const http = require('http');
const { App } = require('@slack/bolt');
const Anthropic = require('@anthropic-ai/sdk');

const clayMate = require('./clay-mate');
const memory = require('./memory');
const { buildSystemPrompt, getToolDefinitions } = require('./hermie-prompt');

// Initialize Slack app with Socket Mode
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  appToken: process.env.SLACK_APP_TOKEN,
  socketMode: true
});

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

// Write operations that trigger a context re-pull
const WRITE_OPERATIONS = [
  'add_action_item',
  'complete_action_item',
  'update_action_item',
  'add_thought',
  'add_agent_state'
];

/**
 * Execute a Clay-Mate tool call
 */
async function executeToolCall(toolName, toolInput) {
  console.log(`Executing tool: ${toolName}`, toolInput);

  switch (toolName) {
    case 'global_search':
      return clayMate.globalSearch(toolInput.query);
    case 'add_action_item':
      return clayMate.addActionItem(toolInput);
    case 'complete_action_item':
      return clayMate.completeActionItem(toolInput.id);
    case 'update_action_item':
      return clayMate.updateActionItem(toolInput.id, toolInput);
    case 'add_thought':
      return clayMate.addThought(toolInput);
    case 'add_agent_state':
      return clayMate.addAgentState(toolInput);
    case 'list_action_items':
      return clayMate.listActionItems(toolInput);
    case 'list_thoughts':
      return clayMate.listThoughts(toolInput);
    case 'list_people':
      return clayMate.listPeople(toolInput);
    default:
      return { error: `Unknown tool: ${toolName}`, data: null };
  }
}

/**
 * Process a message through Claude with tool use support
 */
async function processWithClaude(userId, userMessage) {
  // Handle session boot if needed
  await memory.processIncomingMessage(userId, userMessage);

  const systemPrompt = buildSystemPrompt(memory.getClayMateContext(userId));
  const messages = memory.getMessages(userId);
  const tools = getToolDefinitions();

  let response;
  let continueLoop = true;
  let currentMessages = [...messages];
  let usedWriteOperation = false;

  while (continueLoop) {
    try {
      response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        tools: tools,
        messages: currentMessages
      });
    } catch (err) {
      console.error('Claude API error:', err);
      return "Sorry, I hit an error talking to Claude. Give me a sec and try again.";
    }

    // Check if we need to process tool calls
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(block => block.type === 'tool_use');
      const toolResults = [];

      for (const toolUse of toolUseBlocks) {
        const result = await executeToolCall(toolUse.name, toolUse.input);

        // Track if we used a write operation
        if (WRITE_OPERATIONS.includes(toolUse.name)) {
          usedWriteOperation = true;
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: JSON.stringify(result.data || { error: result.error })
        });
      }

      // Add assistant response and tool results to messages
      currentMessages.push({
        role: 'assistant',
        content: response.content
      });
      currentMessages.push({
        role: 'user',
        content: toolResults
      });
    } else {
      // No more tool calls, we're done
      continueLoop = false;
    }
  }

  // Extract text response
  const textBlocks = response.content.filter(block => block.type === 'text');
  const finalResponse = textBlocks.map(block => block.text).join('\n');

  // Record the final response
  memory.recordAssistantResponse(userId, finalResponse);

  // If we used a write operation, invalidate context for next message
  if (usedWriteOperation) {
    memory.invalidateContext(userId);
  }

  return finalResponse;
}

/**
 * Extract plain text from Slack message (handle mentions, etc.)
 */
function extractMessageText(text, botUserId) {
  if (!text) return '';

  // Remove bot mention if present
  const mentionRegex = new RegExp(`<@${botUserId}>`, 'g');
  let cleaned = text.replace(mentionRegex, '').trim();

  return cleaned;
}

// Handle direct messages
app.event('message', async ({ event, client, context }) => {
  // Ignore bot messages, message_changed, etc.
  if (event.subtype) return;
  if (event.bot_id) return;

  // Only respond in DMs (im) or when mentioned
  const channelInfo = await client.conversations.info({ channel: event.channel });
  const isDM = channelInfo.channel.is_im;

  if (!isDM) return; // For non-DMs, we use app_mention event

  const userId = event.user;
  const messageText = extractMessageText(event.text, context.botUserId);

  if (!messageText) return;

  console.log(`DM from ${userId}: ${messageText}`);

  try {
    const response = await processWithClaude(userId, messageText);

    await client.chat.postMessage({
      channel: event.channel,
      text: response,
      mrkdwn: true
    });
  } catch (err) {
    console.error('Error handling DM:', err);
    await client.chat.postMessage({
      channel: event.channel,
      text: "Something went wrong on my end. Try again in a sec."
    });
  }
});

// Handle @mentions in channels
app.event('app_mention', async ({ event, client, context }) => {
  const userId = event.user;
  const messageText = extractMessageText(event.text, context.botUserId);

  if (!messageText) {
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: "You rang? What can I help with?"
    });
    return;
  }

  console.log(`Mention from ${userId} in ${event.channel}: ${messageText}`);

  try {
    const response = await processWithClaude(userId, messageText);

    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: response,
      mrkdwn: true
    });
  } catch (err) {
    console.error('Error handling mention:', err);
    await client.chat.postMessage({
      channel: event.channel,
      thread_ts: event.ts,
      text: "Something went wrong on my end. Try again in a sec."
    });
  }
});

// Simple health check server for Railway/uptime monitoring
const healthServer = http.createServer((req, res) => {
  if (req.url === '/health' || req.url === '/') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'hermie'
    }));
  } else {
    res.writeHead(404);
    res.end();
  }
});

// Start the app
(async () => {
  const port = process.env.PORT || 3000;

  // Start health check server
  healthServer.listen(port, () => {
    console.log(`Health check server running on port ${port}`);
  });

  // Start Slack app (Socket Mode doesn't need a port)
  await app.start();
  console.log('Hermie is running');
  console.log('Socket Mode: connected');
  console.log('Ready to chat!');
})();
