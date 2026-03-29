/**
 * templates.js — Built-in HTML page templates for generated Undercity apps.
 *
 * Each function returns an inner HTML string for insertion into the <main>
 * container. Templates receive the full node object + outEdges so they can
 * use actual navigation targets instead of hard-coded hrefs.
 *
 * Bootstrap 5.3 conventions used throughout:
 *   • <label for="id"> paired with input id="id"
 *   • aria-describedby linking input to its error element
 *   • aria-required="true" on required fields
 *   • autocomplete attributes for browser autofill
 *   • is-invalid / .invalid-feedback for validation state (not d-none hacks)
 *   • novalidate on <form> — all validation is custom JS
 *
 * Plugins may register additional templates via the PluginRegistry.
 */

import { renderAfIcon } from '../lib/icons.js';

/** Escape a string for safe placement in an HTML attribute value. */
export function escAttr(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;')
                           .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/** Escape a string for safe placement in HTML text content. */
export function escHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
                           .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Derive the goTo_* function name from an edge. Always uses toId for uniqueness. */
function goToFn(edge) {
  return `goTo_${edge.toId.replace(/[^a-zA-Z0-9]/g, '_')}`;
}

/** Derive a human-readable button label for an edge. Prefers edge label, then target node label, then ID. */
function edgeBtnLabel(edge, nodes) {
  if (edge.label?.trim()) return edge.label.trim();
  const target = nodes?.find?.(n => n.id === edge.toId);
  if (target?.label) return target.label;
  return edge.toId;
}

/** Find an out-edge matching a label pattern (case-insensitive). */
function findEdge(outEdges, pattern) {
  return outEdges.find(e => pattern.test(e.label ?? ''));
}

// ── Default page (no template) ────────────────────────────────────────────────

export function defaultPageHTML(node, outEdges, nodes) {
  return `<div class="card">
      <div class="card-body">
        <h1 class="pw-heading">${escHtml(node.label)}</h1>
      </div>
    </div>`;
}

// ── Login form ────────────────────────────────────────────────────────────────

export function loginFormHTML(node = {}, outEdges = []) {
  // Resolve out-edges by label pattern
  const submitEdge = findEdge(outEdges, /submit|sign.?in|login/i) ?? outEdges[0];
  const forgotEdge = findEdge(outEdges, /forgot|reset|password/i);
  const signupEdge = findEdge(outEdges, /sign.?up|register|creat/i);

  const submitFn   = submitEdge ? `${goToFn(submitEdge)}()` : 'void 0';
  const forgotHref = forgotEdge ? `${forgotEdge.toId}.html` : 'forgot.html';
  const signupHref = signupEdge ? `${signupEdge.toId}.html` : 'signup.html';

  return `<div class="card col-md-5 mx-auto">
      <div class="card-body">
      <h2 class="pw-heading mb-1">Sign In</h2>
      <p class="text-muted small mb-4">Welcome back. Enter your credentials.</p>

      <form id="login-form" novalidate
            onsubmit="event.preventDefault(); ${submitFn}">
        <div class="mb-3">
          <label for="login-email" class="form-label">Email</label>
          <input type="email" id="login-email" name="email"
                 class="form-control pw-input"
                 placeholder="you@example.com"
                 autocomplete="email"
                 aria-describedby="login-email-error"
                 aria-required="true"
                 required>
          <div id="login-email-error" class="invalid-feedback" data-error="email">
            Please enter a valid email address.
          </div>
        </div>

        <div class="mb-4">
          <label for="login-password" class="form-label d-flex justify-content-between align-items-center">
            Password
            <a href="${escAttr(forgotHref)}" class="text-info small fw-normal">Forgot password?</a>
          </label>
          <input type="password" id="login-password" name="password"
                 class="form-control pw-input"
                 placeholder="••••••••"
                 autocomplete="current-password"
                 aria-describedby="login-password-error"
                 aria-required="true"
                 required>
          <div id="login-password-error" class="invalid-feedback" data-error="password">
            Password is required.
          </div>
        </div>

        <div id="login-alert" class="alert alert-danger py-2 d-none" role="alert" aria-live="polite"></div>

        <button type="submit" class="btn btn-primary w-100 fw-semibold">
          Sign In
        </button>
      </form>

      <p class="text-center text-muted small mt-4 mb-0">
        No account?
        <a href="${escAttr(signupHref)}" class="text-info">Create one</a>
      </p>
      </div>
    </div>`;
}

// ── Forgot password form ──────────────────────────────────────────────────────

export function forgotFormHTML(node = {}, outEdges = []) {
  const submitEdge = findEdge(outEdges, /submit|send|reset/i) ?? outEdges[0];
  const backEdge   = findEdge(outEdges, /back|login|sign.?in/i);

  const submitFn  = submitEdge ? `${goToFn(submitEdge)}()` : 'void 0';
  const loginHref = backEdge ? `${backEdge.toId}.html` : 'login.html';

  return `<div class="card col-md-5 mx-auto">
      <div class="card-body">
      <h2 class="pw-heading mb-1">Forgot Password</h2>
      <p class="text-muted small mb-4">We'll send a reset link to your inbox.</p>

      <form id="forgot-form" novalidate
            onsubmit="event.preventDefault(); ${submitFn}">
        <div class="mb-4">
          <label for="forgot-email" class="form-label">Email Address</label>
          <input type="email" id="forgot-email" name="email"
                 class="form-control pw-input"
                 placeholder="you@example.com"
                 autocomplete="email"
                 aria-describedby="forgot-email-error"
                 aria-required="true"
                 required>
          <div id="forgot-email-error" class="invalid-feedback" data-error="email">
            Please enter the email address linked to your account.
          </div>
        </div>

        <div id="forgot-alert" class="alert alert-info py-2 d-none" role="status" aria-live="polite"></div>

        <button type="submit" class="btn btn-primary w-100 fw-semibold">
          Send Reset Link
        </button>
      </form>

      <p class="text-center text-muted small mt-4 mb-0">
        Remember it?
        <a href="${escAttr(loginHref)}" class="text-info">Back to Sign In</a>
      </p>
      </div>
    </div>`;
}

// ── Sign-up form ──────────────────────────────────────────────────────────────

export function signupFormHTML(node = {}, outEdges = []) {
  const submitEdge = findEdge(outEdges, /submit|creat|sign.?up|register/i) ?? outEdges[0];
  const loginEdge  = findEdge(outEdges, /back|login|sign.?in/i);

  const submitFn  = submitEdge ? `${goToFn(submitEdge)}()` : 'void 0';
  const loginHref = loginEdge ? `${loginEdge.toId}.html` : 'login.html';

  return `<div class="card col-md-5 mx-auto">
      <div class="card-body">
      <h2 class="pw-heading mb-1">Create Account</h2>
      <p class="text-muted small mb-4">Join us — it only takes a moment.</p>

      <form id="signup-form" novalidate
            onsubmit="event.preventDefault(); ${submitFn}">
        <div class="row g-3 mb-3">
          <div class="col-sm-6">
            <label for="signup-firstName" class="form-label">First Name</label>
            <input type="text" id="signup-firstName" name="firstName"
                   class="form-control pw-input"
                   placeholder="Jane"
                   autocomplete="given-name"
                   aria-required="true"
                   required>
            <div class="invalid-feedback" data-error="firstName">
              First name is required.
            </div>
          </div>
          <div class="col-sm-6">
            <label for="signup-lastName" class="form-label">Last Name</label>
            <input type="text" id="signup-lastName" name="lastName"
                   class="form-control pw-input"
                   placeholder="Doe"
                   autocomplete="family-name"
                   aria-required="true"
                   required>
            <div class="invalid-feedback" data-error="lastName">
              Last name is required.
            </div>
          </div>
        </div>

        <div class="mb-3">
          <label for="signup-email" class="form-label">Email</label>
          <input type="email" id="signup-email" name="email"
                 class="form-control pw-input"
                 placeholder="you@example.com"
                 autocomplete="email"
                 aria-describedby="signup-email-error"
                 aria-required="true"
                 required>
          <div id="signup-email-error" class="invalid-feedback" data-error="email">
            Please enter a valid email address.
          </div>
        </div>

        <div class="mb-4">
          <label for="signup-password" class="form-label">Password</label>
          <input type="password" id="signup-password" name="password"
                 class="form-control pw-input"
                 placeholder="Min. 8 characters"
                 autocomplete="new-password"
                 minlength="8"
                 aria-describedby="signup-password-error"
                 aria-required="true"
                 required>
          <div id="signup-password-error" class="invalid-feedback" data-error="password">
            Password must be at least 8 characters.
          </div>
        </div>

        <div id="signup-alert" class="alert alert-danger py-2 d-none" role="alert" aria-live="polite"></div>

        <button type="submit" class="btn btn-primary w-100 fw-semibold">
          Create Account
        </button>
      </form>

      <p class="text-center text-muted small mt-4 mb-0">
        Already have one?
        <a href="${escAttr(loginHref)}" class="text-info">Sign In</a>
      </p>
      </div>
    </div>`;
}

// ── Success terminal ──────────────────────────────────────────────────────────

export function successHTML(node) {
  const meta = node.meta ?? {};
  return `<div class="card col-md-6 mx-auto text-center">
      <div class="card-body">
        <div class="mb-3 fs-1 d-inline-flex" aria-hidden="true">${renderAfIcon('check-circle')}</div>
        <h2 class="pw-heading">${escHtml(node.label)}</h2>
        <p class="text-muted mt-2 mb-4">${escHtml(meta.message ?? 'You have successfully completed this step.')}</p>
        ${meta.nextLabel
          ? `<a href="${escAttr(meta.nextHref ?? '#')}" class="btn btn-primary">${escHtml(meta.nextLabel)}</a>`
          : ''}
      </div>
    </div>`;
}

// ── Error terminal / room ──────────────────────────────────────────────────

export function errorHTML(node, outEdges = []) {
  const meta    = node.meta ?? {};
  const backEdge = findEdge(outEdges, /back|retry|return/i) ?? outEdges[0];
  const backFn   = backEdge ? `onclick="${goToFn(backEdge)}()"` : 'onclick="history.back()"';

  return `<div class="card col-md-6 mx-auto text-center">
      <div class="card-body">
        <div class="mb-3 fs-1 d-inline-flex" aria-hidden="true">${renderAfIcon('exclamation-triangle')}</div>
        <h2 class="pw-heading text-danger">${escHtml(node.label)}</h2>
        <p class="text-muted mt-2 mb-4" id="error-msg">${escHtml(meta.message ?? 'Something went wrong.')}</p>
        <button type="button" class="btn btn-outline-secondary" ${backFn}>Go Back</button>
      </div>
    </div>`;
}

// ── Submit review terminal ────────────────────────────────────────────────────
// Shows the collected inventory, lets the user verify, restart (keeping data),
// or submit as JSON to a configurable URL.
//
// node.meta:
//   submitUrl:     URL to POST the data to (required for submit button)
//   reviewFields:  string[] - inventory keys to display (default: all non-null, non-boolean)
//   submitLabel:   button label (default "Submit")
//   reviewTitle:   page heading (default "Review Your Details")
//   reviewMessage: paragraph below heading

export function submitReviewHTML(node, outEdges = []) {
  const meta         = node.meta ?? {};
  const submitUrl    = meta.submitUrl ?? '/api/test/submit';
  const submitLabel  = meta.submitLabel  ?? 'Submit';
  const reviewTitle  = meta.reviewTitle  ?? 'Review Your Details';
  const reviewMsg    = meta.reviewMessage ?? 'Please verify your information before submitting.';
  const reviewFields = meta.reviewFields ? JSON.stringify(meta.reviewFields) : 'null';

  return `<div class="card col-lg-6 col-md-8 mx-auto">
      <div class="card-body">
      <div class="text-center mb-4">
        <div class="fs-1 mb-2 d-inline-flex" aria-hidden="true">${renderAfIcon('clipboard-check')}</div>
        <h2 class="pw-heading">${escHtml(reviewTitle)}</h2>
        <p class="text-muted small mb-0">${escHtml(reviewMsg)}</p>
      </div>

      <div id="pw-review-table" class="mb-4">
        <!-- Populated by script below -->
      </div>

      <div id="pw-submit-result" class="alert d-none mb-3" role="alert" aria-live="polite"></div>

      <div class="d-flex flex-column flex-sm-row gap-2">
        <button type="button" id="pw-btn-restart" class="btn btn-outline-secondary flex-sm-fill d-inline-flex align-items-center justify-content-center gap-2">
          ${renderAfIcon('pencil-square')}
          <span>Edit / Start Over</span>
        </button>
        <button type="button" id="pw-btn-submit" class="btn btn-primary flex-sm-fill fw-semibold">
          ${escHtml(submitLabel)} →
        </button>
      </div>
      </div>
    </div>

    <script type="module">
      import { Inventory, Navigator, Actions } from './js/runtime.js';

      const SUBMIT_URL    = '${escAttr(submitUrl)}';
      const REVIEW_FIELDS = ${reviewFields};

      // Render inventory table
      function renderReview() {
        const data = Inventory.dump();
        const keys = REVIEW_FIELDS
          ?? Object.keys(data).filter(k => {
               const v = data[k];
               return v !== null && v !== '' && typeof v !== 'boolean' && !k.startsWith('__');
             });

        const table = document.getElementById('pw-review-table');
        if (!keys.length) {
          table.innerHTML = '<p class="text-muted fst-italic small text-center">No information collected.</p>';
          return;
        }

        const rows = keys
          .map(k => {
            const v = data[k];
            if (v === null || v === undefined || v === '') return '';
            const label = k.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            const val   = typeof v === 'object' ? JSON.stringify(v) : String(v);
            return \`<tr>
              <th scope="row" class="text-muted fw-normal small py-2 pe-3" style="white-space:nowrap">\${label}</th>
              <td class="py-2 text-break small fw-semibold">\${val}</td>
            </tr>\`;
          })
          .filter(Boolean)
          .join('');

        table.innerHTML = rows
          ? \`<div class="table-responsive">
              <table class="table table-sm table-dark table-borderless mb-0">
                <tbody>\${rows}</tbody>
              </table>
             </div>\`
          : '<p class="text-muted fst-italic small text-center">No information collected.</p>';
      }

      // Restart without clearing inventory (user can edit)
      document.getElementById('pw-btn-restart').addEventListener('click', () => {
        Navigator.reset(true);  // keepData = true
      });

      // Submit inventory as JSON
      document.getElementById('pw-btn-submit').addEventListener('click', async () => {
        const btn    = document.getElementById('pw-btn-submit');
        const result = document.getElementById('pw-submit-result');
        btn.disabled = true;
        btn.textContent = 'Submitting…';
        result.className = 'alert d-none mb-3';

        try {
          const data = Inventory.dump();
          const keys = REVIEW_FIELDS
            ?? Object.keys(data).filter(k => {
                 const v = data[k];
                 return v !== null && v !== '' && typeof v !== 'boolean' && !k.startsWith('__');
               });
          const payload = REVIEW_FIELDS
            ? Object.fromEntries(keys.map(k => [k, data[k]]))
            : data;

          const res = await Actions.post(SUBMIT_URL, payload);
          result.className = 'alert alert-success mb-3';
          result.textContent = res?.message ?? 'Submitted successfully! Thank you.';
          btn.textContent = 'Submitted';
        } catch (err) {
          result.className = 'alert alert-danger mb-3';
          result.textContent = 'Submission failed: ' + (err.message ?? err);
          btn.disabled = false;
          btn.textContent = '${escHtml(submitLabel)} →';
        }
      });

      renderReview();
    </script>`;
}

// ── Lobby (entry / welcome page) ─────────────────────────────────────────────
// The lobby is the app's index.html — the very first page the user lands on.
// It shows an app icon, name, tagline, and choice buttons (from out-edges).
//
// node.meta:
//   appName  — heading (default: node.label)
//   tagline  — short pitch line (default: project description)
//   icon     — Bootstrap icon name (no .svg extension, default: 'stars')

export function lobbyHTML(node = {}, outEdges = [], nodes = []) {
  const meta    = node.meta ?? {};
  const title   = escHtml(meta.appName ?? node.label ?? 'Welcome');
  const tagline = escHtml(meta.tagline ?? meta.description ?? '');
  const icon    = renderAfIcon(meta.icon, { class: 'pw-lobby-glyph' }, 'stars');

  // Classify edges into primary, secondary, and tertiary (links)
  const isPrimary   = e => /sign.in|log.?in|start|begin|continue|enter/i.test(e.label ?? '');
  const isSecondary = e => /sign.?up|create|register|join/i.test(e.label ?? '');
  const isTertiary  = e => /forgot|reset|help|learn/i.test(e.label ?? '');

  const primaryEdges   = outEdges.filter(isPrimary);
  const secondaryEdges = outEdges.filter(e => !isPrimary(e) && isSecondary(e));
  const tertiaryEdges  = outEdges.filter(isTertiary);
  const otherEdges     = outEdges.filter(e => !isPrimary(e) && !isSecondary(e) && !isTertiary(e));

  const primaryBtns = [...primaryEdges, ...otherEdges.splice(0, 1 - primaryEdges.length)]
    .map(e => `<button type="button" class="btn btn-primary btn-lg w-100" onclick="${goToFn(e)}()">${escHtml(edgeBtnLabel(e, nodes))}</button>`)
    .join('\n          ');

  const secondaryBtns = [...secondaryEdges, ...otherEdges]
    .map(e => `<button type="button" class="btn btn-outline-secondary btn-lg w-100" onclick="${goToFn(e)}()">${escHtml(edgeBtnLabel(e, nodes))}</button>`)
    .join('\n          ');

  const tertiaryLinks = tertiaryEdges
    .map(e => `<a href="#" onclick="event.preventDefault();${goToFn(e)}()" class="text-muted small text-decoration-none">${escHtml(edgeBtnLabel(e, nodes))}</a>`)
    .join(' &nbsp;·&nbsp; ');

  const fallback = outEdges.length === 0
    ? `<p class="text-muted fst-italic">No paths configured yet.</p>`
    : '';

  return `<div class="pw-lobby text-center py-4 py-md-5">
    <div class="pw-lobby-icon mb-4" aria-hidden="true">
      <div class="d-inline-flex align-items-center justify-content-center rounded-4 pw-lobby-icon-bg"
           style="width:88px;height:88px;font-size:2.6rem;
                  background:linear-gradient(135deg,var(--pw-cyan,#2aa198),var(--pw-blue,#268bd2))">
        ${icon}
      </div>
    </div>
    <h1 class="display-6 fw-bold mb-2">${title}</h1>
    ${tagline ? `<p class="text-muted mb-5 mx-auto" style="max-width:360px">${tagline}</p>` : '<div class="mb-5"></div>'}
    <div class="d-grid gap-3 mx-auto" style="max-width:320px">
      ${primaryBtns}
      ${secondaryBtns}
      ${fallback}
    </div>
    ${tertiaryLinks ? `<p class="mt-4 mb-0">${tertiaryLinks}</p>` : ''}
  </div>`;
}

// ── Blank page (runtime-rendered) ────────────────────────────────────────────
// Generates a minimal shell with #pw-content inside #pw-form.
// Use with render.* Savant actions to build the page content at runtime.
// The form wrapper enables Bootstrap validation via form.validate('#pw-form').

export function blankPageHTML(node = {}) {
  const title = escHtml(node.label ?? 'Page');
  return `<form id="pw-form" novalidate onsubmit="event.preventDefault()">
      <div id="pw-content" aria-label="${title} content">
        <!-- Built at runtime by render.* Savant actions in onEnter -->
      </div>
    </form>`;
}

// ── Template registry ─────────────────────────────────────────────────────────

/** Map template key → template function. */
export const BUILT_IN_TEMPLATES = {
  'lobby':         (node, outEdges, nodes) => lobbyHTML(node, outEdges, nodes),
  'blank':         (node) => blankPageHTML(node),
  'login-form':    (node, outEdges) => loginFormHTML(node, outEdges),
  'forgot-form':   (node, outEdges) => forgotFormHTML(node, outEdges),
  'signup-form':   (node, outEdges) => signupFormHTML(node, outEdges),
  'success':       (node, outEdges) => successHTML(node),
  'error':         (node, outEdges) => errorHTML(node, outEdges),
  'submit-review': (node, outEdges) => submitReviewHTML(node, outEdges),
};
