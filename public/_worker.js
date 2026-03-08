export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Route scale.gympropel.com root to /scale/index.html
    if (url.hostname === 'scale.gympropel.com' && (url.pathname === '/' || url.pathname === '')) {
      return env.ASSETS.fetch(new URL('/scale/index.html', url.origin));
    }

    // Everything else (assets, other pages) served normally
    return env.ASSETS.fetch(request);
  }
};
