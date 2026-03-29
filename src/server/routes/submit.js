/**
 * routes/submit.js — Test JSON submission endpoint.
 *
 * POST /api/test/submit
 *   Accepts a JSON body, logs it to stdout, and echoes it back.
 *   This is a development/test endpoint; production apps would POST to their
 *   own backend. Generated apps reference this URL via meta.submitUrl.
 */

export function registerSubmitRoute(app) {
  app.post('/api/test/submit', (req, res) => {
    const data      = req.body ?? {};
    const received  = new Date().toISOString();

    // Sanitize for logging (mask password-like keys)
    const safe = Object.fromEntries(
      Object.entries(data).map(([k, v]) =>
        /pass|secret|token/i.test(k) ? [k, '***'] : [k, v]
      )
    );
    console.log(`[submit] ${received}`, safe);

    res.json({
      ok:        true,
      message:   'Your submission was received. Thank you!',
      received:  data,
      timestamp: received,
    });
  });
}
