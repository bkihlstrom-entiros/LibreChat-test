const { logger } = require('@librechat/data-schemas');
const { SystemRoles } = require('librechat-data-provider');
const { getAppConfig } = require('~/server/services/Config');

const CACHE_TTL_MS = 60 * 1000;

let bypassAuthState = {
  value: null,
  lastChecked: 0,
};

async function loadBypassAuthState() {
  try {
    const appConfig = await getAppConfig();
    const enabled = appConfig?.interfaceConfig?.bypassAuth === true;

    bypassAuthState = {
      value: enabled,
      lastChecked: Date.now(),
    };

    return enabled;
  } catch (error) {
    logger.error('[bypassAuth] Failed to load bypass auth state', error);
    return bypassAuthState.value ?? false;
  }
}

async function shouldBypassAuth(force = false) {
  if (!force) {
    const { value, lastChecked } = bypassAuthState;
    const isFresh = Date.now() - lastChecked < CACHE_TTL_MS;
    if (value != null && isFresh) {
      return value;
    }
  }

  return loadBypassAuthState();
}

function createGuestUser() {
  const timestamp = new Date(0).toISOString();
  return {
    id: 'guest',
    _id: 'guest',
    username: 'Guest',
    name: 'Guest User',
    email: 'guest@librechat.local',
    provider: 'bypass',
    role: SystemRoles.USER,
    plugins: [],
    createdAt: timestamp,
    updatedAt: timestamp,
    isGuest: true,
    isBypassAuth: true,
  };
}

function getCachedBypassAuthState() {
  return bypassAuthState.value === true;
}

function clearBypassAuthCache() {
  bypassAuthState = {
    value: null,
    lastChecked: 0,
  };
}

module.exports = {
  shouldBypassAuth,
  createGuestUser,
  getCachedBypassAuthState,
  clearBypassAuthCache,
};
