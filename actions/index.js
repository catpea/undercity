/**
 * actions/index.js — Master action plugin loader for Undercity 2.
 *
 * TWO CATEGORIES, period:
 *   1. Room  — core room behaviours (pinned to top; room functionality is foundational)
 *   2. Input — 18 smart inline form inputs, each reactively bound to Inventory
 *
 * Architecture: each category is a plugin with install(app).
 * App.use(ActionsPlugin) → installs sub-plugins → savant.registerCategory().
 *
 * AI-generated actions go into the correct category (by ID prefix) with a
 * visual marker so the user can tell them apart from built-in actions.
 */

export const ActionsPlugin = {
  name: 'undercity/actions',
  install(app) {
    app.use(RoomPlugin);
    app.use(InputPlugin);
  },
};

// ── Room ──────────────────────────────────────────────────────────────────────
// Core room behaviours. Pinned to top because room functionality is the
// foundation of every Undercity flow.

export const RoomPlugin = {
  name: 'actions/room',
  install(app) { app.registerActions('room', ROOM_CATEGORY); },
};

const ROOM_CATEGORY = {
  label: 'Room',
  icon:  'broadcast',
  color: 'var(--sol-orange)',
  actions: {
    'room.emit': {
      label: 'Emit Room Event',
      desc:  'Broadcast a named event inside this room. All Things inhabiting the room hear it immediately and can react.',
      params: [
        { name: 'event', label: 'Event name', type: 'text', placeholder: 'message' },
        { name: 'data',  label: 'Data',       type: 'json', default: '{}' },
      ],
    },
    'room.showNav': {
      label: 'Show Navigation Buttons',
      desc:  'Render Bootstrap navigation buttons for every room connected from this one. Clicking a button runs this room\'s onExit then moves the user forward.',
      params: [
        { name: 'variant', label: 'Button style', type: 'select', options: ['primary', 'outline-info', 'secondary', 'outline-secondary', 'success', 'outline-primary'], default: 'primary' },
        { name: 'full',    label: 'Full width',   type: 'boolean', default: true },
      ],
    },
    'room.take': {
      label: 'Take Form',
      desc:  'Package all input fields in this room into a single inventory item. The user picks it up and carries it to the next room — like filling out a paper form and putting it in your bag.',
      params: [
        { name: 'into', label: 'Carry as', type: 'text', placeholder: 'loginForm' },
      ],
    },
  },
};

// ── Input ─────────────────────────────────────────────────────────────────────
// 18 smart inline form inputs.
//
// Each input is a standalone program — no shared helpers, no DRY.
// They grow independently. Each renders directly onto the page and reacts
// to Inventory in real time (two-way binding). Use room.take() to collect
// all inputs in a room into one carried item.

export const InputPlugin = {
  name: 'actions/input',
  install(app) { app.registerActions('input', INPUT_CATEGORY); },
};

const INPUT_CATEGORY = {
  label: 'Input',
  icon:  'pencil-square',
  color: 'var(--sol-blue)',
  actions: {

    // ── Text ────────────────────────────────────────────────────────────────

    'input.text': {
      label: 'Ask For Text',
      desc:  'Render a single-line text field on the page. Two-way bound to an inventory key — as the user types, inventory updates instantly.',
      params: [
        { name: 'key',          label: 'Inventory key',  type: 'text',    placeholder: 'firstName' },
        { name: 'label',        label: 'Label',          type: 'text',    placeholder: 'First Name' },
        { name: 'placeholder',  label: 'Placeholder',    type: 'text',    placeholder: 'Type here…' },
        { name: 'required',     label: 'Required',       type: 'boolean', default: false },
        { name: 'autocomplete', label: 'Autocomplete',   type: 'text',    placeholder: 'given-name', default: '' },
        { name: 'spellcheck',   label: 'Spell check',    type: 'boolean', default: false },
      ],
    },

    'input.longText': {
      label: 'Ask For Long Text',
      desc:  'Render a multi-line text area for longer answers, messages, or notes. Two-way bound to an inventory key.',
      params: [
        { name: 'key',         label: 'Inventory key',  type: 'text',    placeholder: 'bio' },
        { name: 'label',       label: 'Label',          type: 'text',    placeholder: 'Tell us about yourself' },
        { name: 'placeholder', label: 'Placeholder',    type: 'text',    placeholder: 'Write here…' },
        { name: 'rows',        label: 'Rows',           type: 'number',  default: 4 },
        { name: 'required',    label: 'Required',       type: 'boolean', default: false },
        { name: 'spellcheck',  label: 'Spell check',    type: 'boolean', default: true },
      ],
    },

    // ── Typed text ──────────────────────────────────────────────────────────

    'input.email': {
      label: 'Ask For Email Address',
      desc:  'Render an email field with built-in format validation and browser autocomplete suggestions. Two-way bound to an inventory key.',
      params: [
        { name: 'key',         label: 'Inventory key',  type: 'text',    placeholder: 'email' },
        { name: 'label',       label: 'Label',          type: 'text',    placeholder: 'Email Address' },
        { name: 'placeholder', label: 'Placeholder',    type: 'text',    placeholder: 'you@example.com' },
        { name: 'required',    label: 'Required',       type: 'boolean', default: true },
      ],
    },

    'input.password': {
      label: 'Ask For Password',
      desc:  'Render a masked password field. Optional strength meter gives the user live feedback as they type. Two-way bound to an inventory key.',
      params: [
        { name: 'key',           label: 'Inventory key',       type: 'text',    placeholder: 'password' },
        { name: 'label',         label: 'Label',               type: 'text',    placeholder: 'Password' },
        { name: 'placeholder',   label: 'Placeholder',         type: 'text',    placeholder: 'Enter password' },
        { name: 'required',      label: 'Required',            type: 'boolean', default: true },
        { name: 'strengthMeter', label: 'Show strength meter', type: 'boolean', default: false },
      ],
    },

    'input.tel': {
      label: 'Ask For Phone Number',
      desc:  'Render a telephone number field with format guidance and mobile-friendly numeric keyboard. Two-way bound to an inventory key.',
      params: [
        { name: 'key',         label: 'Inventory key',  type: 'text',    placeholder: 'phone' },
        { name: 'label',       label: 'Label',          type: 'text',    placeholder: 'Phone Number' },
        { name: 'placeholder', label: 'Placeholder',    type: 'text',    placeholder: '+1 (555) 000-0000' },
        { name: 'pattern',     label: 'Pattern (regex)',type: 'text',    placeholder: '', default: '' },
        { name: 'required',    label: 'Required',       type: 'boolean', default: false },
      ],
    },

    'input.url': {
      label: 'Ask For Web Address',
      desc:  'Render a URL field. The browser validates the format before submission. Two-way bound to an inventory key.',
      params: [
        { name: 'key',         label: 'Inventory key',  type: 'text',    placeholder: 'website' },
        { name: 'label',       label: 'Label',          type: 'text',    placeholder: 'Website' },
        { name: 'placeholder', label: 'Placeholder',    type: 'text',    placeholder: 'https://example.com' },
        { name: 'required',    label: 'Required',       type: 'boolean', default: false },
      ],
    },

    // ── Number ──────────────────────────────────────────────────────────────

    'input.number': {
      label: 'Ask For Number',
      desc:  'Render a numeric field with optional minimum, maximum, and step constraints. Two-way bound to an inventory key.',
      params: [
        { name: 'key',         label: 'Inventory key',  type: 'text',    placeholder: 'age' },
        { name: 'label',       label: 'Label',          type: 'text',    placeholder: 'Age' },
        { name: 'placeholder', label: 'Placeholder',    type: 'text',    placeholder: '25' },
        { name: 'min',         label: 'Minimum',        type: 'number',  default: null },
        { name: 'max',         label: 'Maximum',        type: 'number',  default: null },
        { name: 'step',        label: 'Step',           type: 'number',  default: 1 },
        { name: 'required',    label: 'Required',       type: 'boolean', default: false },
      ],
    },

    'input.range': {
      label: 'Ask For Numeric Range',
      desc:  'Render a slider for choosing a value within a range. Shows the current value as a live read-out beside the slider. Two-way bound to an inventory key.',
      params: [
        { name: 'key',       label: 'Inventory key',    type: 'text',    placeholder: 'quality' },
        { name: 'label',     label: 'Label',            type: 'text',    placeholder: 'Quality (1 – 10)' },
        { name: 'min',       label: 'Minimum',          type: 'number',  default: 0 },
        { name: 'max',       label: 'Maximum',          type: 'number',  default: 100 },
        { name: 'step',      label: 'Step',             type: 'number',  default: 1 },
        { name: 'showValue', label: 'Show current value', type: 'boolean', default: true },
      ],
    },

    // ── Date & time ─────────────────────────────────────────────────────────

    'input.date': {
      label: 'Ask For Date',
      desc:  'Render a calendar date picker. Optional earliest and latest date constraints. Two-way bound to an inventory key.',
      params: [
        { name: 'key',      label: 'Inventory key',  type: 'text',    placeholder: 'birthDate' },
        { name: 'label',    label: 'Label',          type: 'text',    placeholder: 'Date of Birth' },
        { name: 'min',      label: 'Earliest date',  type: 'text',    placeholder: '1900-01-01', default: '' },
        { name: 'max',      label: 'Latest date',    type: 'text',    placeholder: '2099-12-31', default: '' },
        { name: 'required', label: 'Required',       type: 'boolean', default: false },
      ],
    },

    'input.datetimeLocal': {
      label: 'Ask For Date & Time',
      desc:  'Render a combined date and time picker. Two-way bound to an inventory key.',
      params: [
        { name: 'key',      label: 'Inventory key',  type: 'text',    placeholder: 'scheduledAt' },
        { name: 'label',    label: 'Label',          type: 'text',    placeholder: 'Scheduled Date & Time' },
        { name: 'min',      label: 'Earliest',       type: 'text',    placeholder: '', default: '' },
        { name: 'max',      label: 'Latest',         type: 'text',    placeholder: '', default: '' },
        { name: 'required', label: 'Required',       type: 'boolean', default: false },
      ],
    },

    'input.time': {
      label: 'Ask For Time',
      desc:  'Render a time picker (HH:MM). Optional earliest and latest time constraints. Two-way bound to an inventory key.',
      params: [
        { name: 'key',      label: 'Inventory key',  type: 'text',    placeholder: 'appointmentTime' },
        { name: 'label',    label: 'Label',          type: 'text',    placeholder: 'Appointment Time' },
        { name: 'min',      label: 'Earliest time',  type: 'text',    placeholder: '09:00', default: '' },
        { name: 'max',      label: 'Latest time',    type: 'text',    placeholder: '17:00', default: '' },
        { name: 'required', label: 'Required',       type: 'boolean', default: false },
      ],
    },

    'input.month': {
      label: 'Ask For Month',
      desc:  'Render a month-and-year picker. Two-way bound to an inventory key.',
      params: [
        { name: 'key',      label: 'Inventory key',  type: 'text',    placeholder: 'billingMonth' },
        { name: 'label',    label: 'Label',          type: 'text',    placeholder: 'Billing Month' },
        { name: 'required', label: 'Required',       type: 'boolean', default: false },
      ],
    },

    'input.week': {
      label: 'Ask For Week',
      desc:  'Render a week-of-year picker. Two-way bound to an inventory key.',
      params: [
        { name: 'key',      label: 'Inventory key',  type: 'text',    placeholder: 'weekNumber' },
        { name: 'label',    label: 'Label',          type: 'text',    placeholder: 'Select a Week' },
        { name: 'required', label: 'Required',       type: 'boolean', default: false },
      ],
    },

    // ── Visual ──────────────────────────────────────────────────────────────

    'input.color': {
      label: 'Ask For Color',
      desc:  'Render a color swatch picker. The hex value is shown beside the swatch so the user always knows what they picked. Two-way bound to an inventory key.',
      params: [
        { name: 'key',     label: 'Inventory key',  type: 'text', placeholder: 'brandColor' },
        { name: 'label',   label: 'Label',          type: 'text', placeholder: 'Brand Color' },
        { name: 'default', label: 'Default color',  type: 'text', placeholder: '#268bd2', default: '#268bd2' },
      ],
    },

    // ── Choice ──────────────────────────────────────────────────────────────

    'input.checkbox': {
      label: 'Ask With Checkbox',
      desc:  'Render a single checkbox — ideal for "I agree to the Terms of Service" or optional feature toggles. Bound to an inventory key as true or false.',
      params: [
        { name: 'key',      label: 'Inventory key',  type: 'text',    placeholder: 'agreedToTerms' },
        { name: 'label',    label: 'Label',          type: 'text',    placeholder: 'I agree to the Terms of Service' },
        { name: 'required', label: 'Required',       type: 'boolean', default: false },
      ],
    },

    'input.radio': {
      label: 'Ask With Radio Buttons',
      desc:  'Render a group of mutually exclusive radio buttons. The user picks exactly one option. Two-way bound to an inventory key.',
      params: [
        { name: 'key',      label: 'Inventory key',  type: 'text', placeholder: 'plan' },
        { name: 'label',    label: 'Group label',    type: 'text', placeholder: 'Choose a Plan' },
        { name: 'options',  label: 'Options (CSV)',  type: 'text', placeholder: 'Starter,Professional,Enterprise' },
        { name: 'required', label: 'Required',       type: 'boolean', default: false },
      ],
    },

    // ── File ────────────────────────────────────────────────────────────────

    'input.file': {
      label: 'Ask For File',
      desc:  'Render a file picker for any file type. File metadata (name, size, type, url) is stored directly in inventory when the user selects a file.',
      params: [
        { name: 'key',      label: 'Inventory key',   type: 'text',    placeholder: 'document' },
        { name: 'label',    label: 'Label',           type: 'text',    placeholder: 'Upload Document' },
        { name: 'accept',   label: 'Accepted types',  type: 'text',    placeholder: '*/*',       default: '*/*' },
        { name: 'multiple', label: 'Allow multiple',  type: 'boolean', default: false },
        { name: 'required', label: 'Required',        type: 'boolean', default: false },
      ],
    },

    'input.image': {
      label: 'Ask For Image',
      desc:  'Render an image picker with an inline preview so the user can confirm their choice before continuing. Image metadata (name, size, type, url) is stored in inventory.',
      params: [
        { name: 'key',      label: 'Inventory key',   type: 'text',    placeholder: 'profilePhoto' },
        { name: 'label',    label: 'Label',           type: 'text',    placeholder: 'Profile Photo' },
        { name: 'accept',   label: 'Accepted types',  type: 'text',    placeholder: 'image/*',   default: 'image/*' },
        { name: 'required', label: 'Required',        type: 'boolean', default: false },
      ],
    },

  },
};
