# iPad Shortcut

1. In Shortcuts, create **Send to Passthrough**, open Details, enable **Show in Share Sheet**, and accept Images, Files, URLs, and Text.
2. Add **Choose from Menu** with Save, Clipboard, and Both (or set a Text action to a fixed default); store `save`, `clipboard`, or `both`.
3. Add **Get Contents of URL**. URL: `http://FEDORA_TAILSCALE_HOSTNAME_OR_IP:8787/api/share`; method: POST; request body: Form.
4. Add form field `action` with the selected value. Add `files` using the Shortcut Input; enable selection of multiple items. For shared text or URLs, map input to the respective `text` or `url` form field.
5. Add header `Authorization` with value `Bearer YOUR_LONG_TOKEN`.
6. Read `success`, `transferId`, and `clipboardStatus` from the JSON response and use **Show Result**; otherwise show the returned error.

The Fedora address must be reachable through Tailscale. The PWA is not an iPadOS Share Sheet target; the Shortcut performs the share.
