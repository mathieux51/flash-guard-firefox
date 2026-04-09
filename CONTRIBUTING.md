# Contributing to Flash Guard

Thank you for your interest in contributing to Flash Guard! This document provides guidelines and information for contributors.

## How to Contribute

### Reporting Bugs

Before creating a bug report, please check existing issues to avoid duplicates. When creating a bug report, include:

- Firefox version
- Extension version
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots if applicable
- Any relevant console errors (accessible via `about:debugging`)

### Suggesting Features

Feature suggestions are welcome! Please open an issue with:

- A clear description of the feature
- The problem it solves
- Potential implementation approach (optional)

### Pull Requests

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Test thoroughly in Firefox
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## Development Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/mathieux51/flash-guard-firefox.git
   cd flash-guard-firefox
   ```

2. Load the extension in Firefox:
   - Navigate to `about:debugging`
   - Click "This Firefox"
   - Click "Load Temporary Add-on..."
   - Select the `manifest.json` file

3. Make changes and reload the extension to test

## Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add JSDoc comments for functions
- Keep functions focused and small
- Use meaningful variable and function names

## Testing

Before submitting a PR, please test:

- [ ] Extension loads without errors
- [ ] Overlay appears on white background sites
- [ ] Overlay fades out correctly
- [ ] Dark sites are detected and overlay is skipped
- [ ] Popup UI works correctly
- [ ] Settings are saved and loaded properly
- [ ] Domain exclusions work as expected

## Commit Messages

Use clear and descriptive commit messages:

- `feat: add new feature`
- `fix: resolve bug with overlay`
- `docs: update README`
- `style: format code`
- `refactor: restructure content script`

## Questions?

Feel free to open an issue for any questions about contributing.

Thank you for helping make Flash Guard better!
