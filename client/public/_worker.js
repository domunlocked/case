const BACKEND = 'https://case-22pl.onrender.com';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) {
      const target = `${BACKEND}${url.pathname}${url.search}`;
      const headers = new Headers(request.headers);
      headers.delete('host');
      headers.delete('origin');
      const init = { method: request.method, headers, redirect: 'manual' };
      if (request.method !== 'GET' && request.method !== 'HEAD') init.body = request.body;
      const response = await fetch(target, init);
      const responseHeaders = new Headers(response.headers);
      responseHeaders.delete('content-encoding');
      responseHeaders.delete('content-length');
      return new Response(response.body, { status: response.status, statusText: response.statusText, headers: responseHeaders });
    }
    return env.ASSETS.fetch(request);
  },
};
