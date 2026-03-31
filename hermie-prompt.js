/**
 * Hermie System Prompt Builder
 * Constructs the system prompt with Clay-Mate context injected dynamically
 */

const BASE_PROMPT = `You are Hermie, Clay's personal life-ops agent. You live in Slack and have access to Clay-Mate, a comprehensive memory system that tracks his tasks, projects, thoughts, contacts, and life context.

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

You have access to Clay-Mate tools. Use them when helpful:

**Read operations (use freely):**
- Search across all of Clay-Mate with global_search
- List thoughts, action items, projects, people, agent state
- Get daily briefing

**Write operations (do when asked):**
- Add action items (tasks)
- Complete action items
- Update action items
- Add thoughts
- Add agent state (reminders, context notes)

**What you should NOT do without explicit confirmation:**
- Delete anything
- Bulk-modify multiple records at once

## HOW TO RESPOND

- Keep responses concise but complete
- Use Slack mrkdwn formatting where it helps (bold, bullets, etc.) but don't over-format
- When you take an action (add a task, complete something), confirm what you did
- When you're not sure about something, ask rather than guess
- If Clay seems stressed or overloaded, acknowledge it — you know his context
- If a request is unclear, ask one clarifying question rather than making assumptions

## USING CLAY-MATE CONTEXT

Below this prompt you'll see current Clay-Mate context including today's briefing, open tasks, active projects, and any pending reminders. Reference this naturally when relevant, but don't dump it back at Clay — he knows his own life. Use it to be helpful, proactive, and context-aware.

When Clay asks about something specific that might require a search (past thoughts, specific tasks, people, etc.), use the global_search tool to find it rather than guessing.`;

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
      name: 'global_search',
      description: 'Search across all of Clay-Mate (tasks, projects, thoughts, people, etc.) for specific information. Use when Clay asks about something that might be in his history.',
      input_schema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The search query'
          }
        },
        required: ['query']
      }
    },
    {
      name: 'add_action_item',
      description: 'Create a new task/action item in Clay-Mate',
      input_schema: {
        type: 'object',
        properties: {
          title: {
            type: 'string',
            description: 'Title of the task'
          },
          description: {
            type: 'string',
            description: 'Optional longer description'
          },
          domain: {
            type: 'string',
            description: 'Category/domain (e.g., "school", "credit_union", "dunker_spot", "family", "personal")'
          },
          due_date: {
            type: 'string',
            description: 'Due date in YYYY-MM-DD format'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'Priority level'
          }
        },
        required: ['title']
      }
    },
    {
      name: 'complete_action_item',
      description: 'Mark a task as completed',
      input_schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the action item to complete'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'update_action_item',
      description: 'Update an existing task',
      input_schema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'The ID of the action item to update'
          },
          title: {
            type: 'string',
            description: 'New title'
          },
          description: {
            type: 'string',
            description: 'New description'
          },
          domain: {
            type: 'string',
            description: 'New domain/category'
          },
          due_date: {
            type: 'string',
            description: 'New due date in YYYY-MM-DD format'
          },
          priority: {
            type: 'string',
            enum: ['low', 'medium', 'high'],
            description: 'New priority level'
          },
          status: {
            type: 'string',
            description: 'New status'
          }
        },
        required: ['id']
      }
    },
    {
      name: 'add_thought',
      description: 'Save a new thought or note to Clay-Mate',
      input_schema: {
        type: 'object',
        properties: {
          content: {
            type: 'string',
            description: 'The thought content'
          },
          tags: {
            type: 'array',
            items: { type: 'string' },
            description: 'Optional tags for categorization'
          }
        },
        required: ['content']
      }
    },
    {
      name: 'add_agent_state',
      description: 'Store a reminder or context note that Hermie should remember',
      input_schema: {
        type: 'object',
        properties: {
          key: {
            type: 'string',
            description: 'A short key/label for this state'
          },
          value: {
            type: 'string',
            description: 'The value/content to remember'
          },
          context: {
            type: 'string',
            description: 'Additional context about why this is being stored'
          },
          expires_at: {
            type: 'string',
            description: 'Optional expiration date in ISO format'
          }
        },
        required: ['key', 'value']
      }
    },
    {
      name: 'list_action_items',
      description: 'Get a list of tasks/action items. Use to see more tasks than what was loaded at session start.',
      input_schema: {
        type: 'object',
        properties: {
          status: {
            type: 'string',
            description: 'Filter by status (open, completed, all)'
          },
          domain: {
            type: 'string',
            description: 'Filter by domain/category'
          },
          overdue: {
            type: 'boolean',
            description: 'Only show overdue items'
          },
          limit: {
            type: 'number',
            description: 'Max number of results'
          }
        }
      }
    },
    {
      name: 'list_thoughts',
      description: 'Get recent thoughts/notes from Clay-Mate',
      input_schema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max number of results'
          }
        }
      }
    },
    {
      name: 'list_people',
      description: 'Get contacts/people from Clay-Mate',
      input_schema: {
        type: 'object',
        properties: {
          limit: {
            type: 'number',
            description: 'Max number of results'
          }
        }
      }
    }
  ];
}

module.exports = {
  buildSystemPrompt,
  getToolDefinitions
};
