// /ws/* 웹소켓 → tel_router(터널) 그대로 넘김 — 합당한 자 실시간 신호. 브라우저는 page.ddochi.cloud만 상대.
/**
 * Auth model: the client sends its JWT as the first message (browsers can't set
 * headers on a WebSocket, and a query string would end up in access logs) and
 * tel_router verifies it. This Function only forwards the upgrade.
 * Workers proxy a WebSocket by returning the origin's 101 response from fetch().
 */
interface Env {
  ORIGIN_API_URL: string;
}

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('expected websocket', { status: 426 });
  }
  if (!env.ORIGIN_API_URL) {
    return new Response('pages_function_misconfigured', { status: 500 });
  }
  const incoming = new URL(request.url);
  const origin = new URL(env.ORIGIN_API_URL);
  origin.pathname = incoming.pathname;
  origin.search = incoming.search;
  return fetch(origin.toString(), request);
};
