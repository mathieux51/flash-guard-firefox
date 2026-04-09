/**
 * Flash Guard - Options Script
 * Handles advanced settings page
 */

const DEFAULT_SETTINGS = {
  enabled: true,
  backgroundColor: '#1a1a1a',
  transitionDuration: 200,
  detectThreshold: 240,
  excludedDomains: [],
  autoDisableOnDarkSites: true
};

document.addEventListener('DOMContentLoaded', async () => {
  const detectThreshold = document.getElementById('detectThreshold');
  const transitionDuration = document.getElementById('transitionDuration');
  const exportBtn = document.getElementById('exportSettings');
  const importBtn = document.getElementById('importSettings');
  const importFile = document.getElementById('importFile');
  const resetBtn = document.getElementById('resetSettings');
  const saveBtn = document.getElementById('saveSettings');
  const statusMessage = document.getElementById('statusMessage');

  // Load current settings
  async function loadSettings() {
    const settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
    detectThreshold.value = settings.detectThreshold;
    transitionDuration.value = settings.transitionDuration;
    return settings;
  }

  // Save settings
  async function saveSettings() {
    const settings = {
      detectThreshold: parseInt(detectThreshold.value, 10),
      transitionDuration: parseInt(transitionDuration.value, 10)
    };
    
    await browser.runtime.sendMessage({
      type: 'UPDATE_SETTINGS',
      settings: settings
    });

    showStatus('Settings saved successfully!', 'success');
  }

  // Show status message
  function showStatus(message, type) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${type}`;
    
    setTimeout(() => {
      statusMessage.className = 'status-message';
    }, 3000);
  }

  // Export settings
  async function exportSettingsToFile() {
    const settings = await browser.runtime.sendMessage({ type: 'GET_SETTINGS' });
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'flash-guard-settings.json';
    a.click();
    
    URL.revokeObjectURL(url);
    showStatus('Settings exported!', 'success');
  }

  // Import settings
  async function importSettingsFromFile(file) {
    try {
      const text = await file.text();
      const settings = JSON.parse(text);
      
      await browser.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: settings
      });
      
      await loadSettings();
      showStatus('Settings imported successfully!', 'success');
    } catch (e) {
      showStatus('Failed to import settings. Invalid file format.', 'error');
    }
  }

  // Reset settings
  async function resetToDefaults() {
    if (confirm('Are you sure you want to reset all settings to defaults?')) {
      await browser.runtime.sendMessage({
        type: 'UPDATE_SETTINGS',
        settings: DEFAULT_SETTINGS
      });
      
      await loadSettings();
      showStatus('Settings reset to defaults!', 'success');
    }
  }

  // Initialize
  await loadSettings();

  // Event listeners
  saveBtn.addEventListener('click', saveSettings);
  
  exportBtn.addEventListener('click', exportSettingsToFile);
  
  importBtn.addEventListener('click', () => importFile.click());
  
  importFile.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importSettingsFromFile(e.target.files[0]);
    }
  });
  
  resetBtn.addEventListener('click', resetToDefaults);
});
