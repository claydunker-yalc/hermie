/**
 * Clay-Mate MCP Client
 * Wraps all Clay-Mate MCP calls as clean async functions
 */

const MCP_URL = process.env.CLAY_MATE_MCP_URL;
const MCP_KEY = process.env.CLAY_MATE_MCP_KEY;

/**
 * Make a request to the Clay-Mate MCP server
 */
async function mcpCall(toolName, args = {}) {
  try {
    const response = await fetch(MCP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'key': MCP_KEY
      },
      body: JSON.stringify({
        tool: toolName,
        args: args
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Clay-Mate MCP error (${toolName}):`, response.status, errorText);
      return { error: `MCP call failed: ${response.status}`, data: null };
    }

    const data = await response.json();
    return { error: null, data };
  } catch (err) {
    console.error(`Clay-Mate MCP exception (${toolName}):`, err.message);
    return { error: err.message, data: null };
  }
}

// ============ READ OPERATIONS ============

async function getDailyBriefing() {
  return mcpCall('get_daily_briefing');
}

async function listActionItems(options = {}) {
  // options: { status, domain, overdue, limit }
  return mcpCall('list_action_items', options);
}

async function listProjects(options = {}) {
  // options: { status, limit }
  return mcpCall('list_projects', options);
}

async function listAgentState(options = {}) {
  // options: { limit }
  return mcpCall('list_agent_state', options);
}

async function listThoughts(options = {}) {
  // options: { limit }
  return mcpCall('list_thoughts', options);
}

async function listPeople(options = {}) {
  // options: { limit }
  return mcpCall('list_people', options);
}

async function globalSearch(query) {
  return mcpCall('global_search', { query });
}

// ============ WRITE OPERATIONS ============

async function addActionItem(params) {
  // params: { title, description, domain, due_date, priority }
  return mcpCall('add_action_item', params);
}

async function completeActionItem(id) {
  return mcpCall('complete_action_item', { id });
}

async function updateActionItem(id, updates) {
  // updates: { title, description, domain, due_date, priority, status }
  return mcpCall('update_action_item', { id, ...updates });
}

async function addAgentState(params) {
  // params: { key, value, context, expires_at }
  return mcpCall('add_agent_state', params);
}

async function addThought(params) {
  // params: { content, tags }
  return mcpCall('add_thought', params);
}

// ============ BOOT CONTEXT ============

/**
 * Load full session boot context from Clay-Mate
 * Called on first message after 2+ hour gap
 */
async function loadBootContext() {
  const results = await Promise.all([
    getDailyBriefing(),
    listActionItems({ status: 'open', limit: 20 }),
    listProjects({ status: 'active' }),
    listAgentState({ limit: 10 })
  ]);

  const [briefing, tasks, projects, agentState] = results;

  return {
    briefing: briefing.data,
    tasks: tasks.data,
    projects: projects.data,
    agentState: agentState.data,
    errors: results.filter(r => r.error).map(r => r.error)
  };
}

module.exports = {
  // Read
  getDailyBriefing,
  listActionItems,
  listProjects,
  listAgentState,
  listThoughts,
  listPeople,
  globalSearch,
  // Write
  addActionItem,
  completeActionItem,
  updateActionItem,
  addAgentState,
  addThought,
  // Boot
  loadBootContext
};
