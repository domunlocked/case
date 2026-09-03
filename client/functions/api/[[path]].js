const backendUrl = 'https://case-22pl.onrender.com';

export async function onRequest(context) {
  const incoming = new URL(context.request.url);
  const target = new URL(`${backendUrl}${incoming.pathname}${incoming.search}`);
  const headers = new Headers(context.request.headers);
  headers.delete('host');
  headers.delete('origin');
  const init = {
    method: context.request.method,
    headers,
    redirect: 'manual',
  };
  if (context.request.method !== 'GET' && context.request.method !== 'HEAD') {
    init.body = context.request.body;
  }
  const response = await fetch(target, init);
  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete('content-encoding');
  responseHeaders.delete('content-length');
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
