const CACHE='fitnaplo-static-v1.5';
const ASSETS=['./','./index.html','./styles.css?v=1.5','./app.js?v=1.5','./calendar.js?v=1.3','./manifest.webmanifest','./icon-192.png','./icon-512.png'];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('fitnaplo-static-')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
/* Hálózat-első stratégia: internet mellett friss fájlok, offline a legutolsó sikeresen tárolt verzió. */
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||new URL(request.url).origin!==self.location.origin)return;
  if(!new URL(request.url).pathname.startsWith(new URL(self.registration.scope).pathname))return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request,{cache:'no-store'});
      if(response.ok&&response.type==='basic')await cache.put(request,response.clone());
      return response;
    }catch(error){
      const cached=await cache.match(request);
      if(cached)return cached;
      if(request.mode==='navigate'){
        const fallback=await cache.match('./index.html')||await cache.match('./');
        if(fallback)return fallback;
      }
      throw error;
    }
  })());
});