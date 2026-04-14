/**
 * Flash Guard - Content Script
 * Detects white backgrounds and applies dark overlay to prevent flash.
 *
 * KEY DESIGN: The overlay AND an inline <style> are injected SYNCHRONOUSLY
 * at script load time (before any async calls). The async settings check
 * happens afterward and removes the overlay if not needed.
 */

(function() {
  'use strict';

  if (window.__flashGuardInitialized) return;
  window.__flashGuardInitialized = true;

  var DEFAULT_BG = '#1a1a1a';
  var settings = null;
  var overlay = null;
  var isActive = false;
  var settled = false; // true once we have decided to remove the overlay

  // ---------------------------------------------------------------
  // STEP 1 — Synchronous protection (runs before any async work).
  //
  // a) Inject an inline <style> that darkens html + body. This is a
  //    belt-and-suspenders layer on top of the CSS file declared in
  //    the manifest — the inline style is guaranteed to exist the
  //    moment this script executes.
  // b) Inject a full-viewport overlay div on top of everything.
  // ---------------------------------------------------------------
  var earlyStyle = document.createElement('style');
  earlyStyle.textContent =
    'html:not([data-flash-guard-ready]),' +
    'html:not([data-flash-guard-ready])>body' +
    '{color-scheme:dark!important;background-color:' + DEFAULT_BG + '!important}';
  document.documentElement.appendChild(earlyStyle);

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
  ].map(function(s) { return s + ' !important'; }).join('; ') + ';';

  document.documentElement.appendChild(overlay);
  isActive = true;

  // ---------------------------------------------------------------
  // Utility helpers
  // ---------------------------------------------------------------

  /** Disengage all injected CSS (stream-filter style, meta tag, inline style, file rule). */
  function markReady() {
    if (document.documentElement) {
      document.documentElement.setAttribute('data-flash-guard-ready', '');
    }
    // Remove stream-filter injected style (from background.js)
    var fgEarly = document.getElementById('fg-early');
    if (fgEarly && fgEarly.parentNode) {
      fgEarly.parentNode.removeChild(fgEarly);
    }
    // Remove stream-filter injected meta tag (from background.js)
    var fgMeta = document.getElementById('fg-color-scheme');
    if (fgMeta && fgMeta.parentNode) {
      fgMeta.parentNode.removeChild(fgMeta);
    }
    // Remove content-script injected style
    if (earlyStyle && earlyStyle.parentNode) {
      earlyStyle.parentNode.removeChild(earlyStyle);
      earlyStyle = null;
    }
  }

  /** Fade and remove the overlay div. Assumes CSS is already disengaged. */
  function fadeOverlay(duration) {
    if (!overlay || !isActive) return;

    if (duration && duration > 0) {
      // Use transitionend to remove the overlay only after the CSS
      // transition has fully completed. A setTimeout fallback guards
      // against the event never firing (e.g. if the element is
      // detached or the property is already at the target value).
      var removed = false;
      function onDone() {
        if (removed) return;
        removed = true;
        cleanup();
      }
      overlay.addEventListener('transitionend', onDone, { once: true });
      setTimeout(onDone, duration + 50);

      overlay.style.setProperty('transition', 'opacity ' + duration + 'ms cubic-bezier(0.4, 0, 0.2, 1)', 'important');
      overlay.style.setProperty('opacity', '0', 'important');
    } else {
      cleanup();
    }
  }

  /** Full removal: disengage CSS then fade overlay. */
  function removeOverlay(duration) {
    if (settled) return;
    settled = true;
    markReady();
    fadeOverlay(duration);
  }

  function cleanup() {
    if (overlay && overlay.parentNode) {
      overlay.parentNode.removeChild(overlay);
    }
    isActive = false;
  }

  // ---------------------------------------------------------------
  // Background detection helpers
  // ---------------------------------------------------------------

  function parseColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return null;
    }
    var m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (m) return { r: +m[1], g: +m[2], b: +m[3] };
    var h = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (h) return { r: parseInt(h[1], 16), g: parseInt(h[2], 16), b: parseInt(h[3], 16) };
    return null;
  }

  function isDarkColor(color, threshold) {
    var rgb = parseColor(color);
    if (!rgb) return false;
    return rgb.r <= threshold && rgb.g <= threshold && rgb.b <= threshold;
  }

  /**
   * Read the real page background. MUST be called after markReady() so
   * our own CSS rules are no longer influencing computed styles.
   */
  function detectPageBackground() {
    var html = document.documentElement;
    var body = document.body;
    return {
      html: html ? window.getComputedStyle(html).backgroundColor : null,
      body: body ? window.getComputedStyle(body).backgroundColor : null
    };
  }

  function pageHasDarkBackground(threshold) {
    var bg = detectPageBackground();
    var darkThreshold = Math.min(threshold, 80); // use a reasonable dark cutoff
    if (isDarkColor(bg.html, darkThreshold) || isDarkColor(bg.body, darkThreshold)) return true;
    return false;
  }

  // ---------------------------------------------------------------
  // STEP 2 — Async settings check. Adjusts or removes overlay based
  // on user preferences and domain exclusion list.
  // ---------------------------------------------------------------
  function initialize() {
    browser.runtime.sendMessage({
      type: 'CHECK_DOMAIN',
      url: window.location.href
    }).then(function(response) {
      if (!response || !response.settings.enabled) {
        removeOverlay(0);
        return;
      }

      if (response.excluded) {
        removeOverlay(0);
        return;
      }

      settings = response.settings;

      // Update overlay color if user has a custom setting
      if (overlay && settings.backgroundColor !== DEFAULT_BG) {
        overlay.style.setProperty('background-color', settings.backgroundColor, 'important');
      }

      waitForPageReady();

    }).catch(function() {
      removeOverlay(0);
    });
  }

  // ---------------------------------------------------------------
  // STEP 3 — Wait for page to finish loading, then remove overlay.
  //
  // We intentionally do NOT poll with setInterval. Earlier versions
  // used a 50ms interval to detect dark backgrounds, but that
  // always detected our own injected CSS (#1a1a1a) as "dark" and
  // removed the overlay far too early, causing a flash.
  //
  // Instead we wait for DOMContentLoaded (or detect that the DOM is
  // already ready), disengage our CSS while the overlay still
  // covers the viewport, read the REAL page background, and then
  // decide how to fade out.
  // ---------------------------------------------------------------
  function waitForPageReady() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        setTimeout(handleDOMReady, 50);
      });
    } else {
      setTimeout(handleDOMReady, 50);
    }

    // Fallback: also try on full load (images, etc.)
    window.addEventListener('load', function() {
      setTimeout(handleDOMReady, 50);
    });

    // Safety timeout: never keep overlay more than 3 seconds
    setTimeout(function() {
      removeOverlay(settings ? settings.transitionDuration : 300);
    }, 3000);
  }

  function handleDOMReady() {
    if (settled) return;

    if (!settings) {
      removeOverlay(300);
      return;
    }

    // Disengage our CSS FIRST so computed styles reflect the real
    // page background. The overlay is still at full opacity covering
    // the viewport, so this change is invisible to the user.
    markReady();

    var fadeDuration = settings.transitionDuration;

    if (settings.autoDisableOnDarkSites && pageHasDarkBackground(settings.detectThreshold)) {
      // Page already has a dark background — fast fade (barely noticeable)
      fadeDuration = Math.max(fadeDuration / 2, 50);
    }

    settled = true;
    fadeOverlay(fadeDuration);
  }

  // ---------------------------------------------------------------
  // Kick off. The overlay is already visible, so there is no flash
  // regardless of how long the async round-trip takes.
  // ---------------------------------------------------------------
  initialize();

})();
