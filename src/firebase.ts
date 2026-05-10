import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  getAuth,
  onAuthStateChanged,
  signInAnonymously,
  type Auth,
  type User,
} from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { getFunctions, type Functions } from 'firebase/functions'
import {
  getMessaging,
  isSupported as isMessagingSupported,
  type Messaging,
} from 'firebase/messaging'

/**
 * Firebase Web 設定。雖然這些值會出現在前端 bundle 中，但它們屬於「公開識別碼」
 * （參考官方文件），實際存取權限由 Firestore Security Rules 與 Auth domain 限制保護。
 */
const firebaseConfig = {
  apiKey: 'AIzaSyDo_mD1imVLNFIefFWoG-kvPx4gts2aupo',
  authDomain: 'period-tracker-tina.firebaseapp.com',
  projectId: 'period-tracker-tina',
  storageBucket: 'period-tracker-tina.firebasestorage.app',
  messagingSenderId: '215591709546',
  appId: '1:215591709546:web:fffd1285719533f204d313',
} as const

/** FCM Web Push VAPID 公鑰（在 Firebase Console → Cloud Messaging → Web 設定產生） */
export const FCM_VAPID_KEY =
  'BFm0MRLwDfLYzNXl4FaAfZHrCWSRVwLecUF-1yT3LEqE9uhyxPnLxMuW0_eSM01ns9QldLUW3LTinSk8Z611SOM'

let appSingleton: FirebaseApp | null = null
let authSingleton: Auth | null = null
let firestoreSingleton: Firestore | null = null
let functionsSingleton: Functions | null = null
let messagingPromise: Promise<Messaging | null> | null = null

/** Cloud Functions 部署的區域，需與 functions/src/index.ts 的 region 一致。 */
export const FUNCTIONS_REGION = 'asia-east1'

export function getFirebaseApp(): FirebaseApp {
  if (!appSingleton) appSingleton = initializeApp(firebaseConfig)
  return appSingleton
}

export function getFirebaseAuth(): Auth {
  if (!authSingleton) authSingleton = getAuth(getFirebaseApp())
  return authSingleton
}

export function getFirebaseFirestore(): Firestore {
  if (!firestoreSingleton) firestoreSingleton = getFirestore(getFirebaseApp())
  return firestoreSingleton
}

export function getFirebaseFunctions(): Functions {
  if (!functionsSingleton) {
    functionsSingleton = getFunctions(getFirebaseApp(), FUNCTIONS_REGION)
  }
  return functionsSingleton
}

/**
 * 取得 Messaging 物件；若瀏覽器不支援（例如 iOS Safari 未安裝為 PWA），回傳 null。
 * 同一個瀏覽器分頁只會初始化一次。
 */
export function getFirebaseMessaging(): Promise<Messaging | null> {
  if (!messagingPromise) {
    messagingPromise = isMessagingSupported().then((supported) =>
      supported ? getMessaging(getFirebaseApp()) : null,
    )
  }
  return messagingPromise
}

/** 確保已用匿名身分登入，回傳對應 user。重複呼叫會重用同一個 user。 */
export function ensureAnonymousUser(): Promise<User> {
  const auth = getFirebaseAuth()
  if (auth.currentUser) return Promise.resolve(auth.currentUser)
  return new Promise<User>((resolve, reject) => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        unsubscribe()
        resolve(u)
      }
    })
    signInAnonymously(auth).catch((err) => {
      unsubscribe()
      reject(err)
    })
  })
}
