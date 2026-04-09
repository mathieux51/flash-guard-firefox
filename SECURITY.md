# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| latest  | :white_check_mark: |
| < latest | :x:               |

## Reporting a Vulnerability

If you discover a security vulnerability in Flash Guard, please report it
responsibly.

**Please do NOT open a public GitHub issue for security vulnerabilities.**

Instead, send an email to: mathieux51@users.noreply.github.com

### What to include

- A description of the vulnerability
- Steps to reproduce the issue
- The potential impact
- Any suggested fixes (if applicable)

### What to expect

- You will receive an acknowledgment within **48 hours**
- We will investigate and provide updates on the status
- Once resolved, we will credit you in the release notes (unless you prefer to
  remain anonymous)

## Security Best Practices

Flash Guard requests minimal permissions:

- **storage**: To save user preferences locally
- **tabs**: To detect the current tab domain for exclusion lists
- **all_urls**: To inject the content script that prevents white flashes

The extension does not collect, transmit, or store any user data beyond local
settings. All data stays in your browser.
