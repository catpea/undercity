/**
 * actions/forms/index.js — Forms category plugin
 *
 * Browser-side ES module. Loaded by actions/index.js and installed via App.use().
 * Registers the Forms action category in the Savant, replacing the
 * static definition that used to live in action-library.js.
 *
 * To add a new forms action:
 *   1. Create actions/forms/<actionName>/ with action.json + action.js
 *   2. Add the definition to FORMS_ACTIONS below
 *   3. Add the runtime implementation to src/generator/runtime.js → Actions
 */

export const FormsPlugin = {
  name: 'actions/forms',
  install(app) {
    app.registerActions('forms', FORMS_CATEGORY);
  },
};

const FORMS_CATEGORY = {
  label: 'Forms',
  icon:  'clipboard-check',
  color: 'var(--sol-yellow)',
  actions: {

    'form.getField': {
      label:  'Get Field Value',
      desc:   'Read the current value of a form field once when this step runs. Saves to inventory under the key you specify in "Save as".',
      params: [
        { name: 'name', label: 'Field name', type: 'text',  placeholder: 'email' },
        { name: 'into', label: 'Save as',    type: 'text',  placeholder: 'email' },
      ],
    },

    'form.setField': {
      label:  'Set Field Value',
      desc:   'Set a form field\'s value from an inventory key once when this step runs.',
      params: [
        { name: 'name',  label: 'Field name',   type: 'text',          placeholder: 'email' },
        { name: 'value', label: 'Inventory key', type: 'inventory-key', placeholder: 'userEmail' },
      ],
    },

    'form.bindField': {
      label:  'Bind Field to Inventory',
      desc:   'Synchronize a form field with an inventory key — live and automatic. Sets the field immediately, then keeps both in sync: typing updates inventory, inventory changes update the field.',
      params: [
        { name: 'name', label: 'Field name',   type: 'text',          placeholder: 'email' },
        { name: 'key',  label: 'Inventory key', type: 'inventory-key', placeholder: 'userEmail' },
      ],
    },

    'form.clearField': {
      label:  'Clear Field',
      desc:   'Reset a form field to empty.',
      params: [
        { name: 'name', label: 'Field name', type: 'text' },
      ],
    },

    'form.serialize': {
      label:  'Serialize Form',
      desc:   'Collect all fields of a form into one inventory key as an object.',
      params: [
        { name: 'selector', label: 'Form selector', type: 'text', placeholder: '#my-form' },
        { name: 'into',     label: 'Save as',       type: 'text', placeholder: 'formData' },
      ],
    },

    'form.validate': {
      label:  'Validate Form',
      desc:   'Run HTML5 constraint validation. Marks fields is-valid/is-invalid. Saves true/false to inventory under "Valid? (save as)".',
      params: [
        { name: 'selector', label: 'Form selector',     type: 'text', placeholder: '#my-form' },
        { name: 'into',     label: 'Valid? (save as)',   type: 'text', placeholder: 'isValid' },
      ],
    },

    'form.setError': {
      label:  'Set Field Error',
      desc:   'Show a validation error message under a field using [data-error="name"].',
      params: [
        { name: 'name', label: 'Field name', type: 'text' },
        { name: 'msg',  label: 'Message',    type: 'text' },
      ],
    },

    'form.clearErrors': {
      label:  'Clear All Errors',
      desc:   'Hide all [data-error] elements and remove is-invalid class from all fields.',
      params: [],
    },

    'form.submit': {
      label:  'Submit Form',
      desc:   'Programmatically trigger form submission.',
      params: [
        { name: 'selector', label: 'Form', type: 'text', placeholder: '#my-form' },
      ],
    },

    'form.check': {
      label:  'Get Checkbox / Radio',
      desc:   'Read the checked state of a checkbox or radio group once when this step runs. Saves true/false to inventory under the key you specify in "Save as".',
      params: [
        { name: 'name', label: 'Field name', type: 'text' },
        { name: 'into', label: 'Save as',    type: 'text' },
      ],
    },

    'form.setCheck': {
      label:  'Set Checkbox',
      desc:   'Check or uncheck a checkbox by field name.',
      params: [
        { name: 'name',    label: 'Field name', type: 'text' },
        { name: 'checked', label: 'Checked',    type: 'boolean', default: true },
      ],
    },

    'form.getSelect': {
      label:  'Get Select Value',
      desc:   'Read the selected option from a <select> once when this step runs. Saves to inventory under the key you specify in "Save as".',
      params: [
        { name: 'name', label: 'Field name', type: 'text' },
        { name: 'into', label: 'Save as',    type: 'text' },
      ],
    },

    'form.getRange': {
      label:  'Get Range Slider',
      desc:   'Read the current value of a range input once when this step runs. Saves to inventory under the key you specify in "Save as".',
      params: [
        { name: 'name', label: 'Field name', type: 'text' },
        { name: 'into', label: 'Save as',    type: 'text' },
      ],
    },

  },
};
