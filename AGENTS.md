# Repository Guidelines

## Project Structure & Module Organization

This is a small Manifest V3 Chrome extension. All project files currently live at the repository root:

- `manifest.json` declares extension metadata, permissions, the background service worker, and popup entry point.
- `background.js` owns `chrome.declarativeNetRequest` rule creation and storage change handling.
- `popup.html`, `popup.css`, and `popup.js` implement the extension popup UI and validation flow.
- `README.md` documents manual installation and basic usage.

There are no dedicated `src/`, `test/`, or asset directories yet. If the extension grows, group new UI code under a clear folder such as `popup/` and keep service-worker logic separate from popup-only behavior.

## Build, Test, and Development Commands

No package manager, build step, or automated test command is configured. Develop and verify the extension directly in Chrome:

- Open `chrome://extensions`.
- Enable Developer mode.
- Choose **Load unpacked** and select this repository directory.
- After changes, click the extension reload button in `chrome://extensions`.

For quick syntax checks, run browser-compatible JavaScript through your editor or a local linter if one is added later.

## Coding Style & Naming Conventions

Use plain JavaScript, HTML, and CSS. Match the current style: two-space indentation, semicolons, double-quoted strings, `const` by default, and `async`/`await` for Chrome API calls. Name constants in `UPPER_SNAKE_CASE`, functions and variables in `camelCase`, and DOM IDs/classes in lowercase kebab case.

Keep validation logic close to the code that consumes it, and avoid adding dependencies unless they materially simplify extension behavior.

## Testing Guidelines

Automated tests are not present. Manually test these flows before submitting changes:

- Saving a valid header name and value.
- Enabling and disabling the switch.
- Rejecting invalid header names and values with line breaks.
- Reloading the extension and confirming persisted settings still apply.

When adding tests later, prefer focused unit tests for validation helpers and integration-style checks for Chrome API interactions.

## Commit & Pull Request Guidelines

Git history is not available in this working directory, so no existing commit convention can be inferred. Use short, imperative commit messages such as `Validate header values` or `Update popup layout`.

Pull requests should describe the user-visible change, list manual verification steps, and include screenshots or screen recordings for popup UI changes.
