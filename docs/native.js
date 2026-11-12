// Uygulama içinde /api/* isteklerini sunucu yerine cihazdaki motora (lib/native-api.js) yönlendirir.
(() => {
  const realFetch = window.fetch.bind(window);
  let api;
  const load = () => (api ||= import('./lib/native-api.js'));
  window.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const m = url.match(/^(?:capacitor:\/\/localhost)?\/?(api\/.*)$/);
    if (m) return load().then((mod) => mod.handle(new URL('/' + m[1], 'http://local')));
    return realFetch(input, init);
  };
})();
