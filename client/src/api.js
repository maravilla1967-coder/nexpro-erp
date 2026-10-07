const BASE = '/api';

async function handle(res) {
  if (res.status === 204) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error((data && data.error) || `Error ${res.status}`);
    err.data = data;
    throw err;
  }
  return data;
}

export const api = {
  get: (path, params) => {
    const qs = params ? '?' + new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== '')) : '';
    return fetch(`${BASE}${path}${qs}`).then(handle);
  },
  post: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle),
  put: (path, body) =>
    fetch(`${BASE}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).then(handle),
  del: (path) => fetch(`${BASE}${path}`, { method: 'DELETE' }).then(handle),
  postForm: (path, formData) =>
    fetch(`${BASE}${path}`, { method: 'POST', body: formData }).then(handle),
  putForm: (path, formData) =>
    fetch(`${BASE}${path}`, { method: 'PUT', body: formData }).then(handle),
};

export function toFormData(obj) {
  const fd = new FormData();
  Object.entries(obj).forEach(([k, v]) => {
    if (v === undefined || v === null) return;
    fd.append(k, v);
  });
  return fd;
}
