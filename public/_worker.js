export default {
    async fetch(request, env) {
        try {
            const url = new URL(request.url);

            // Route scale.gympropel.com root to /scale/index.html
            if (url.hostname === 'scale.gympropel.com' && (url.pathname === '/' || url.pathname === '')) {
                const scaleUrl = new URL('/scale/index.html', url.origin);
                return env.ASSETS.fetch(new Request(scaleUrl.toString(), request));
            }

            // Everything else served normally by Cloudflare Pages
            return env.ASSETS.fetch(request);
        } catch (e) {
            return new Response('Internal error: ' + e.message, { status: 500 });
        }
    }
};
