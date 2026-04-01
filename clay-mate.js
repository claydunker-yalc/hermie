/**
 * Clay-Mate MCP Client
 * Wraps all Clay-Mate MCP calls using proper MCP HTTP transport
 */

const MCP_URL = process.env.CLAY_MATE_MCP_URL;
const MCP_KEY = process.env.CLAY_MATE_MCP_KEY;

/**
 * Make an MCP JSON-RPC call to Clay-Mate
 */
async function mcpCall(toolName, args = {}) {
  try {
    // Build URL with key parameter
    const url = `${MCP_URL}?key=${MCP_KEY}`;

    const requestBody = {
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: toolName,
        arguments: args
      },
      id: Date.now()
    };

    console.log(`[MCP REQUEST] ${toolName}:`, JSON.stringify(requestBody, null, 2));

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[MCP HTTP ERROR] ${toolName}: status=${response.status}`, errorText);
      return { error: `MCP call failed: ${response.status}`, data: null };
    }

    // Parse SSE response
    const text = await response.text();
    console.log(`[MCP RAW RESPONSE] ${toolName}:`, text);

    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          console.log(`[MCP PARSED] ${toolName}:`, JSON.stringify(parsed, null, 2));

          if (parsed.result) {
            // Check if result has isError flag
            if (parsed.result.isError) {
              const errorText = parsed.result.content
                ?.filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('\n') || 'Unknown error';
              console.error(`[MCP TOOL ERROR] ${toolName}:`, errorText);
              return { error: errorText, data: null };
            }

            // Extract text content from MCP response
            if (parsed.result.content && Array.isArray(parsed.result.content)) {
              const textContent = parsed.result.content
                .filter((c: any) => c.type === 'text')
                .map((c: any) => c.text)
                .join('\n');
              return { error: null, data: textContent };
            }
            return { error: null, data: parsed.result };
          }
          if (parsed.error) {
            console.error(`[MCP JSON-RPC ERROR] ${toolName}:`, parsed.error);
            return { error: parsed.error.message, data: null };
          }
        } catch (e) {
          // Continue to next line
        }
      }
    }

    console.error(`[MCP NO VALID RESPONSE] ${toolName}: Could not parse response`);
    return { error: 'No valid response from MCP', data: null };
  } catch (err) {
    console.error(`[MCP EXCEPTION] ${toolName}:`, err.message);
    return { error: err.message, data: null };
  }
}

// ============ THOUGHT TOOLS ============

async function searchThoughts(query, limit = 10, threshold = 0.5) {
  return mcpCall('search_thoughts', { query, limit, threshold });
}

async function listThoughts(options = {}) {
  return mcpCall('list_thoughts', options);
}

async function thoughtStats() {
  return mcpCall('thought_stats', {});
}

async function captureThought(content) {
  return mcpCall('capture_thought', { content });
}

// ============ ACTION ITEM TOOLS ============

async function listActionItems(options = {}) {
  // options: { status, domain, limit, include_overdue }
  return mcpCall('list_action_items', options);
}

async function addActionItem(params) {
  // params: { title, domain, due_date, linked_project_id, linked_person_id, source }
  return mcpCall('add_action_item', params);
}

async function completeActionItem(actionItemId) {
  return mcpCall('complete_action_item', { id: actionItemId });
}

async function updateActionItem(actionItemId, updates) {
  return mcpCall('update_action_item', { action_item_id: actionItemId, ...updates });
}

// ============ BOOT CONTEXT ============

/**
 * Load session boot context from Clay-Mate
 * Gets open tasks, recent thoughts, and stats
 */
async function loadBootContext() {
  const results = await Promise.all([
    listActionItems({ status: 'open', limit: 20, include_overdue: true }),
    listThoughts({ limit: 10, days: 7 }),
    thoughtStats()
  ]);

  const [openActionItems, recentThoughts, stats] = results;

  return {
    openActionItems: openActionItems.data,
    recentThoughts: recentThoughts.data,
    stats: stats.data,
    errors: results.filter(r => r.error).map(r => r.error)
  };
}

module.exports = {
  // Thoughts
  searchThoughts,
  listThoughts,
  thoughtStats,
  captureThought,
  // Action Items
  listActionItems,
  addActionItem,
  completeActionItem,
  updateActionItem,
  // Boot
  loadBootContext,
  mcpCall
};
