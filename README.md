# Flash Guard

A Firefox extension that prevents white background flashes during page loads. It detects white/light backgrounds and applies a dark overlay that fades out once the page content renders.

## Features

- **Instant Dark Overlay**: Applies a dark background immediately when a page starts loading to prevent eye strain from white flashes
- **Smart Detection**: Automatically detects if a site already has a dark theme and skips the overlay
- **Customizable**: Configure background color, fade duration, and detection sensitivity
- **Domain Exclusions**: Exclude specific websites where you don't want the protection
- **Lightweight**: Minimal performance impact with early injection at `document_start`

## Installation

### From Firefox Add-ons (Recommended)

*Coming soon*

### Manual Installation (Development)

1. Clone this repository:
   ```bash
   git clone https://github.com/mathieux51/flash-guard-firefox.git
   ```

2. Open Firefox and navigate to `about:debugging`

3. Click "This Firefox" in the left sidebar

4. Click "Load Temporary Add-on..."

5. Navigate to the `flash-guard-firefox` folder and select `manifest.json`

## Usage

Once installed, Flash Guard automatically protects you from white flashes on all websites.

### Popup Controls

Click the Flash Guard icon in your toolbar to access:

- **Enable/Disable Toggle**: Turn the extension on or off globally
- **Background Color**: Choose the overlay color (default: dark gray)
- **Fade Duration**: Adjust how quickly the overlay fades out
- **Auto-disable on dark sites**: Automatically skip overlay on sites with dark backgrounds
- **Excluded Domains**: Add or remove domains from the exclusion list
- **Exclude Current Site**: Quickly add the current website to exclusions

### Advanced Options

Access advanced settings via the popup's "Advanced Settings" link or through `about:addons` > Flash Guard > Options:

- **White Detection Threshold**: Adjust sensitivity for detecting white backgrounds (0-255)
- **Export/Import Settings**: Backup and restore your configuration
- **Reset to Defaults**: Restore all settings to their original values

## How It Works

Flash Guard uses a 3-layer approach to eliminate white flashes:

1. **Stream Filter** (`filterResponseData`): Intercepts the raw HTTP response and injects a dark `<style>` tag into the HTML before Firefox's parser sees it. This is the earliest extension-controlled injection point.

2. **Content Script CSS**: A manifest-declared CSS file and an inline `<style>` injected at `document_start` provide belt-and-suspenders dark backgrounds.

3. **Overlay Div**: A full-viewport dark overlay is injected synchronously before any async calls. Once the page's real background is ready, the overlay fades out.

4. **Color Scheme Override**: Uses `browserSettings.overrideContentColorScheme` to tell Firefox to report `prefers-color-scheme: dark` to all pages. Sites that respect this media query will load their dark variant automatically.

5. **Smart Removal**: On `DOMContentLoaded`, the extension disengages its own CSS (while the overlay still covers the viewport), reads the real page background, and fades the overlay. A 3-second safety timeout guarantees removal.

### Eliminating the Pre-Navigation White Flash

When Firefox navigates to a URL, it clears the current page and paints the default canvas color (white) before the HTTP response even arrives. No extension can inject content during this window. Flash Guard handles everything after the response, but this single pre-response white frame is visible on very fast pages (e.g. localhost).

To fix this, change Firefox's default canvas color:

1. Open `about:config` in a new tab
2. Search for `browser.display.background_color`
3. Change the value from `#FFFFFF` to `#1a1a1a`

This is a global Firefox preference that changes the default background for pages that do not set their own. You can revert it at any time by resetting the value back to `#FFFFFF`.

## Configuration

### Default Settings

```javascript
{
  enabled: true,
  backgroundColor: '#1a1a1a',
  transitionDuration: 200,      // milliseconds
  detectThreshold: 240,         // RGB threshold (0-255)
  excludedDomains: [],
  autoDisableOnDarkSites: true
}
```

### Domain Exclusion Patterns

You can use wildcards in domain exclusions:
- `example.com` - Exact domain match
- `*.example.com` - Match all subdomains

## Development

### Project Structure

```
flash-guard-firefox/
├── manifest.json           # Extension manifest (Manifest V2)
├── icons/
│   ├── icon-48.png         # Toolbar icon
│   ├── icon-96.png         # High-DPI icon
│   ├── icon-disabled-48.png # Disabled state icon
│   └── icon-disabled-96.png # Disabled state high-DPI icon
└── src/
    ├── background.js      # Background script: settings, stream filter, color scheme override
    ├── content.js         # Content script: overlay injection, dark site detection
    ├── flash-guard.css    # Early-injected CSS (manifest content_scripts)
    ├── popup.html         # Popup UI
    ├── popup.css          # Popup styles
    ├── popup.js           # Popup logic
    ├── options.html       # Options page (includes about:config instructions)
    └── options.js         # Options page logic
```

### Building

No build step required. The extension runs directly from source.

### Testing

1. Load the extension temporarily in Firefox via `about:debugging`
2. Navigate to various websites to test the flash prevention
3. Test the popup and options page functionality

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

## Credits

Inspired by [Night Eye](https://nighteye.app/) and similar dark mode extensions.

---

**Note**: This extension only prevents white flashes during page loads. It does not provide full dark mode conversion like Night Eye. For comprehensive dark mode, consider using Firefox's built-in dark mode or dedicated dark mode extensions.
