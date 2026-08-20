/* Service Worker — permite abrir o app sem internet.
   Guarda os arquivos do site em cache; os DADOS ficam em localStorage (ver app).
   Chamadas ao Supabase nunca são cacheadas aqui: quando não há rede, o app usa
   o último retrato salvo e entra em modo somente-consulta. */
const CACHE = "consultoria-v11";
const ARQUIVOS = [
  "./",
  "./index.html",
  "./formulario.html",
  "./vendor/supabase.js",
  "./vendor/pdf.min.js",
  "./vendor/pdf.worker.min.js",
  "./manifest.webmanifest",
  "./favicon-32.png",
  "./apple-touch-icon.png",
  "./icone-192.png",
  "./icone-512.png",
];

self.addEventListener("install", ev => {
  ev.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.allSettled(ARQUIVOS.map(a => c.add(a))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", ev => {
  ev.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", ev => {
  const req = ev.request;
  if (req.method !== "GET") return;                       /* escritas nunca são cacheadas */
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;        /* Supabase e afins: direto na rede */

  /* Navegação: tenta a rede, cai no cache se estiver offline */
  if (req.mode === "navigate") {
    ev.respondWith(
      fetch(req)
        .then(r => { const c = r.clone(); caches.open(CACHE).then(k => k.put("./index.html",
  "./formulario.html", c)); return r; })
        .catch(() => caches.match("./index.html").then(r => r || caches.match("./")))
    );
    return;
  }

  /* Demais arquivos do site: cache primeiro, atualizando por trás */
  ev.respondWith(
    caches.match(req).then(hit => {
      const rede = fetch(req).then(r => {
        if (r && r.status === 200) { const c = r.clone(); caches.open(CACHE).then(k => k.put(req, c)); }
        return r;
      }).catch(() => hit);
      return hit || rede;
    })
  );
});
