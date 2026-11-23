import { currentPerson } from './auth.js';

export function send(res, status, body) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(status).json(body);
}

/**
 * Wrap an API handler: checks the HTTP method, optionally requires a logged-in
 * person, and turns unexpected errors into a 500.
 */
export function route(methodName, fn, { auth = true } = {}) {
  return async (req, res) => {
    try {
      if (req.method !== methodName) return send(res, 405, { error: 'Method not allowed' });
      let me = null;
      if (auth) {
        me = await currentPerson(req);
        if (!me) return send(res, 401, { error: 'Please log in again' });
      }
      await fn(req, res, me);
    } catch (err) {
      console.error(err);
      // Private friends-only app: include the reason so problems can be diagnosed from the phone.
      const detail = [err?.code, err?.message || String(err)].filter(Boolean).join(': ');
      send(res, 500, { error: 'Something went wrong. Try again.', detail });
    }
  };
}
