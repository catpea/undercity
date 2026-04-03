  What the web component does, in order:

  1. Health check — polls GET /health every 5s, shows Online/Offline badge, disables Submit when down
  2. Preview — live table from Inventory subscribeAll showing type, human-readable stats (file size in KB/MB, image dimensions, word count for long text), and media previews
  3. Deduplication — on Submit, first calls GET /job/:jobId to see if this session already submitted; returns "already submitted" badge if so
  4. Submit — POST /submit with jobId + formId + filtered fields
  5. Checksum verification — immediately fetches the submission back, checks every key is present and file data-URL lengths match
  6. Progress polling — calls GET /job/:jobId/progress every 2s, drives the Bootstrap-style progress bar + message
  7. Live log — calls GET /job/:jobId/log each poll cycle, appends new entries with timestamp + level coloring; "▼ show (new entries)" hint when collapsed

  New server endpoints for workers:
  - GET /health — health + version check
  - GET /job/:jobId — lookup by client UUID (dedup check)
  - GET/POST /job/:jobId/progress — worker posts { percent, message, state }, client reads it
  - GET/POST /job/:jobId/log — worker appends { level, message }, client reads the stream
