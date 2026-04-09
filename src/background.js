/**
 * Flash Guard - Background Script
 * Manages extension state and settings
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  backgroundColor: '#1a1a1a',
  transitionDuration: 200,
  detectThreshold: 240, // RGB threshold for "white" detection (0-255)
  excludedDomains: [],
  autoDisableOnDarkSites: true
};

// Initialize settings on install
browser.runtime.onInstalled.addListener(async () => {
  const stored = await browser.storage.local.get('settings');
  if (!stored.settings) {
    await browser.storage.local.set({ settings: DEFAULT_SETTINGS });
  }
});

// Get current settings
async function getSettings() {
  const stored = await browser.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...stored.settings };
}

// Update settings
async function updateSettings(newSettings) {
  const current = await getSettings();
  const updated = { ...current, ...newSettings };
  await browser.storage.local.set({ settings: updated });
  return updated;
}

// Check if domain is excluded
function isDomainExcluded(url, excludedDomains) {
  try {
    const hostname = new URL(url).hostname;
    return excludedDomains.some(domain => {
      const pattern = domain.replace(/\*/g, '.*');
      return new RegExp(`^${pattern}$`, 'i').test(hostname);
    });
  } catch {
    return false;
  }
}

// Handle messages from content scripts and popup
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'UPDATE_SETTINGS':
      updateSettings(message.settings).then(sendResponse);
      return true;

    case 'CHECK_DOMAIN':
      getSettings().then(settings => {
        const excluded = isDomainExcluded(message.url, settings.excludedDomains);
        sendResponse({ excluded, settings });
      });
      return true;

    case 'TOGGLE_ENABLED':
      getSettings().then(settings => {
        const updated = { ...settings, enabled: !settings.enabled };
        updateSettings(updated).then(() => {
          updateBrowserActionIcon(updated.enabled);
          sendResponse(updated);
        });
      });
      return true;

    case 'ADD_EXCLUDED_DOMAIN':
      getSettings().then(settings => {
        if (!settings.excludedDomains.includes(message.domain)) {
          settings.excludedDomains.push(message.domain);
          updateSettings(settings).then(sendResponse);
        } else {
          sendResponse(settings);
        }
      });
      return true;

    case 'REMOVE_EXCLUDED_DOMAIN':
      getSettings().then(settings => {
        settings.excludedDomains = settings.excludedDomains.filter(
          d => d !== message.domain
        );
        updateSettings(settings).then(sendResponse);
      });
      return true;
  }
});

// Update browser action icon based on enabled state
function updateBrowserActionIcon(enabled) {
  const iconPath = enabled ? 'icons/icon' : 'icons/icon-disabled';
  browser.browserAction.setIcon({
    path: {
      48: `${iconPath}-48.png`,
      96: `${iconPath}-96.png`
    }
  });
}

// Initialize icon state
getSettings().then(settings => {
  updateBrowserActionIcon(settings.enabled);
});
