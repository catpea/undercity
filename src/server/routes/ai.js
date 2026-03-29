/**
 * routes/ai.js — AI action generation proxy.
 *
 * POST /api/ai/generate-action  { prompt: string }
 *   Proxies to a local OpenAI-compatible inference server (default: localhost:8191).
 *   The AI responds with a structured Undercity action definition (JSON).
 *
 * Environment variables:
 *   AI_URL   — base URL for the inference server (default: http://localhost:8191)
 *   AI_MODEL — model name to request            (default: local-model)
 */

const AI_URL   = process.env.AI_URL   ?? 'http://localhost:8191';
const AI_MODEL = process.env.AI_MODEL ?? 'local-model';

const SYSTEM_PROMPT = `\
You are an AI user inside the Undercity dungeon — a visual flow-based programming system
where users move through "rooms" (pages/rooms) carrying an "inventory" of key/value data.
Actions run inside room lifecycle events (onEnter, onExit, etc.) to manipulate inventory,
call APIs, or control the UI.

Your role: when the dungeon master describes a new action, CREATE a structured action
definition that will appear in the Savant's action library.

Always respond with a valid JSON object matching this exact shape:
{
  "id":     "category.actionName",
  "label":  "Human-readable name",
  "desc":   "One sentence description (plain text, no HTML)",
  "params": [
    { "name": "paramName", "label": "Label", "type": "...", "default": "...", "placeholder": "..." }
  ]
}

── Param types ──────────────────────────────────────────────────────────────
  text      — single-line text input
  url       — URL input (use for API endpoints, image sources)
  number    — numeric input
  boolean   — true/false select
  select    — dropdown; also provide "options": ["a","b","c"]
  textarea  — multi-line text
  code      — inline JavaScript expression (shows a JS badge)
  room   — text input, semantically an inventory key / variable name

── Action patterns — choose the right one ───────────────────────────────────

BACKEND / API ACTION  (calls a server, reads from inventory, stores result)
  Required params:
    { "name": "url",         "label": "API endpoint",   "type": "url",     "placeholder": "https://api.example.com/endpoint" }
    { "name": "readFromVar", "label": "Read from var",  "type": "room", "placeholder": "uploadedVideo", "default": "uploadedVideo" }
    { "name": "into",        "label": "Store result in","type": "room", "placeholder": "resultKey" }
  Example: AI image generation, video processing, sentiment analysis, OCR, translation

FRONTEND / UI ACTION  (shows UI to the user, captures input, stores in inventory)
  Required params:
    { "name": "label",       "label": "Prompt label",   "type": "text",    "placeholder": "Upload your portrait" }
    { "name": "into",        "label": "Store in var",   "type": "room", "placeholder": "capturedPhoto" }
  Add more UI-specific params as needed (accept types, limits, etc.)
  Example: file upload, webcam capture, text input, rating slider

TRANSFORM / UTILITY ACTION  (processes inventory data, no UI, no server)
  Required params:
    { "name": "readFromVar", "label": "Read from var",  "type": "room", "placeholder": "inputKey" }
    { "name": "into",        "label": "Store result in","type": "room", "placeholder": "outputKey" }
  Example: format date, encode base64, shuffle array, compute hash

── Rules ─────────────────────────────────────────────────────────────────────
- id: camelCase with dot separator, e.g. "persona.askImage", "media.captureWebcam"
- Always include an "into" param for any action that produces a value
- Use "url" type for any API endpoint or image/resource URL param
- Use "room" type for inventory key params (readFromVar, into, storeAs, etc.)
- Descriptions must be plain text — no HTML, no angle brackets
- Keep params minimal and purposeful (3–6 params is ideal)
- Respond ONLY with the JSON object — no explanation, no markdown fences
`;

/**
 * @param {object} app - Express-compatible app
 */
const UI_SYSTEM_PROMPT = `\
You are a UI designer for a no-code workflow builder called Undercity.
You receive an action definition and must return a "basic" UI description.

The basic UI is a simplified, friendly version for non-technical users:
- Use plain English labels (no camelCase, no jargon)
- Replace code/expression fields with friendly alternatives where possible
- Describe each param as: { name, label, placeholder, hint }
- Keep it to the 1–3 most important params only
- hint is a plain-English explanation of what the field does

Respond ONLY with a valid JSON object:
{
  "basicLabel": "Friendly action name",
  "basicDesc": "One sentence in plain English what this action does",
  "basicParams": [
    { "name": "paramName", "label": "Friendly label", "placeholder": "Example value", "hint": "Plain English hint" }
  ]
}
No markdown, no fences, just the JSON.
`;

export function registerAIRoute(app) {

  app.post('/api/ai/generate-action', async (req, res) => {
    const { prompt } = req.body ?? {};
    if (!prompt) return res.status(400).json({ error: 'prompt required' });

    try {
      const aiRes = await fetch(`${AI_URL}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       AI_MODEL,
          messages:    [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user',   content: `Create an action for: ${prompt}` },
          ],
          temperature: 0.3,
          max_tokens:  512,
        }),
      });

      if (!aiRes.ok) {
        const body = await aiRes.text().catch(() => '');
        return res.status(502).json({ error: `AI server error ${aiRes.status}`, detail: body });
      }

      const data  = await aiRes.json();
      const text  = data.choices?.[0]?.message?.content ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(502).json({ error: 'AI did not return a JSON object', raw: text });

      res.json(JSON.parse(match[0]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  // ── Generate Basic UI for an action ──────────────────────────────────────
  // POST /api/ai/upgrade-action-ui  { action: ActionDef }
  // Returns: { basicLabel, basicDesc, basicParams[] }
  app.post('/api/ai/upgrade-action-ui', async (req, res) => {
    const { action } = req.body ?? {};
    if (!action) return res.status(400).json({ error: 'action required' });

    try {
      const aiRes = await fetch(`${AI_URL}/v1/chat/completions`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model:       AI_MODEL,
          messages:    [
            { role: 'system', content: UI_SYSTEM_PROMPT },
            { role: 'user',   content: `Create a Basic UI for this action:\n${JSON.stringify(action, null, 2)}` },
          ],
          temperature: 0.4,
          max_tokens:  512,
        }),
      });

      if (!aiRes.ok) {
        const body = await aiRes.text().catch(() => '');
        return res.status(502).json({ error: `AI server error ${aiRes.status}`, detail: body });
      }

      const data  = await aiRes.json();
      const text  = data.choices?.[0]?.message?.content ?? '';
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return res.status(502).json({ error: 'AI did not return JSON', raw: text });

      res.json(JSON.parse(match[0]));
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });
}
