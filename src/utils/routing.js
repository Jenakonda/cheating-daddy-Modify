// Mixed mode: which provider handles which kind of request. No Electron imports, so it can be tested in Node.
// 'byok' is the name the app has always used for the API mode.

const ROUTE_TASKS = ['voice', 'screen', 'text'];
const ROUTE_PROVIDERS = ['byok', 'cli'];
const DEFAULT_MIXED_ROUTES = Object.freeze({ voice: 'byok', screen: 'cli', text: 'cli' });

function normalizeMixedRoutes(value) {
    const routes = {};
    for (const task of ROUTE_TASKS) {
        routes[task] = ROUTE_PROVIDERS.includes(value?.[task]) ? value[task] : DEFAULT_MIXED_ROUTES[task];
    }
    return routes;
}

/** The provider that serves a task: the mode itself, or the chosen route in mixed mode. */
function resolveProvider(mode, routes, task) {
    return mode === 'mixed' ? normalizeMixedRoutes(routes)[task] : mode;
}

/**
 * What a mixed session needs before it can start.
 * Voice over the API means Gemini Live, so it needs a Gemini key; other API tasks also work with Groq.
 */
function getMixedRequirements(routes) {
    const normalized = normalizeMixedRoutes(routes);
    return {
        cli: ROUTE_TASKS.some(task => normalized[task] === 'cli'),
        live: normalized.voice === 'byok',
        apiKey: ROUTE_TASKS.some(task => normalized[task] === 'byok'),
    };
}

module.exports = { ROUTE_TASKS, DEFAULT_MIXED_ROUTES, normalizeMixedRoutes, resolveProvider, getMixedRequirements };
