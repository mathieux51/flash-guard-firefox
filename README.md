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

1. **Early Injection**: CSS and JavaScript are injected at `document_start`, before any page content renders

2. **Overlay Creation**: A full-screen dark overlay is immediately applied to prevent the white flash

3. **Background Detection**: The extension monitors the page's actual background color as it loads

4. **Smart Removal**: Once the page's CSS loads or a dark background is detected, the overlay smoothly fades out

5. **Safety Timeout**: The overlay automatically removes after 3 seconds maximum to prevent blocking content

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
├── manifest.json           # Extension manifest
├── icons/
│   ├── icon-48.svg        # Toolbar icon
│   └── icon-96.svg        # High-DPI icon
└── src/
    ├── background.js      # Background script for settings management
    ├── content.js         # Content script for overlay injection
    ├── flash-guard.css    # Early-injected CSS
    ├── popup.html         # Popup UI
    ├── popup.css          # Popup styles
    ├── popup.js           # Popup logic
    ├── options.html       # Options page
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
