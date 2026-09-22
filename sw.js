self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil((async()=>{for(const k of await caches.keys()){if(k.startsWith('hospital-drug-camera-'))await caches.delete(k)}await self.clients.claim()})()));
