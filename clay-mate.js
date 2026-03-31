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

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/event-stream'
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args
        },
        id: Date.now()
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Clay-Mate MCP error (${toolName}):`, response.status, errorText);
      return { error: `MCP call failed: ${response.status}`, data: null };
    }

    // Parse SSE response
    const text = await response.text();
    const lines = text.split('\n');

    for (const line of lines) {
      if (line.startsWith('data: ')) {
        const jsonStr = line.slice(6);
        try {
          const parsed = JSON.parse(jsonStr);
          if (parsed.result) {
            // Extract text content from MCP response
            if (parsed.result.content && Array.isArray(parsed.result.content)) {
              const textContent = parsed.result.content
                .filter(c => c.type === 'text')
                .map(c => c.text)
                .join('\n');
              return { error: null, data: textContent };
            }
            return { error: null, data: parsed.result };
          }
          if (parsed.error) {
            return { error: parsed.error.message, data: null };
          }
        } catch (e) {
          // Continue to next line
        }
      }
    }

    return { error: 'No valid response from MCP', data: null };
  } catch (err) {
    console.error(`Clay-Mate MCP exception (${toolName}):`, err.message);
    return { error: err.message, data: null };
  }
}

// ============ AVAILABLE TOOLS ============

async function searchThoughts(query, limit = 10, threshold = 0.5) {
  return mcpCall('search_thoughts', { query, limit, threshold });
}

async function listThoughts(options = {}) {
  // options: { limit, type, topic, person, days }
  return mcpCall('list_thoughts', options);
}

async function thoughtStats() {
  return mcpCall('thought_stats', {});
}

async function verifyConnection() {
  return mcpCall('verify_connection', {});
}

async function captureThought(content) {
  return mcpCall('capture_thought', { content });
}

// ============ BOOT CONTEXT ============

/**
 * Load session boot context from Clay-Mate
 * Gets recent thoughts and stats to give Hermie context
 */
async function loadBootContext() {
  const results = await Promise.all([
    listThoughts({ limit: 15, days: 7 }),
    thoughtStats()
  ]);

  const [recentThoughts, stats] = results;

  return {
    recentThoughts: recentThoughts.data,
    stats: stats.data,
    errors: results.filter(r => r.error).map(r => r.error)
  };
}

module.exports = {
  searchThoughts,
  listThoughts,
  thoughtStats,
  verifyConnection,
  captureThought,
  loadBootContext,
  mcpCall
};
