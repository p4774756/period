// 使用 compat SDK：Service Worker 環境用 importScripts() 是最穩的方式，
// 不需要設定 type:module 或處理 ESM bundling。版本與 src/firebase.ts 對齊到主版本。
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/12.13.0/firebase-messaging-compat.js')

// 與 src/firebase.ts 中的 firebaseConfig 完全一致；屬於公開識別碼。
firebase.initializeApp({
  apiKey: 'AIzaSyDo_mD1imVLNFIefFWoG-kvPx4gts2aupo',
  authDomain: 'period-tracker-tina.firebaseapp.com',
  projectId: 'period-tracker-tina',
  storageBucket: 'period-tracker-tina.firebasestorage.app',
  messagingSenderId: '215591709546',
  appId: '1:215591709546:web:fffd1285719533f204d313',
})

const messaging = firebase.messaging()

// 背景訊息：分頁未開或不在前景時觸發。
// 目前 Cloud Function 採用 notification + webpush payload，FCM SDK 會自動
// 顯示通知，不會進到這個 callback。但若日後改為 data-only，這裡仍能接住。
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {}
  const data = payload.data || {}
  const title = n.title || data.title || '提醒'
  const body = n.body || data.body || ''
  self.registration.showNotification(title, {
    body,
    lang: 'zh-Hant',
    tag: data.tag || 'period-tracker',
    renotify: true,
    data: { url: data.url || self.registration.scope || '/' },
  })
})

// 點擊通知：嘗試聚焦既有分頁，否則開新分頁。
// 使用 self.registration.scope 作為預設目標 URL，避免硬寫 '/' 在子路徑部署下失效。
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target =
    (event.notification.data && event.notification.data.url) ||
    self.registration.scope ||
    '/'
  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      })
      for (const client of allClients) {
        if ('focus' in client) {
          await client.focus()
          return
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(target)
    })(),
  )
})
