/**
 * thing-library.js — Client-side catalogue of built-in Thing types.
 *
 * Things are objects that inhabit rooms (rooms). They listen for room events
 * and respond with Savant workflows. Think MCP servers, Apple Savant
 * Services, or MUD NPCs — abstractions over complex behaviours.
 *
 * Shape per entry:
 *   type          — runtime class name (must match _THING_REGISTRY in runtime.js)
 *   label         — display name
 *   desc          — one-liner
 *   icon          — Bootstrap icon name
 *   color         — CSS color for the badge
 *   config[]      — config param descriptors (same format as action params)
 *   defaultEvents — event tabs to show in the Savant
 *   canAddEvents  — whether the user can add custom event names
 */

export const THING_LIBRARY = {

  FormThing: {
    label: 'Form',
    desc:  'A form container. Add Input and Display actions to the Take event — they render only when an Emit Event targets this form.',
    icon:  'ui-checks',
    color: 'var(--sol-indigo)',
    config: [
      { name: 'name', label: 'Name', type: 'text', placeholder: 'LoginForm' },
    ],
    defaultEvents: [
      { key: 'take', label: 'Take', fixed: false },
    ],
    canAddEvents: true,
  },

  WorkflowThing: {
    label: 'Workflow',
    desc:  'A scriptable service. Wire Savant workflows to any room event.',
    icon:  'gear-wide-connected',
    color: 'var(--sol-green)',
    config: [
      { name: 'name', label: 'Name', type: 'text', placeholder: 'My Service' },
    ],
    defaultEvents: [
      { key: 'Enter', label: 'Enter', fixed: true },
    ],
    canAddEvents: true,
  },

  PersonaLiveThing: {
    label: 'Persona',
    desc:  'An AI persona. Hears "message" events and replies via any OpenAI-compatible endpoint.',
    icon:  'robot',
    color: 'var(--sol-violet)',
    config: [
      { name: 'name',        label: 'Name',        type: 'text',     placeholder: 'Alex',                             default: 'Persona' },
      { name: 'personality', label: 'Personality', type: 'textarea', placeholder: 'You are a helpful assistant.',    default: '' },
      { name: 'endpoint',    label: 'AI Endpoint', type: 'text',     placeholder: '',                                default: 'http://localhost:8191/v1/chat/completions' },
      { name: 'model',       label: 'Model',       type: 'text',     placeholder: '',                                default: 'local' },
      { name: 'replyInto',   label: 'Reply into',  type: 'text',     placeholder: 'aiReply',                         default: '' },
    ],
    defaultEvents: [
      { key: 'Enter', label: 'Enter',   fixed: true  },
      { key: 'message', label: 'Message', fixed: false },
    ],
    canAddEvents: false,
  },

  AuthServerThing: {
    label: 'Auth Server',
    desc:  'Handles login, signup, token validation. Swap for TestAuthServerThing offline.',
    icon:  'shield-lock',
    color: 'var(--sol-blue)',
    config: [
      { name: 'apiUrl',    label: 'API URL',    type: 'text', placeholder: 'https://api.example.com/auth' },
      { name: 'tokenInto', label: 'Token into', type: 'text', placeholder: 'authToken', default: 'authToken' },
    ],
    defaultEvents: [
      { key: 'Enter', label: 'Enter', fixed: true },
    ],
    canAddEvents: true,
  },

  TestAuthServerThing: {
    label: 'Auth Server (Test)',
    desc:  'Simulates auth responses for development — no real server needed.',
    icon:  'shield-check',
    color: 'var(--sol-cyan)',
    config: [
      { name: 'tokenInto',    label: 'Token into',     type: 'text',    placeholder: 'authToken', default: 'authToken' },
      { name: 'alwaysSucceed', label: 'Always succeed', type: 'boolean', default: true },
    ],
    defaultEvents: [
      { key: 'Enter', label: 'Enter', fixed: true },
    ],
    canAddEvents: true,
  },

};

/** Returns the defaultEvents array for a given thing type. */
export function getThingEvents(type) {
  return THING_LIBRARY[type]?.defaultEvents ?? [{ key: 'Enter', label: 'Enter', fixed: true }];
}
