import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

// Firebase 웹 설정값은 공개돼도 되는 식별자다. 데이터 보호는 firestore.rules 가 담당한다.
const PROJECT_ID = 'date-planner-78162'
const firebaseConfig = {
  apiKey: 'AIzaSyABxHl4EwkMqLsCNewQJTA-Rb0M_1G2LDE',
  authDomain: `${PROJECT_ID}.firebaseapp.com`,
  projectId: PROJECT_ID,
  storageBucket: `${PROJECT_ID}.firebasestorage.app`,
  messagingSenderId: '542714002020',
  appId: '1:542714002020:web:7b466970fb806f9ad97d71',
}

// 운영 도메인에서는 로그인 핸들러(/__/auth/*)를 Netlify가 firebaseapp.com 으로 프록시한다(netlify.toml).
// 로그인 페이지가 앱과 같은 도메인이 되어야 사파리·크롬의 서드파티 저장소 차단에도 리디렉션 로그인이 동작한다.
export const PROD_HOST = 'date-planner-gangbin.netlify.app'
if (location.hostname === PROD_HOST) firebaseConfig.authDomain = PROD_HOST

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
auth.languageCode = 'ko'

// 오프라인에서도 마지막으로 본 데이터를 보여주도록 IndexedDB 캐시 사용
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
})
