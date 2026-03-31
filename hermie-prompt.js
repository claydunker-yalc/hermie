/**
 * Hermie System Prompt Builder
 * Constructs the system prompt with Clay-Mate context injected dynamically
 */

const BASE_PROMPT = `You are Hermie, Clay's personal life-ops agent. You live in Slack and have access to Clay-Mate (his Open Brain), a personal knowledge system that stores his thoughts, notes, and tasks.

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

You have access to Clay-Mate tools:

**Action Items (Tasks):**
- list_action_items — See open action items (loaded automatically at session start)
- add_action_item — Create a new action item
- complete_action_item — Mark an action item as done (requires action_item_id)
- update_action_item — Update an action item's fields

**Thought Capture:**
- search_thoughts — Semantic search across all captured thoughts
- list_thoughts — Browse recent thoughts with optional filters
- thought_stats — Get summary stats
- capture_thought — Save a new thought

## CRITICAL: ALWAYS USE THE ACTUAL TOOLS

**NEVER claim to have done something without actually calling a tool.** If you say you completed an action item, you MUST have called complete_action_item. If you say you added one, you MUST have called add_action_item.

When completing action items:
1. First use list_action_items to find the action_item_id
2. Then call complete_action_item with that ID
3. Only confirm completion AFTER the tool returns success

If a tool fails, tell Clay honestly. Don't pretend it worked.

## HOW TO RESPOND

- Keep responses concise but complete
- Use Slack mrkdwn formatting where it helps (bold, bullets, etc.) but don't over-format
- When you complete or add a task, confirm what the tool returned
- When you're not sure about something, ask rather than guess
- Reference the action items from context naturally — you don't need to re-fetch every time

## USING CLAY-MATE CONTEXT

Below this prompt you'll see current Clay-Mate context including open tasks and recent thoughts. This is loaded fresh at the start of each session and after any writes. Use it to be helpful and context-aware.`;

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
    // Action Item tools
    {
      name: 'list_action_items',
      description: 'List action items from Clay-Mate with optional filters. Usually already loaded in context, but use this to refresh or filter differently.',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            enum: ['open', 'completed', 'all'],
            description: 'Filter by status (default: open)'
          },
          domain: {
            type: 'string',
            description: 'Filter by domain (personal, work, dunker_spot, credit_union, family)'
          },
          limit: {
            type: 'number',
            description: 'Max results (default: 20)'
          },
          include_overdue: {
            type: 'boolean',
            description: 'Include overdue items flag (default: true)'
          }
        }
      }
    },
    {
      name: 'add_action_item',
      description: 'Create a new action item in Clay-Mate.',
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Short title for the action item'
          },
          domain: {
            type: 'string',
            description: 'Category: personal, work, dunker_spot, credit_union, family'
          },
          due_date: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format'
          },
          linked_project_id: {
            type: 'string',
            description: 'Optional project UUID to link to'
          },
          linked_person_id: {
            type: 'string',
            description: 'Optional person UUID to link to'
          },
          source: {
            type: 'string',
            description: 'Where this came from (e.g., hermie, manual)'
          }
        },
        required: ['title']
      }
    },
    {
      name: 'complete_action_item',
      description: 'Mark an action item as completed. Requires the id (can use partial ID like first 8 characters).',
      input_schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The action item ID (full UUID or partial like first 8 chars)'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'update_action_item',
      description: 'Update fields on an existing action item.',
      input_schema: {
        type: 'object',
        properties: {
          action_item_id: {
            type: 'string',
            description: 'The action item ID (full UUID or partial like first 8 chars)'
          },
          title: {
            type: 'string',
            description: 'New title'
          },
          domain: {
            type: 'string',
            description: 'New domain'
          },
          due_date: {
            type: 'string',
            description: 'New due date (YYYY-MM-DD)'
          },
          status: {
            type: 'string',
            enum: ['open', 'completed'],
            description: 'New status'
          }
        },
        required: ['action_item_id']
      }
    },
    // Thought tools
    {
      name: 'search_thoughts',
      description: 'Search Clay-Mate thoughts by meaning. Use when Clay asks about something he may have captured.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'What to search for'
          },
          limit: {
            type: 'number',
            description: 'Max results (default 10)'
          },
          threshold: {
            type: 'number',
            description: 'Similarity threshold 0-1 (default 0.5, lower = broader)'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'list_thoughts',
      description: 'List recent thoughts with optional filters.',
      input_schema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max results (default 10)'
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
            description: 'Only thoughts from last N days'
          }
        }
      }
    },
    {
      name: 'thought_stats',
      description: 'Get summary statistics from Clay-Mate.',
      input_schema: {
        type: 'object',
        properties: {}
      }
    },
    {
      name: 'capture_thought',
      description: 'Save a new thought to Clay-Mate.',
      input_schema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The thought to capture'
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
