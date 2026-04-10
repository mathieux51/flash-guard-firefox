/**
 * Flash Guard - Content Script
 * Detects white backgrounds and applies dark overlay to prevent flash.
 *
 * KEY DESIGN: The overlay is injected SYNCHRONOUSLY at script load time
 * (before any async calls) to prevent the white flash. The async settings
 * check happens afterward and removes the overlay if not needed.
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__flashGuardInitialized) return;
  window.__flashGuardInitialized = true;

  const DEFAULT_BG = '#1a1a1a';
  let settings = null;
  let overlay = null;
  let isActive = false;

  // ---------------------------------------------------------------
  // STEP 1: Inject overlay SYNCHRONOUSLY before any async work.
  // document_start guarantees documentElement exists for content
  // scripts, so we can append directly.
  // ---------------------------------------------------------------
  overlay = document.createElement('div');
  overlay.id = 'flash-guard-overlay';
  overlay.style.cssText = [
    'position: fixed',
    'top: 0',
    'left: 0',
    'width: 100vw',
    'height: 100vh',
    'background-color: ' + DEFAULT_BG,
    'z-index: 2147483647',
    'pointer-events: none',
    'opacity: 1',
    'transition: none'
  ].map(s => s + ' !important').join('; ') + ';';

  document.documentElement.appendChild(overlay);
  isActive = true;

  // ---------------------------------------------------------------
  // Utility functions
  // ---------------------------------------------------------------

  // Remove overlay with optional fade.
  // IMPORTANT: CSS rules are disengaged FIRST (while the overlay is
  // still fully opaque and covering the viewport), so the page's real
  // background becomes active underneath. Then the overlay fades out
  // to reveal it smoothly. This guarantees zero leftover dark CSS
  // once the overlay is gone.
  function removeOverlay(duration) {
    if (!overlay || !isActive) {
      markReady();
      return;
    }

    // Disengage CSS dark-background rules while overlay still covers everything
    markReady();

    if (duration && duration > 0) {
      overlay.style.setProperty('transition', 'opacity ' + duration + 'ms ease-out', 'important');
      overlay.style.setProperty('opacity', '0', 'important');
      setTimeout(cleanup, duration);
    } else {
      cleanup();
    }
  }

  function cleanup() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    isActive = false;
  }

  function markReady() {
    if (document.documentElement) {
      document.documentElement.setAttribute('data-flash-guard-ready', '');
    }
  }

  // Parse color string to RGB values
  function parseColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return null;
    }

    var rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10)
      };
    }

    var hexMatch = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16)
      };
    }

    return null;
  }

  function isWhiteColor(color, threshold) {
    var rgb = parseColor(color);
    if (!rgb) return true; // transparent defaults to white in browsers
    return rgb.r >= threshold && rgb.g >= threshold && rgb.b >= threshold;
  }

  function isDarkColor(color, threshold) {
    var rgb = parseColor(color);
    if (!rgb) return false;
    return rgb.r <= threshold && rgb.g <= threshold && rgb.b <= threshold;
  }

  function detectPageBackground() {
    var html = document.documentElement;
    var body = document.body;
    var htmlBg = html ? window.getComputedStyle(html).backgroundColor : null;
    var bodyBg = body ? window.getComputedStyle(body).backgroundColor : null;
    return { html: htmlBg, body: bodyBg };
  }

  function shouldShowOverlay(threshold) {
    var bg = detectPageBackground();
    if (isDarkColor(bg.html, 50) || isDarkColor(bg.body, 50)) return false;
    if (isWhiteColor(bg.html, threshold) || isWhiteColor(bg.body, threshold)) return true;
    return true;
  }

  // ---------------------------------------------------------------
  // STEP 2: Async settings check. Adjusts or removes overlay based
  // on user preferences and domain exclusion list.
  // ---------------------------------------------------------------
  function initialize() {
    browser.runtime.sendMessage({
      type: 'CHECK_DOMAIN',
      url: window.location.href
    }).then(function(response) {
      if (!response || !response.settings.enabled || response.excluded) {
        // Extension disabled or domain excluded, remove overlay immediately
        removeOverlay(0);
        return;
      }

      settings = response.settings;

      // Update overlay color if user has a custom color
      if (overlay && settings.backgroundColor !== DEFAULT_BG) {
        overlay.style.setProperty('background-color', settings.backgroundColor, 'important');
      }

      // Start monitoring for page readiness
      waitForPageReady();

    }).catch(function() {
      // Extension context invalid, remove overlay
      removeOverlay(0);
    });
  }

  // Wait for page to be ready and check if overlay should be removed
  function waitForPageReady() {
    var checkInterval = setInterval(function() {
      if (settings && settings.autoDisableOnDarkSites) {
        if (!shouldShowOverlay(settings.detectThreshold)) {
          removeOverlay(settings.transitionDuration);
          clearInterval(checkInterval);
          return;
        }
      }
    }, 50);

    function onReady() {
      setTimeout(function() {
        clearInterval(checkInterval);
        handleDOMReady();
      }, 100);
    }

    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', onReady);
    } else {
      onReady();
    }

    // Fallback: remove after full page load
    window.addEventListener('load', function() {
      clearInterval(checkInterval);
      removeOverlay(settings ? settings.transitionDuration : 200);
    });

    // Safety timeout, never keep overlay more than 3 seconds
    setTimeout(function() {
      clearInterval(checkInterval);
      removeOverlay(settings ? settings.transitionDuration : 200);
    }, 3000);
  }

  function handleDOMReady() {
    if (!settings) {
      removeOverlay(200);
      return;
    }

    if (settings.autoDisableOnDarkSites && !shouldShowOverlay(settings.detectThreshold)) {
      removeOverlay(settings.transitionDuration / 2);
    } else {
      removeOverlay(settings.transitionDuration);
    }
  }

  // ---------------------------------------------------------------
  // STEP 3: Kick off the async check. The overlay is already visible
  // so there is no flash regardless of how long this takes.
  // ---------------------------------------------------------------
  initialize();

})();
