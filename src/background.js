/**
 * Flash Guard - Background Script
 * Manages extension state, settings, and early CSS injection.
 *
 * The stream filter (filterResponseData) injects a dark-background
 * <style> tag directly into HTML response bodies. This is the ONLY
 * mechanism that runs before Firefox's first paint. Content scripts,
 * even at document_start, execute after the browser has already
 * painted at least one blank (white) frame.
 */

var DEFAULT_SETTINGS = {
  enabled: true,
  backgroundColor: '#1a1a1a',
  transitionDuration: 200,
  detectThreshold: 240,
  excludedDomains: [],
  autoDisableOnDarkSites: true
};

// -------------------------------------------------------------------
// Settings cache — kept in memory so the stream filter can check
// enabled/excluded status synchronously (no async storage reads).
// -------------------------------------------------------------------
var cachedSettings = Object.assign({}, DEFAULT_SETTINGS);

function refreshCache() {
  browser.storage.local.get('settings').then(function(stored) {
    if (stored.settings) {
      cachedSettings = Object.assign({}, DEFAULT_SETTINGS, stored.settings);
    }
  });
}

browser.storage.onChanged.addListener(function(changes) {
  if (changes.settings) {
    cachedSettings = Object.assign(
      {}, DEFAULT_SETTINGS, changes.settings.newValue
    );
    // Update color scheme override when enabled state changes
    applyColorSchemeOverride(cachedSettings.enabled);
  }
});

refreshCache();

// -------------------------------------------------------------------
// browserSettings — best-effort content color scheme override
//
// Setting overrideContentColorScheme to "dark" tells Firefox to
// report prefers-color-scheme: dark to all web pages. Pages that
// respect this media query will load their dark variant, reducing
// the white flash. This does NOT change browser.display.background_color
// (the canvas color painted before any HTTP response arrives).
// -------------------------------------------------------------------

function applyColorSchemeOverride(enabled) {
  if (typeof browser.browserSettings !== 'undefined' &&
      browser.browserSettings.overrideContentColorScheme) {
    browser.browserSettings.overrideContentColorScheme
      .set({ value: enabled ? 'dark' : 'auto' })
      .catch(function() { /* permission may be missing or API unavailable */ });
  }
}

applyColorSchemeOverride(cachedSettings.enabled);

// -------------------------------------------------------------------
// Settings CRUD (async, reads from storage)
// -------------------------------------------------------------------

browser.runtime.onInstalled.addListener(function() {
  browser.storage.local.get('settings').then(function(stored) {
    if (!stored.settings) {
      browser.storage.local.set({ settings: DEFAULT_SETTINGS });
    }
  });
  // Apply color scheme override on install
  applyColorSchemeOverride(true);
});

function getSettings() {
  return browser.storage.local.get('settings').then(function(stored) {
    return Object.assign({}, DEFAULT_SETTINGS, stored.settings);
  });
}

function updateSettings(newSettings) {
  return getSettings().then(function(current) {
    var updated = Object.assign({}, current, newSettings);
    return browser.storage.local.set({ settings: updated }).then(function() {
      return updated;
    });
  });
}

// -------------------------------------------------------------------
// Domain exclusion
// -------------------------------------------------------------------

function isDomainExcluded(url, excludedDomains) {
  try {
    var hostname = new URL(url).hostname;
    return excludedDomains.some(function(domain) {
      var pattern = domain.replace(/\*/g, '.*');
      return new RegExp('^' + pattern + '$', 'i').test(hostname);
    });
  } catch (e) {
    return false;
  }
}

// -------------------------------------------------------------------
// Stream filter — inject dark CSS into HTML responses
//
// filterResponseData intercepts the raw HTTP response body before
// Firefox hands it to the HTML parser. We search the first chunk
// for <head or <html and inject a <style> block right after the
// opening tag. Because the CSS is part of the actual HTML, it is
// applied during parsing — before the first paint.
//
// The injected rule uses :not([data-flash-guard-ready]) so the
// content script can disable it later by setting the attribute.
// -------------------------------------------------------------------

var EARLY_CSS_PREFIX = '<meta id="fg-color-scheme" name="color-scheme" content="dark">' +
  '<style id="fg-early">' +
  'html:not([data-flash-guard-ready]),' +
  'html:not([data-flash-guard-ready])>body' +
  '{color-scheme:dark!important;background:';
var EARLY_CSS_SUFFIX = '!important}' +
  '</style>';

function getEarlyCssBytes() {
  var color = cachedSettings.backgroundColor || '#1a1a1a';
  var css = EARLY_CSS_PREFIX + color + EARLY_CSS_SUFFIX;
  return new TextEncoder().encode(css);
}

browser.webRequest.onHeadersReceived.addListener(
  function(details) {
    // Only process HTML responses
    if (!isHtmlResponse(details)) return;

    // Skip if disabled or domain excluded (synchronous check)
    if (!cachedSettings.enabled) return;
    if (isDomainExcluded(details.url, cachedSettings.excludedDomains)) return;

    var filter = browser.webRequest.filterResponseData(details.requestId);
    var injected = false;
    var earlyCssBytes = getEarlyCssBytes();

    filter.ondata = function(event) {
      if (!injected) {
        injected = true;
        var bytes = new Uint8Array(event.data);
        var pos = findInjectionPoint(bytes);

        if (pos !== -1) {
          filter.write(event.data.slice(0, pos));
          filter.write(earlyCssBytes.buffer);
          filter.write(event.data.slice(pos));
          return;
        }
        // Fallback: prepend CSS to the start of the response.
        // The browser parser will move the <style> into <head>.
        filter.write(earlyCssBytes.buffer);
      }
      filter.write(event.data);
    };

    filter.onstop = function() {
      filter.close();
    };

    filter.onerror = function() {
      try { filter.disconnect(); } catch (e) { /* ignore */ }
    };
  },
  { urls: ['http://*/*', 'https://*/*'], types: ['main_frame', 'sub_frame'] },
  ['blocking', 'responseHeaders']
);

function isHtmlResponse(details) {
  if (!details.responseHeaders) return false;
  for (var i = 0; i < details.responseHeaders.length; i++) {
    if (details.responseHeaders[i].name.toLowerCase() === 'content-type') {
      return details.responseHeaders[i].value.toLowerCase().indexOf('text/html') !== -1;
    }
  }
  return false;
}

/**
 * Search the first 4 KB of raw bytes for <head...> or <html...> and
 * return the byte offset just after the closing >. Returns -1 if not
 * found. Pattern matching is case-insensitive but operates on raw
 * bytes (HTML tags are guaranteed ASCII).
 */
function findInjectionPoint(bytes) {
  var limit = Math.min(bytes.length, 4096);
  var pos = findTagClose(bytes, limit, 'head');
  if (pos !== -1) return pos;
  return findTagClose(bytes, limit, 'html');
}

function findTagClose(bytes, limit, tag) {
  for (var i = 0; i <= limit - tag.length - 1; i++) {
    if (bytes[i] !== 60) continue; // 60 = '<'
    var match = true;
    for (var j = 0; j < tag.length; j++) {
      var b = bytes[i + 1 + j];
      var lower = tag.charCodeAt(j);       // e.g. 104 for 'h'
      var upper = lower - 32;              // e.g.  72 for 'H'
      if (b !== lower && b !== upper) { match = false; break; }
    }
    if (!match) continue;
    // Found the tag name — advance past the closing >
    for (var k = i + 1 + tag.length; k < bytes.length; k++) {
      if (bytes[k] === 62) return k + 1; // 62 = '>'
    }
  }
  return -1;
}

// -------------------------------------------------------------------
// Message handling (content scripts, popup, options)
// -------------------------------------------------------------------

browser.runtime.onMessage.addListener(function(message, sender, sendResponse) {
  switch (message.type) {
    case 'GET_SETTINGS':
      getSettings().then(sendResponse);
      return true;

    case 'UPDATE_SETTINGS':
      updateSettings(message.settings).then(sendResponse);
      return true;

    case 'CHECK_DOMAIN':
      getSettings().then(function(settings) {
        var excluded = isDomainExcluded(message.url, settings.excludedDomains);
        sendResponse({ excluded: excluded, settings: settings });
      });
      return true;

    case 'TOGGLE_ENABLED':
      getSettings().then(function(settings) {
        var updated = Object.assign({}, settings, { enabled: !settings.enabled });
        updateSettings(updated).then(function() {
          updateBrowserActionIcon(updated.enabled);
          applyColorSchemeOverride(updated.enabled);
          sendResponse(updated);
        });
      });
      return true;

    case 'ADD_EXCLUDED_DOMAIN':
      getSettings().then(function(settings) {
        if (settings.excludedDomains.indexOf(message.domain) === -1) {
          settings.excludedDomains.push(message.domain);
          updateSettings(settings).then(sendResponse);
        } else {
          sendResponse(settings);
        }
      });
      return true;

    case 'REMOVE_EXCLUDED_DOMAIN':
      getSettings().then(function(settings) {
        settings.excludedDomains = settings.excludedDomains.filter(function(d) {
          return d !== message.domain;
        });
        updateSettings(settings).then(sendResponse);
      });
      return true;
  }
});

// -------------------------------------------------------------------
// Browser action icon
// -------------------------------------------------------------------

function updateBrowserActionIcon(enabled) {
  var iconPath = enabled ? 'icons/icon' : 'icons/icon-disabled';
  browser.browserAction.setIcon({
    path: {
      48: iconPath + '-48.png',
      96: iconPath + '-96.png'
    }
  });
}

getSettings().then(function(settings) {
  updateBrowserActionIcon(settings.enabled);
});
