/**
 * Flash Guard - Content Script
 * Detects white backgrounds and applies dark overlay to prevent flash
 */

(function() {
  'use strict';

  // Prevent multiple injections
  if (window.__flashGuardInitialized) return;
  window.__flashGuardInitialized = true;

  let settings = null;
  let overlay = null;
  let isActive = false;

  // Create and inject overlay immediately (before DOM is ready)
  function createOverlay(backgroundColor) {
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'flash-guard-overlay';
    overlay.style.cssText = `
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      width: 100vw !important;
      height: 100vh !important;
      background-color: ${backgroundColor} !important;
      z-index: 2147483647 !important;
      pointer-events: none !important;
      opacity: 1 !important;
      transition: opacity 0.2s ease-out !important;
    `;
    
    return overlay;
  }

  // Inject overlay into document as early as possible
  function injectOverlay() {
    if (!overlay || isActive) return;
    
    // Try to inject into documentElement first, then body
    const target = document.documentElement || document.body;
    if (target && !document.getElementById('flash-guard-overlay')) {
      target.appendChild(overlay);
      isActive = true;
    }
  }

  // Remove overlay with fade effect
  function removeOverlay(duration = 200) {
    if (!overlay || !isActive) return;

    overlay.style.transition = `opacity ${duration}ms ease-out`;
    overlay.style.opacity = '0';

    setTimeout(() => {
      if (overlay && overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      isActive = false;
    }, duration);
  }

  // Parse color string to RGB values
  function parseColor(color) {
    if (!color || color === 'transparent' || color === 'rgba(0, 0, 0, 0)') {
      return null;
    }

    // Handle rgb/rgba format
    const rgbMatch = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1], 10),
        g: parseInt(rgbMatch[2], 10),
        b: parseInt(rgbMatch[3], 10)
      };
    }

    // Handle hex format
    const hexMatch = color.match(/^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (hexMatch) {
      return {
        r: parseInt(hexMatch[1], 16),
        g: parseInt(hexMatch[2], 16),
        b: parseInt(hexMatch[3], 16)
      };
    }

    return null;
  }

  // Check if a color is considered "white" or very light
  function isWhiteColor(color, threshold = 240) {
    const rgb = parseColor(color);
    if (!rgb) return true; // Transparent/no color defaults to white in browsers
    
    // Check if all RGB values are above threshold (very light)
    return rgb.r >= threshold && rgb.g >= threshold && rgb.b >= threshold;
  }

  // Check if a color is considered "dark"
  function isDarkColor(color, threshold = 50) {
    const rgb = parseColor(color);
    if (!rgb) return false;
    
    // Check if all RGB values are below threshold (very dark)
    return rgb.r <= threshold && rgb.g <= threshold && rgb.b <= threshold;
  }

  // Detect the actual background color of the page
  function detectPageBackground() {
    const html = document.documentElement;
    const body = document.body;

    // Check computed styles
    const htmlBg = html ? window.getComputedStyle(html).backgroundColor : null;
    const bodyBg = body ? window.getComputedStyle(body).backgroundColor : null;

    // Check inline styles as fallback
    const htmlInline = html ? html.style.backgroundColor : null;
    const bodyInline = body ? body.style.backgroundColor : null;

    return {
      html: htmlBg || htmlInline,
      body: bodyBg || bodyInline
    };
  }

  // Main check - determine if we should show the overlay
  function shouldShowOverlay(threshold) {
    const { html, body } = detectPageBackground();
    
    // If either html or body has a dark background, don't show overlay
    if (isDarkColor(html) || isDarkColor(body)) {
      return false;
    }

    // If either has a white/light background, show overlay
    if (isWhiteColor(html, threshold) || isWhiteColor(body, threshold)) {
      return true;
    }

    // Default: show overlay (safer to prevent flash)
    return true;
  }

  // Initialize the extension
  async function initialize() {
    try {
      // Get settings from background script
      const response = await browser.runtime.sendMessage({
        type: 'CHECK_DOMAIN',
        url: window.location.href
      });

      if (!response || !response.settings.enabled || response.excluded) {
        return;
      }

      settings = response.settings;

      // Create overlay immediately
      createOverlay(settings.backgroundColor);

      // Inject as soon as possible
      if (document.documentElement) {
        injectOverlay();
      } else {
        // Wait for documentElement if not ready
        const observer = new MutationObserver(() => {
          if (document.documentElement) {
            injectOverlay();
            observer.disconnect();
          }
        });
        observer.observe(document, { childList: true, subtree: true });
      }

      // Monitor for page ready and check background
      waitForPageReady();

    } catch (error) {
      // Extension context might be invalid, clean up
      removeOverlay(0);
    }
  }

  // Wait for page to be ready and check if overlay should be removed
  function waitForPageReady() {
    // Check periodically if page has loaded dark content
    const checkInterval = setInterval(() => {
      if (settings && settings.autoDisableOnDarkSites) {
        if (!shouldShowOverlay(settings.detectThreshold)) {
          removeOverlay(settings.transitionDuration);
          clearInterval(checkInterval);
          return;
        }
      }
    }, 50);

    // Remove overlay when DOM is ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        setTimeout(() => {
          clearInterval(checkInterval);
          handleDOMReady();
        }, 100);
      });
    } else {
      setTimeout(() => {
        clearInterval(checkInterval);
        handleDOMReady();
      }, 100);
    }

    // Fallback: remove after page load
    window.addEventListener('load', () => {
      clearInterval(checkInterval);
      removeOverlay(settings ? settings.transitionDuration : 200);
    });

    // Safety timeout - never keep overlay more than 3 seconds
    setTimeout(() => {
      clearInterval(checkInterval);
      removeOverlay(settings ? settings.transitionDuration : 200);
    }, 3000);
  }

  // Handle when DOM is ready
  function handleDOMReady() {
    if (!settings) {
      removeOverlay(200);
      return;
    }

    // Final check - if page has dark background, remove immediately
    if (settings.autoDisableOnDarkSites && !shouldShowOverlay(settings.detectThreshold)) {
      removeOverlay(settings.transitionDuration / 2);
    } else {
      // Remove with normal transition
      removeOverlay(settings.transitionDuration);
    }
  }

  // Start immediately
  initialize();

})();
