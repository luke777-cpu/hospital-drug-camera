const CACHE='hospital-drug-camera-v1';
const ASSETS=['./','index.html','style.css','app.js','hospital-drugs-source.html','manifest.webmanifest'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS))));
self.addEventListener('fetch',e=>e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request))));
