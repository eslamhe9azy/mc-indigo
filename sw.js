// سجل الأعطال اليومي - Service Worker
// بيخزن شكل التطبيق (الصفحة + الأيقونات) عشان يفتح بسرعة حتى لو النت ضعيف،
// وبيخلي كروم يعتبر الموقع "تطبيق قابل للتثبيت" فعليًا.

const CACHE_NAME = 'fault-log-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// استراتيجية: الشبكة أولاً لطلبات الـ API (submit)، والكاش أولاً لشكل التطبيق الثابت
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // لا تتدخل أبدًا في طلبات الـ API بتاعة Google Apps Script
  if (url.includes('script.google.com')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      return (
        cached ||
        fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        }).catch(() => cached)
      );
    })
  );
});
