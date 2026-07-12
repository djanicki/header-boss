# Header Boss

Header Boss is a Manifest V3 Chrome extension that adds configurable request
headers to browser requests.

## Usage

1. Open `chrome://extensions`.
2. Enable Developer mode.
3. Click Load unpacked.
4. Select this project directory.
5. Click the Header Boss extension icon, add one or more header names and values,
   remove any rows you do not need, then turn the switch on.

The extension stores settings with `chrome.storage.sync` and applies headers with a
single dynamic `declarativeNetRequest` rule. Turning the switch off removes that rule.
