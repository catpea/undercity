/**
 * project-api.js — REST client for the Undercity server.
 * All calls return the parsed JSON body or throw on failure.
 */

const BASE = '/api';

async function req(method, path, body) {
  const opts = { method, headers: {} };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, opts);
  if (!r.ok) {
    const msg = await r.text().catch(() => r.statusText);
    throw new Error(`[API] ${method} ${path} → ${r.status}: ${msg}`);
  }
  return r.json();
}

export const API = {
  listProjects:         ()       => req('GET',    '/projects'),
  getProject:           id       => req('GET',    `/projects/${id}`),
  createProject:        data     => req('POST',   '/projects', data),
  saveProject:          (id, d)  => req('PUT',    `/projects/${id}`, d),
  deleteProject:        id       => req('DELETE', `/projects/${id}`),
  generateProject:      id       => req('POST',   `/projects/${id}/generate`),

  /** Ask the local AI (localhost:8191) to generate an action definition. */
  generateAction:       prompt   => req('POST',   '/ai/generate-action', { prompt }),

  /** Template gallery */
  listTemplates:        ()         => req('GET',    '/templates'),
  getTemplate:          id         => req('GET',    `/templates/${id}`),
  saveTemplate:         data       => req('POST',   '/templates', data),
  updateTemplate:       (id, data) => req('PUT',    `/templates/${id}`, data),
  deleteTemplate:       id         => req('DELETE', `/templates/${id}`),
};
