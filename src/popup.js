/**
 * Flash Guard - Popup Script
 * Handles popup UI interactions
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Get DOM elements
  const enableToggle = document.getElementById('enableToggle');
  const backgroundColor = document.getElementById('backgroundColor');
  const backgroundColorText = document.getElementById('backgroundColorText');
  const transitionDuration = document.getElementById('transitionDuration');
  const transitionValue = document.getElementById('transitionValue');
  const autoDisable = document.getElementById('autoDisable');
  const newDomain = document.getElementById('newDomain');
  const addDomain = document.getElementById('addDomain');
  const excludedList = document.getElementById('excludedList');
  const excludeCurrent = document.getElementById('excludeCurrent');
  const openOptions = document.getElementById('openOptions');

  let currentTabDomain = '';

  // Load current settings
  async function loadSettings() {
    const settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
    
    enableToggle.checked = settings.enabled;
    backgroundColor.value = settings.backgroundColor;
    backgroundColorText.value = settings.backgroundColor;
    transitionDuration.value = settings.transitionDuration;
    transitionValue.textContent = `${settings.transitionDuration}ms`;
    autoDisable.checked = settings.autoDisableOnDarkSites;

    renderExcludedDomains(settings.excludedDomains);

    return settings;
  }

  // Save settings
  async function saveSettings(updates) {
    return browser.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: updates
    });
  }

  // Render excluded domains list
  function renderExcludedDomains(domains) {
    while (excludedList.firstChild) {
      excludedList.removeChild(excludedList.firstChild);
    }

    if (domains.length === 0) {
      const li = document.createElement('li');
      li.className = 'empty-message';
      li.textContent = 'No excluded domains';
      excludedList.appendChild(li);
      return;
    }

    domains.forEach(domain => {
      const li = document.createElement('li');

      const span = document.createElement('span');
      span.className = 'domain-text';
      span.textContent = domain;
      li.appendChild(span);

      const btn = document.createElement('button');
      btn.className = 'btn-remove';
      btn.dataset.domain = domain;
      btn.textContent = 'x';
      li.appendChild(btn);

      excludedList.appendChild(li);
    });
  }

  // Get current tab domain
  async function getCurrentTabDomain() {
    try {
      const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const url = new URL(tab.url);
        return url.hostname;
      }
    } catch (e) {
      console.error('Failed to get current tab:', e);
    }
    return '';
  }

  // Initialize
  const settings = await loadSettings();
  currentTabDomain = await getCurrentTabDomain();

  if (currentTabDomain) {
    excludeCurrent.textContent = `Exclude ${currentTabDomain}`;
    excludeCurrent.disabled = settings.excludedDomains.includes(currentTabDomain);
  } else {
    excludeCurrent.disabled = true;
    excludeCurrent.textContent = 'Cannot exclude this page';
  }

  // Event Listeners
  enableToggle.addEventListener('change', async () => {
    await browser.runtime.sendMessage({ type: 'TOGGLE_ENABLED' });
  });

  backgroundColor.addEventListener('input', async (e) => {
    backgroundColorText.value = e.target.value;
    await saveSettings({ backgroundColor: e.target.value });
  });

  backgroundColorText.addEventListener('change', async (e) => {
    const color = e.target.value;
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      backgroundColor.value = color;
      await saveSettings({ backgroundColor: color });
    } else {
      e.target.value = backgroundColor.value;
    }
  });

  transitionDuration.addEventListener('input', async (e) => {
    const value = parseInt(e.target.value, 10);
    transitionValue.textContent = `${value}ms`;
    await saveSettings({ transitionDuration: value });
  });

  autoDisable.addEventListener('change', async (e) => {
    await saveSettings({ autoDisableOnDarkSites: e.target.checked });
  });

  addDomain.addEventListener('click', async () => {
    const domain = newDomain.value.trim().toLowerCase();
    if (domain) {
      const updated = await browser.runtime.sendMessage({
        type: 'ADD_EXCLUDED_DOMAIN',
        domain: domain
      });
      renderExcludedDomains(updated.excludedDomains);
      newDomain.value = '';
      
      if (domain === currentTabDomain) {
        excludeCurrent.disabled = true;
      }
    }
  });

  newDomain.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addDomain.click();
    }
  });

  excludedList.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-remove')) {
      const domain = e.target.dataset.domain;
      const updated = await browser.runtime.sendMessage({
        type: 'REMOVE_EXCLUDED_DOMAIN',
        domain: domain
      });
      renderExcludedDomains(updated.excludedDomains);
      
      if (domain === currentTabDomain) {
        excludeCurrent.disabled = false;
      }
    }
  });

  excludeCurrent.addEventListener('click', async () => {
    if (currentTabDomain) {
      const updated = await browser.runtime.sendMessage({
        type: 'ADD_EXCLUDED_DOMAIN',
        domain: currentTabDomain
      });
      renderExcludedDomains(updated.excludedDomains);
      excludeCurrent.disabled = true;
    }
  });

  openOptions.addEventListener('click', (e) => {
    e.preventDefault();
    browser.runtime.openOptionsPage();
  });
});
