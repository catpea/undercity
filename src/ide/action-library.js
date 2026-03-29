/**
 * action-library.js
 *
 * Declarative catalogue of every built-in Savant action.
 * Each entry describes how to render the action card and its param editor.
 *
 * Shape:
 *   category → { label, icon, color, actions: { id → ActionDef } }
 *              icon is a Bootstrap icon file name without the .svg extension
 *
 * ActionDef:
 *   label   — human-readable name
 *   desc    — one-liner description shown on the card
 *   params  — ordered array of ParamDef
 *   runtime — string of JS executed at page-runtime (for code-gen doc)
 *
 * ParamDef:
 *   name, label, type, default?, placeholder?, options?
 *   type: text | code | select | room | boolean | number | json | textarea
 */

export const ACTION_LIBRARY = {

  // ── Navigation ─────────────────────────────────────────────────────────────
  navigation: {
    label: 'Navigation',
    icon:  'signpost',
    color: 'var(--sol-blue)',
    actions: {

      'nav.goto': {
        label:   'Go To Room',
        desc:    'Navigate the user to another room in the flow.',
        params: [
          { name: 'target',    label: 'Room',  type: 'room', placeholder: 'room-id' },
        ],
      },
      'nav.back': {
        label:  'Go Back',
        desc:   'Return to the previous room (browser history).',
        params: [],
      },
      'nav.reset': {
        label:  'Reset Flow',
        desc:   'Clear inventory and return the user to the Lobby.',
        params: [],
      },
      'nav.reload': {
        label:  'Reload Page',
        desc:   'Hard-reload the current room.',
        params: [],
      },
      'nav.redirect': {
        label:  'Redirect URL',
        desc:   'Navigate to an absolute or relative URL.',
        params: [
          { name: 'url',    label: 'URL',       type: 'text',    placeholder: 'https://…' },
          { name: 'target', label: 'Open in',   type: 'select',  options: ['_self','_blank'], default: '_self' },
        ],
      },

    },
  },

  // ── User / Inventory ─────────────────────────────────────────────────────
  user: {
    label: 'User',
    icon:  'backpack',
    color: 'var(--sol-cyan)',
    actions: {

      'user.set': {
        label:  'Set Inventory Item',
        desc:   'Store a key/value in the user\'s inventory.',
        params: [
          { name: 'key',   label: 'Key',   type: 'text',  placeholder: 'myKey' },
          { name: 'value', label: 'Value', type: 'code',  placeholder: '"hello" or inventory.email' },
        ],
      },
      'user.get': {
        label:  'Read Inventory Item',
        desc:   'Read a value from inventory when this step runs. Save it under a different key (alias) using "Save as".',
        params: [
          { name: 'key',  label: 'Key',      type: 'text', placeholder: 'myKey' },
          { name: 'into', label: 'Save as', type: 'text', placeholder: 'localAlias' },
        ],
      },
      'user.merge': {
        label:  'Merge into Inventory',
        desc:   'Merge an object (e.g., API response) into the user inventory.',
        params: [
          { name: 'from', label: 'From variable', type: 'text', placeholder: 'responseVar' },
        ],
      },
      'user.delete': {
        label:  'Delete Inventory Item',
        desc:   'Remove a key from the user\'s inventory.',
        params: [
          { name: 'key', label: 'Key', type: 'text' },
        ],
      },
      'user.clear': {
        label:  'Clear Inventory',
        desc:   'Wipe everything the user carries.',
        params: [],
      },
      'user.carry': {
        label:  'Carry Form Result',
        desc:   'Serialize a form into inventory so the user carries the answers.',
        params: [
          { name: 'formSelector', label: 'Form',      type: 'text',    placeholder: '#my-form' },
          { name: 'namespace',    label: 'Namespace', type: 'text',    placeholder: 'loginForm', default: '' },
        ],
      },
      'user.check': {
        label:  'Check Condition',
        desc:   'Evaluate a JS expression against inventory. Branch via diamond.',
        params: [
          { name: 'expr',  label: 'Expression', type: 'code',    placeholder: 'inventory.age >= 18' },
          { name: 'into',  label: 'Save as',   type: 'text',    placeholder: 'isAdult' },
        ],
      },
      'user.dump': {
        label:  'Dump Inventory to Console',
        desc:   'console.log the full user inventory (debug).',
        params: [],
      },

    },
  },

  // ── DOM ────────────────────────────────────────────────────────────────────
  dom: {
    label: 'DOM',
    icon:  'image',
    color: 'var(--sol-green)',
    actions: {

      'dom.show': {
        label:  'Show Element',
        desc:   'Remove d-none / display:none from matching elements.',
        params: [{ name: 'selector', label: 'Selector', type: 'text', placeholder: '#my-div' }],
      },
      'dom.hide': {
        label:  'Hide Element',
        desc:   'Add d-none class to matching elements.',
        params: [{ name: 'selector', label: 'Selector', type: 'text', placeholder: '#my-div' }],
      },
      'dom.toggle': {
        label:  'Toggle Visibility',
        desc:   'Toggle d-none on matching elements.',
        params: [{ name: 'selector', label: 'Selector', type: 'text' }],
      },
      'dom.setText': {
        label:  'Set Text',
        desc:   'Set the textContent of matching elements.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text', placeholder: '#my-label' },
          { name: 'text',     label: 'Text',     type: 'code', placeholder: 'inventory.firstName' },
        ],
      },
      'dom.setHtml': {
        label:  'Set Inner HTML',
        desc:   'Set innerHTML of matching elements.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text' },
          { name: 'html',     label: 'HTML',     type: 'textarea' },
        ],
      },
      'dom.setAttr': {
        label:  'Set Attribute',
        desc:   'Set an attribute on matching elements.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text' },
          { name: 'attr',     label: 'Attribute',type: 'text', placeholder: 'src' },
          { name: 'value',    label: 'Value',    type: 'code', placeholder: '"https://…"' },
        ],
      },
      'dom.addClass': {
        label:  'Add Class',
        desc:   'Add one or more CSS classes.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text' },
          { name: 'classes',  label: 'Classes',  type: 'text', placeholder: 'is-active text-info' },
        ],
      },
      'dom.removeClass': {
        label:  'Remove Class',
        desc:   'Remove one or more CSS classes.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text' },
          { name: 'classes',  label: 'Classes',  type: 'text' },
        ],
      },
      'dom.toggleClass': {
        label:  'Toggle Class',
        desc:   'Toggle a CSS class on matching elements.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text' },
          { name: 'class',    label: 'Class',    type: 'text' },
        ],
      },
      'dom.setStyle': {
        label:  'Set Inline Style',
        desc:   'Set a CSS property directly.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text' },
          { name: 'prop',     label: 'Property', type: 'text', placeholder: 'color' },
          { name: 'value',    label: 'Value',    type: 'text', placeholder: '#268bd2' },
        ],
      },
      'dom.scroll': {
        label:  'Scroll To Element',
        desc:   'Smoothly scroll the selector into view.',
        params: [
          { name: 'selector', label: 'Selector', type: 'text' },
          { name: 'block',    label: 'Position', type: 'select', options: ['start','center','end','nearest'], default: 'start' },
        ],
      },
      'dom.focus': {
        label:  'Focus Element',
        desc:   'Move keyboard focus to a selector.',
        params: [{ name: 'selector', label: 'Selector', type: 'text' }],
      },

    },
  },

  // ── Input Prompts ──────────────────────────────────────────────────────────
  input: {
    label: 'Input Prompts',
    icon:  'pencil-square',
    color: 'var(--sol-orange)',
    actions: {

      'input.askText': {
        label:  'Ask for Text Input',
        desc:   'Show a modal prompting the user to type text. Waits for confirmation, then automatically saves the typed value to inventory under the key you specify in "Save as".',
        params: [
          { name: 'label',       label: 'Prompt label',  type: 'text',    placeholder: 'Your name' },
          { name: 'placeholder', label: 'Placeholder',   type: 'text',    placeholder: 'Type here…' },
          { name: 'into',        label: 'Save as',  type: 'text',    placeholder: 'userName' },
          { name: 'multiline',   label: 'Multiline',     type: 'boolean', default: false },
        ],
      },
      'input.askNumber': {
        label:  'Ask for Number',
        desc:   'Show a modal with a numeric input. Waits for confirmation, then automatically saves the number to inventory under the key you specify in "Save as".',
        params: [
          { name: 'label', label: 'Prompt label', type: 'text',   placeholder: 'Age' },
          { name: 'min',   label: 'Min',          type: 'number', default: 0 },
          { name: 'max',   label: 'Max',          type: 'number', default: 999 },
          { name: 'into',  label: 'Save as', type: 'text' },
        ],
      },
      'input.askEmail': {
        label:  'Ask for Email',
        desc:   'Show a modal with an email-validated input. Waits for confirmation, then automatically saves the email to inventory under the key you specify in "Save as".',
        params: [
          { name: 'label', label: 'Prompt label', type: 'text',   placeholder: 'Your email' },
          { name: 'into',  label: 'Save as', type: 'text',   placeholder: 'email' },
        ],
      },
      'input.askPassword': {
        label:  'Ask for Password',
        desc:   'Show a masked password input modal. Waits for confirmation, then automatically saves the value to inventory under the key you specify in "Save as".',
        params: [
          { name: 'label', label: 'Prompt label', type: 'text',   placeholder: 'Enter password' },
          { name: 'into',  label: 'Save as', type: 'text',   placeholder: 'password' },
        ],
      },
      'input.askDate': {
        label:  'Ask for Date',
        desc:   'Show a date-picker modal. Waits for confirmation, then automatically saves the selected date to inventory under the key you specify in "Save as".',
        params: [
          { name: 'label', label: 'Prompt label', type: 'text',   placeholder: 'Select a date' },
          { name: 'into',  label: 'Save as', type: 'text',   placeholder: 'selectedDate' },
        ],
      },
      'input.askChoice': {
        label:  'Ask for Choice',
        desc:   'Present a list of options as radio buttons. Waits for a selection, then automatically saves the chosen value to inventory under the key you specify in "Save as".',
        params: [
          { name: 'label',   label: 'Prompt label', type: 'text',     placeholder: 'Choose one' },
          { name: 'options', label: 'Options (CSV)', type: 'text',     placeholder: 'Red,Green,Blue' },
          { name: 'into',    label: 'Save as',  type: 'text' },
        ],
      },
      'input.askConfirm': {
        label:  'Ask for Confirmation',
        desc:   'Show a yes/no confirmation dialog. Automatically saves true or false to inventory under the key you specify in "Save as".',
        params: [
          { name: 'message', label: 'Message',     type: 'text', placeholder: 'Are you sure?' },
          { name: 'into',    label: 'Save as',type: 'text', placeholder: 'confirmed' },
        ],
      },

    },
  },

  // ── Media / File Upload ────────────────────────────────────────────────────
  media: {
    label: 'Media & Upload',
    icon:  'film',
    color: 'var(--sol-magenta)',
    actions: {

      'media.askVideoUpload': {
        label:  'Ask for Video Upload',
        desc:   'Open file picker for a video. Optionally extract a preview thumbnail frame.',
        params: [
          { name: 'label',           label: 'Prompt label',     type: 'text',    placeholder: 'Select a video' },
          { name: 'accept',          label: 'Accept types',      type: 'text',    placeholder: 'video/*', default: 'video/*' },
          { name: 'thumbnailPrompt', label: 'Thumbnail prompt',  type: 'text',    placeholder: 'Select a frame as thumbnail', default: 'Select a frame that serves as a good preview thumbnail' },
          { name: 'extractThumb',    label: 'Extract thumbnail', type: 'boolean', default: true },
          { name: 'into',            label: 'Save as',      type: 'text',    placeholder: 'uploadedVideo' },
        ],
      },
      'media.askImageUpload': {
        label:  'Ask for Image Upload',
        desc:   'Open file picker for an image. Preview before accepting.',
        params: [
          { name: 'label',   label: 'Prompt label',   type: 'text',    placeholder: 'Upload an image' },
          { name: 'accept',  label: 'Accept',          type: 'text',    placeholder: 'image/*', default: 'image/*' },
          { name: 'preview', label: 'Show preview',    type: 'boolean', default: true },
          { name: 'into',    label: 'Save as',    type: 'text',    placeholder: 'uploadedImage' },
        ],
      },
      'media.askFileUpload': {
        label:  'Ask for File Upload',
        desc:   'Open generic file picker. Stores file metadata in inventory.',
        params: [
          { name: 'label',    label: 'Prompt label', type: 'text',    placeholder: 'Upload a file' },
          { name: 'accept',   label: 'Accept',        type: 'text',    placeholder: '*/*' },
          { name: 'multiple', label: 'Multiple',      type: 'boolean', default: false },
          { name: 'into',     label: 'Save as',  type: 'text',    placeholder: 'uploadedFile' },
        ],
      },
      'media.askAudioUpload': {
        label:  'Ask for Audio Upload',
        desc:   'Open file picker for audio. Shows waveform preview.',
        params: [
          { name: 'label',   label: 'Prompt label', type: 'text',    placeholder: 'Upload audio' },
          { name: 'accept',  label: 'Accept',        type: 'text',    default: 'audio/*' },
          { name: 'into',    label: 'Save as',  type: 'text',    placeholder: 'audioFile' },
        ],
      },
      'media.captureWebcam': {
        label:  'Capture from Webcam',
        desc:   'Ask camera permission and capture a still photo.',
        params: [
          { name: 'label', label: 'Prompt label', type: 'text', placeholder: 'Take a photo' },
          { name: 'into',  label: 'Save as', type: 'text', placeholder: 'photo' },
        ],
      },

    },
  },

  // ── HTTP ───────────────────────────────────────────────────────────────────
  http: {
    label: 'HTTP',
    icon:  'globe',
    color: 'var(--sol-violet)',
    actions: {

      'http.get': {
        label:  'HTTP GET',
        desc:   'Fetch JSON from a URL. Stores response in inventory.',
        params: [
          { name: 'url',  label: 'URL',       type: 'code', placeholder: '"/api/user"' },
          { name: 'into', label: 'Save as',  type: 'text', placeholder: 'result' },
        ],
      },
      'http.post': {
        label:  'HTTP POST',
        desc:   'POST JSON body to a URL.',
        params: [
          { name: 'url',  label: 'URL',      type: 'code',     placeholder: '"/api/login"' },
          { name: 'body', label: 'Body',     type: 'code',     placeholder: '{ email, password }' },
          { name: 'into', label: 'Save as', type: 'text',     placeholder: 'result' },
        ],
      },
      'http.put': {
        label:  'HTTP PUT',
        desc:   'PUT JSON body to a URL.',
        params: [
          { name: 'url',  label: 'URL',      type: 'code' },
          { name: 'body', label: 'Body',     type: 'code' },
          { name: 'into', label: 'Save as', type: 'text' },
        ],
      },
      'http.delete': {
        label:  'HTTP DELETE',
        desc:   'Send a DELETE request.',
        params: [
          { name: 'url',  label: 'URL',      type: 'code' },
          { name: 'into', label: 'Save as', type: 'text' },
        ],
      },
      'http.upload': {
        label:  'Upload File (multipart)',
        desc:   'POST a file from inventory as multipart/form-data.',
        params: [
          { name: 'url',      label: 'URL',         type: 'code' },
          { name: 'fileVar',  label: 'File var',    type: 'text', placeholder: 'uploadedVideo' },
          { name: 'fieldName',label: 'Field name',  type: 'text', placeholder: 'file' },
          { name: 'into',     label: 'Save as',    type: 'text', placeholder: 'uploadResult' },
        ],
      },

    },
  },

  // ── UI Feedback ────────────────────────────────────────────────────────────
  ui: {
    label: 'UI Feedback',
    icon:  'chat-dots',
    color: 'var(--sol-orange)',
    actions: {

      'ui.toast': {
        label:  'Show Toast',
        desc:   'Show a transient notification overlay.',
        params: [
          { name: 'msg',  label: 'Message', type: 'text' },
          { name: 'type', label: 'Type',    type: 'select', options: ['info','success','warning','danger'], default: 'info' },
        ],
      },
      'ui.loading': {
        label:  'Loading Spinner',
        desc:   'Show or hide a full-screen loading overlay.',
        params: [
          { name: 'show', label: 'Visible', type: 'boolean', default: true },
        ],
      },
      'ui.modal': {
        label:  'Show Modal',
        desc:   'Open a named Bootstrap modal by selector.',
        params: [
          { name: 'selector', label: 'Modal selector', type: 'text', placeholder: '#my-modal' },
        ],
      },
      'ui.hideModal': {
        label:  'Hide Modal',
        desc:   'Close a named Bootstrap modal.',
        params: [
          { name: 'selector', label: 'Modal selector', type: 'text' },
        ],
      },
      'ui.progress': {
        label:  'Set Progress Bar',
        desc:   'Update a Bootstrap progress bar by selector.',
        params: [
          { name: 'selector', label: 'Progress bar', type: 'text', placeholder: '#my-progress' },
          { name: 'value',    label: 'Value 0–100',  type: 'number', default: 0 },
        ],
      },
      'ui.badge': {
        label:  'Set Badge',
        desc:   'Update text content of a badge element.',
        params: [
          { name: 'selector', label: 'Badge selector', type: 'text' },
          { name: 'text',     label: 'Text',           type: 'code' },
        ],
      },
      'ui.accordion': {
        label:  'Toggle Accordion',
        desc:   'Open or close a Bootstrap accordion item.',
        params: [
          { name: 'selector', label: 'Item selector', type: 'text' },
          { name: 'show',     label: 'Show',          type: 'boolean', default: true },
        ],
      },
      'ui.collapse': {
        label:  'Toggle Collapse',
        desc:   'Show or hide a Bootstrap collapse component.',
        params: [
          { name: 'selector', label: 'Target',  type: 'text' },
          { name: 'show',     label: 'Show',    type: 'boolean', default: true },
        ],
      },
      'ui.tooltip': {
        label:  'Show Tooltip',
        desc:   'Programmatically show a Bootstrap tooltip.',
        params: [
          { name: 'selector', label: 'Target', type: 'text' },
        ],
      },

    },
  },

  // ── Events ─────────────────────────────────────────────────────────────────
  events: {
    label: 'Events',
    icon:  'broadcast',
    color: 'var(--sol-cyan)',
    actions: {

      'event.emit': {
        label:  'Emit Event',
        desc:   'Broadcast a named event on the flow event bus.',
        params: [
          { name: 'event', label: 'Event name', type: 'text', placeholder: 'user-ready' },
          { name: 'data',  label: 'Payload',    type: 'code', placeholder: '{ id: inventory.userId }' },
        ],
      },
      'event.on': {
        label:  'Listen for Event',
        desc:   'Register a handler for an event. Auto-unsubscribed on room exit.',
        params: [
          { name: 'event',   label: 'Event name', type: 'text' },
          { name: 'handler', label: 'Handler fn', type: 'code', placeholder: '(data) => { /* ... */ }' },
        ],
      },
      'event.waitFor': {
        label:  'Wait For Event',
        desc:   'Pause flow until a named event fires (returns a Promise).',
        params: [
          { name: 'event',   label: 'Event name',  type: 'text' },
          { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 0 },
          { name: 'into',    label: 'Save as',     type: 'text' },
        ],
      },

    },
  },

  // ── Logic ──────────────────────────────────────────────────────────────────
  logic: {
    label: 'Logic',
    icon:  'gear',
    color: 'var(--sol-yellow)',
    actions: {

      'logic.if': {
        label:  'If / Else',
        desc:   'Conditionally run a block of steps.',
        params: [
          { name: 'condition', label: 'Condition',   type: 'code', placeholder: 'inventory.age >= 18' },
          { name: 'then',      label: 'Then room', type: 'room' },
          { name: 'else',      label: 'Else room', type: 'room' },
        ],
      },
      'logic.delay': {
        label:  'Delay',
        desc:   'Pause execution for N milliseconds.',
        params: [
          { name: 'ms', label: 'Milliseconds', type: 'number', default: 500 },
        ],
      },
      'logic.log': {
        label:  'Log to Console',
        desc:   'console.log a message or expression.',
        params: [
          { name: 'msg', label: 'Message / expr', type: 'code', placeholder: '"Value: " + inventory.myKey' },
        ],
      },
      'logic.transform': {
        label:  'Transform Value',
        desc:   'Evaluate a JS expression and store the result.',
        params: [
          { name: 'expr', label: 'Expression', type: 'code', placeholder: 'inventory.items.length' },
          { name: 'into', label: 'Save as',   type: 'text', placeholder: 'itemCount' },
        ],
      },
      'logic.random': {
        label:  'Random Number',
        desc:   'Store a random number (integer or float) in inventory.',
        params: [
          { name: 'min',   label: 'Min',         type: 'number', default: 0 },
          { name: 'max',   label: 'Max',         type: 'number', default: 100 },
          { name: 'int',   label: 'Integer',     type: 'boolean', default: true },
          { name: 'into',  label: 'Save as',    type: 'text',    placeholder: 'rng' },
        ],
      },

    },
  },

  // ── Page Builder (render.*) ───────────────────────────────────────────────
  // Creates and appends UI elements to #pw-content at runtime.
  // Use on rooms with template: "blank" to build the page from the Savant.
  // Elements are appended in the order the steps run; call render.clear first
  // on onEnter to rebuild on each visit.
  render: {
    label: 'Page Builder',
    icon:  'layout-text-window',
    color: 'var(--sol-violet)',
    actions: {

      'render.clear': {
        label:  'Clear Page',
        desc:   'Empty #pw-content. Put this first in onEnter to rebuild on each visit.',
        params: [],
      },
      'render.title': {
        label:  'Page Title',
        desc:   'Append a heading to the page content area.',
        params: [
          { name: 'text',  label: 'Title text', type: 'text',   placeholder: 'Sign In' },
          { name: 'size',  label: 'Size',       type: 'select', options: ['h1','h2','h3','h4'], default: 'h2' },
        ],
      },
      'render.subtitle': {
        label:  'Subtitle',
        desc:   'Append a muted subtitle paragraph.',
        params: [
          { name: 'text', label: 'Text', type: 'text', placeholder: 'Welcome back. Enter your credentials.' },
        ],
      },
      'render.paragraph': {
        label:  'Paragraph',
        desc:   'Append a styled paragraph of text.',
        params: [
          { name: 'text',  label: 'Text',  type: 'textarea', placeholder: 'Body copy…' },
          { name: 'style', label: 'Style', type: 'select', options: ['muted','info','success','warning','danger','body'], default: 'muted' },
        ],
      },
      'render.field': {
        label:  'Text Input',
        desc:   'Append a labelled input field. The value is read by name when the form is serialized.',
        params: [
          { name: 'name',         label: 'Field name',   type: 'text',    placeholder: 'email' },
          { name: 'label',        label: 'Label',        type: 'text',    placeholder: 'Email Address' },
          { name: 'type',         label: 'Input type',   type: 'select',  options: ['text','email','password','tel','url','number','date','search','textarea'], default: 'text' },
          { name: 'placeholder',  label: 'Placeholder',  type: 'text',    placeholder: 'you@example.com' },
          { name: 'autocomplete', label: 'Autocomplete', type: 'text',    placeholder: 'email', default: '' },
          { name: 'required',     label: 'Required',     type: 'boolean', default: true },
        ],
      },
      'render.textarea': {
        label:  'Multiline Text',
        desc:   'Append a multi-line textarea field. Value is collected by name on form serialization.',
        params: [
          { name: 'name',        label: 'Field name',  type: 'text',    placeholder: 'bio' },
          { name: 'label',       label: 'Label',       type: 'text',    placeholder: 'About you' },
          { name: 'placeholder', label: 'Placeholder', type: 'text',    placeholder: 'Tell us about yourself…' },
          { name: 'rows',        label: 'Rows',        type: 'number',  default: 4 },
          { name: 'required',    label: 'Required',    type: 'boolean', default: false },
        ],
      },
      'render.select': {
        label:  'Dropdown',
        desc:   'Append a <select> dropdown. Options are a comma-separated list.',
        params: [
          { name: 'name',     label: 'Field name', type: 'text',    placeholder: 'country' },
          { name: 'label',    label: 'Label',      type: 'text',    placeholder: 'Country' },
          { name: 'options',  label: 'Options (CSV)', type: 'text', placeholder: 'USA,Canada,UK' },
          { name: 'default',  label: 'Default',    type: 'text',    placeholder: 'USA', default: '' },
          { name: 'required', label: 'Required',   type: 'boolean', default: false },
        ],
      },
      'render.checkbox': {
        label:  'Checkbox',
        desc:   'Append a Bootstrap checkbox. Value is true/false when serialized.',
        params: [
          { name: 'name',    label: 'Field name', type: 'text',    placeholder: 'agreeTerms' },
          { name: 'label',   label: 'Label',      type: 'text',    placeholder: 'I agree to the terms' },
          { name: 'checked', label: 'Checked by default', type: 'boolean', default: false },
          { name: 'required', label: 'Required',  type: 'boolean', default: false },
        ],
      },
      'render.alert': {
        label:  'Alert Box',
        desc:   'Append a hidden Bootstrap alert (show via display.text or form errors).',
        params: [
          { name: 'id',   label: 'Element ID', type: 'text',   placeholder: 'login-alert' },
          { name: 'type', label: 'Type',       type: 'select', options: ['danger','warning','info','success'], default: 'danger' },
          { name: 'text', label: 'Initial text (leave blank to hide)', type: 'text', default: '' },
        ],
      },
      'render.button': {
        label:  'Button',
        desc:   'Append a button that navigates to a room (runs onExit first).',
        params: [
          { name: 'label',   label: 'Label',   type: 'text',    placeholder: 'Sign In' },
          { name: 'target',  label: 'Room', type: 'room', placeholder: 'auth-check' },
          { name: 'variant', label: 'Style',   type: 'select',  options: ['primary','secondary','outline-secondary','outline-info','danger','success'], default: 'primary' },
          { name: 'full',    label: 'Full width', type: 'boolean', default: true },
        ],
      },
      'render.link': {
        label:  'Link / Text Link',
        desc:   'Append a small centred text link that navigates to a room.',
        params: [
          { name: 'text',   label: 'Link text', type: 'text',    placeholder: 'Forgot password?' },
          { name: 'target', label: 'Room',   type: 'room', placeholder: 'forgot' },
          { name: 'prefix', label: 'Prefix text (optional)', type: 'text', default: '' },
        ],
      },
      'render.section': {
        label:  'Section Header',
        desc:   'Append a small uppercase section divider label.',
        params: [
          { name: 'title', label: 'Title', type: 'text', placeholder: 'Personal Details' },
        ],
      },
      'render.divider': {
        label:  'Card Divider',
        desc:   'Close the current card and start a new one. Breaks the form into distinct visual sections.',
        params: [],
      },
      'render.markdown': {
        label:  'Markdown Block',
        desc:   'Append a rendered Markdown block to the page.',
        params: [
          { name: 'content', label: 'Markdown', type: 'textarea', placeholder: '**Bold** and _italic_…' },
        ],
      },

    },
  },

  // ── Display / Print ───────────────────────────────────────────────────────
  // Writes content into existing elements already on the page.
  // Use these to show feedback, labels, results — not to build structure.
  display: {
    label: 'Display',
    icon:  'type',
    color: 'var(--sol-cyan)',
    actions: {

      'display.text': {
        label:  'Print Text',
        desc:   'Set plain text content inside a selector. Safe — no HTML interpretation.',
        params: [
          { name: 'selector', label: 'Target selector', type: 'text',     placeholder: '#my-label' },
          { name: 'text',     label: 'Text',            type: 'code',     placeholder: '"Hello " + inventory.firstName' },
        ],
      },
      'display.markdown': {
        label:  'Print Markdown',
        desc:   'Render a Markdown string as HTML inside a selector.',
        params: [
          { name: 'selector', label: 'Target selector', type: 'text',     placeholder: '#my-area' },
          { name: 'content',  label: 'Markdown',        type: 'textarea', placeholder: '**Bold** and _italic_' },
        ],
      },
      'display.safeHtml': {
        label:  'Print Safe HTML',
        desc:   'Sanitize and inject HTML — script/event attributes stripped.',
        params: [
          { name: 'selector', label: 'Target selector', type: 'text',     placeholder: '#my-area' },
          { name: 'html',     label: 'HTML',            type: 'textarea', placeholder: '<b>Bold</b>' },
        ],
      },
      'display.rawHtml': {
        label:  'Print Raw HTML',
        desc:   'Inject trusted HTML directly (no sanitization). Use only with controlled content.',
        params: [
          { name: 'selector', label: 'Target selector', type: 'text',     placeholder: '#my-area' },
          { name: 'html',     label: 'HTML',            type: 'textarea', placeholder: '<b>Trusted HTML</b>' },
        ],
      },
      'display.clear': {
        label:  'Clear Content',
        desc:   'Empty the innerHTML of a selector.',
        params: [
          { name: 'selector', label: 'Target selector', type: 'text', placeholder: '#my-area' },
        ],
      },
      'display.value': {
        label:  'Show Inventory Value',
        desc:   'Print an inventory key\'s value as text into a selector.',
        params: [
          { name: 'selector', label: 'Target selector', type: 'text', placeholder: '#name-label' },
          { name: 'key',      label: 'Inventory key',   type: 'text', placeholder: 'firstName' },
        ],
      },

    },
  },

  // ── Session / Storage ──────────────────────────────────────────────────────
  session: {
    label: 'Session',
    icon:  'floppy',
    color: 'var(--sol-base1)',
    actions: {

      'session.save': {
        label:  'Save to Session',
        desc:   'Persist a value to sessionStorage.',
        params: [
          { name: 'key',   label: 'Key',   type: 'text' },
          { name: 'value', label: 'Value', type: 'code' },
        ],
      },
      'session.load': {
        label:  'Load from Session',
        desc:   'Read a value from sessionStorage into inventory.',
        params: [
          { name: 'key',  label: 'Key',      type: 'text' },
          { name: 'into', label: 'Save as', type: 'text' },
        ],
      },
      'session.local': {
        label:  'Save to localStorage',
        desc:   'Persist a value across browser sessions.',
        params: [
          { name: 'key',   label: 'Key',   type: 'text' },
          { name: 'value', label: 'Value', type: 'code' },
        ],
      },
      'session.clear': {
        label:  'Clear Session',
        desc:   'Remove all Undercity keys from sessionStorage.',
        params: [],
      },

    },
  },

  // ── Room ───────────────────────────────────────────────────────────────────
  room: {
    label: 'Room',
    icon:  'broadcast',
    color: 'var(--sol-orange)',
    actions: {

      'room.emit': {
        label:  'Emit Room Event',
        desc:   'Broadcast a named event in the current room. All listening workflows and Things will receive it.',
        params: [
          { name: 'event', label: 'Event name', type: 'text', placeholder: 'completedEnterAction' },
          { name: 'data',  label: 'Data (JSON)', type: 'json', default: '{}' },
        ],
      },

    },
  },

};

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Flat list of all actions with their category metadata attached. */
export function flatActions() {
  const out = [];
  for (const [catId, cat] of Object.entries(ACTION_LIBRARY)) {
    for (const [actionId, def] of Object.entries(cat.actions)) {
      out.push({ catId, actionId, catLabel: cat.label, catColor: cat.color, ...def });
    }
  }
  return out;
}

/** Find an action definition by actionId. */
export function findAction(actionId) {
  for (const cat of Object.values(ACTION_LIBRARY)) {
    if (cat.actions[actionId]) return cat.actions[actionId];
  }
  return null;
}
