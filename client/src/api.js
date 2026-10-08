const BASE = '/api';

let authToken = null;
let onUnauthorized = null;

export function setAuthToken(token) {
  authToken = token;
}

export function setOnUnauthorized(fn) {
  onUnauthorized = fn;
}

function authHeaders(extra = {}) {
  const headers = { ...extra };
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  return headers;
}

async function handle(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (res.status === 401 && onUnauthorized) onUnauthorized();
  if (!res.ok) {
    const err = new Error((data && data.error) || `Error ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, params) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) : '';
    return fetch(`${BASE}${path}${qs}`, { headers: authHeaders() }).then(handle);
  },
  post: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }).then(handle),
  put: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(body),
    }).then(handle),
  del: (path) => fetch(`${BASE}${path}`, { method: 'DELETE', headers: authHeaders() }).then(handle),
  postForm: (path, formData) =>
    fetch(`${BASE}${path}`, { method: 'POST', headers: authHeaders(), body: formData }).then(handle),
  putForm: (path, formData) =>
    fetch(`${BASE}${path}`, { method: 'PUT', headers: authHeaders(), body: formData }).then(handle),
};

export function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, v);
  });
  return fd;
}
