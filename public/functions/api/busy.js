// GET /api/busy: Vincent's Google Calendar busy times for the booking widget, served from Cloudflare's edge cache.
// The Apps Script takes 3-7s per call, so we keep its last good answer and refresh it in the background:
// fresh (< 60s) -> served as is; < 10 min -> served instantly while a refresh runs; older -> wait for the Apps Script;
// Apps Script down -> last good copy (< 6h).
const ORIGIN = 'https://script.google.com/macros/s/AKfycbzl5dD_3WOxEBxjp9naQoxvSxSTSdMZ3jo8Eu2XllRKKzM1xwobGnqd8rEoy9OKZNHj/exec';
const FRESH_S = 60;
const SWR_S = 10 * 60;
const KEEP_S = 6 * 60 * 60;

async function fetchOrigin() {
  const res = await fetch(ORIGIN, { redirect: 'follow' });
  if (!res.ok) throw new Error('origin HTTP ' + res.status);
  const text = await res.text();
  const data = JSON.parse(text);
  if (!data || !Array.isArray(data.busy)) throw new Error('origin: bad body');
  return text;
}

function reply(body, state, fetchedAt) {
  return new Response(body, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*',
      'x-busy-cache': state,
      'x-busy-age': String(Math.round((Date.now() - fetchedAt) / 1000)),
    },
  });
}

export async function onRequestGet(ctx) {
  const cache = caches.default;
  const key = new Request(new URL('/api/busy?cache=v1', ctx.request.url).toString());

  const refresh = async () => {
    const body = await fetchOrigin();
    const now = Date.now();
    await cache.put(key, new Response(body, {
      headers: { 'content-type': 'application/json', 'cache-control': `public, max-age=${KEEP_S}`, 'x-fetched-at': String(now) },
    }));
    return { body, now };
  };

  const hit = await cache.match(key);
  const at = hit ? Number(hit.headers.get('x-fetched-at')) || 0 : 0;
  const cached = hit ? await hit.text() : null;
  const age = Date.now() - at;
  if (cached && age < FRESH_S * 1000) return reply(cached, 'HIT', at);
  if (cached && age < SWR_S * 1000) {
    ctx.waitUntil(refresh().catch(() => {}));
    return reply(cached, 'STALE', at);
  }
  try {
    const { body, now } = await refresh();
    return reply(body, 'MISS', now);
  } catch (e) {
    if (cached) return reply(cached, 'STALE-ERROR', at);
    return new Response(JSON.stringify({ error: 'calendar unavailable' }), {
      status: 502,
      headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' },
    });
  }
}
