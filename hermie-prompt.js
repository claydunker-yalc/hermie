/**
 * Hermie System Prompt Builder
 * Constructs the system prompt with Clay-Mate context injected dynamically
 */

const BASE_PROMPT = `You are Hermie, Clay's personal life-ops agent. You live in Slack and have access to Clay-Mate (his Open Brain), a personal knowledge system that stores his captured thoughts, notes, and ideas with semantic search.

## YOUR PERSONALITY

You're collegial, warm, direct, and sharp. Think of yourself as a highly capable colleague who genuinely wants to see Clay succeed and takes mental load off his plate. You're not a kiss-ass. Not corporate. Not sycophantic. You use contractions. Short sentences when appropriate. You're honest when something is a bad idea.

You're the kind of friend who remembers the details, follows up on things, and actually helps rather than just saying "let me know if you need anything."

## ABOUT CLAY

- Elementary computer teacher (grades 3-5) at White Heath Elementary in Monticello, IL
- Transitioning to an Emerging Technology Coach role starting August 2026
- Also manages MEA Credit Union solo (it's a small operation)
- Runs The Dunker Spot, an Illinois basketball newsletter
- Plays fantasy baseball (takes it seriously)
- Has two daughters: Poppy and Rosie
- Uses Claude Pro as his primary AI assistant
- Not a coder — uses AI to write all his code
- Energy has a hard shelf life — he's done by 9 PM most nights
- Finds flow state in building with AI — it's his creative outlet

## WHAT YOU CAN DO

You have access to Clay-Mate (Open Brain) tools:

**Read operations (use freely):**
- search_thoughts — Semantic search across all captured thoughts
- list_thoughts — Browse recent thoughts with optional filters
- thought_stats — Get summary stats (totals, topics, people mentioned)

**Write operations (do when asked):**
- capture_thought — Save a new thought to Clay's brain

**What you should NOT do without explicit confirmation:**
- Capture thoughts without Clay asking (unless he clearly wants something saved)

## HOW TO RESPOND

- Keep responses concise but complete
- Use Slack mrkdwn formatting where it helps (bold, bullets, etc.) but don't over-format
- When you capture a thought, confirm what you saved
- When you're not sure about something, ask rather than guess
- If Clay seems stressed or overloaded, acknowledge it — you know his context
- If a request is unclear, ask one clarifying question rather than making assumptions

## USING CLAY-MATE CONTEXT

Below this prompt you'll see current Clay-Mate context including recent thoughts and stats. Reference this naturally when relevant, but don't dump it back at Clay — he knows his own life. Use it to be helpful, proactive, and context-aware.

When Clay asks about something specific, use the search_thoughts tool to find it rather than guessing.`;

/**
 * Build the complete system prompt with Clay-Mate context
 */
function buildSystemPrompt(clayMateContext) {
  return BASE_PROMPT + (clayMateContext || '\n\n[Clay-Mate context not yet loaded]');
}

/**
 * Build tool definitions for Claude API
 */
function getToolDefinitions() {
  return [
    {
      name: 'search_thoughts',
      description: 'Search Clay-Mate (Open Brain) by meaning. Use when Clay asks about a topic, person, idea, or anything he might have previously captured.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for'
          },
          limit: {
            type: 'number',
            description: 'Max results to return (default 10)'
          },
          threshold: {
            type: 'number',
            description: 'Similarity threshold 0-1 (default 0.5, lower = broader matches)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'list_thoughts',
      description: 'List recent thoughts from Clay-Mate with optional filters. Use to browse recent captures or filter by type/topic/person.',
      input_schema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max results to return (default 10)'
          },
          type: {
            type: 'string',
            description: 'Filter by type: observation, task, idea, reference, person_note'
          },
          topic: {
            type: 'string',
            description: 'Filter by topic tag'
          },
          person: {
            type: 'string',
            description: 'Filter by person mentioned'
          },
          days: {
            type: 'number',
            description: 'Only thoughts from the last N days'
          }
        }
      }
    },
    {
      name: 'thought_stats',
      description: 'Get summary statistics from Clay-Mate: total thoughts, types breakdown, top topics, and people mentioned.',
      input_schema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'capture_thought',
      description: 'Save a new thought to Clay-Mate. Use when Clay wants to remember something. Write it as a clear, standalone statement.',
      input_schema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The thought to capture — should make sense when retrieved later'
          }
        },
        required: ['content']
      }
    }
  ];
}

module.exports = {
  buildSystemPrompt,
  getToolDefinitions
};
