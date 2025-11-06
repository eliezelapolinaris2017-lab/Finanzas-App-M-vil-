import { initializeApp, getApps } from 'firebase/app';
import {
  initializeAuth,
  getReactNativePersistence,
  GoogleAuthProvider,
  signInWithCredential
} from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  doc, getDoc, setDoc, onSnapshot, enableIndexedDbPersistence, runTransaction
} from 'firebase/firestore';
import Constants from 'expo-constants';

const firebaseConfig = Constants.expoConfig.extra.firebase;
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage)
});
export const db = getFirestore(app);
enableIndexedDbPersistence(db).catch(() => {});

export const providers = { GoogleAuthProvider, signInWithCredential };
export const refs = {
  userStateDoc: (uid) => doc(db, 'users', uid, 'state', 'app')
};

export async function pullState(uid) {
  const snap = await getDoc(refs.userStateDoc(uid));
  return snap.exists() ? snap.data() : null;
}

export async function pushState(uid, nextState) {
  // sube y marca updatedAt para que la web haga autosync
  await setDoc(
    refs.userStateDoc(uid),
    { ...nextState, _cloud: { ...(nextState._cloud||{}), updatedAt: Date.now() } },
    { merge: true }
  );
}

export function subscribeState(uid, cb) {
  return onSnapshot(refs.userStateDoc(uid), (snap) => {
    if (snap.exists()) cb(snap.data());
  });
}

export async function atomicAppend(uid, key, record) {
  // descarga, anexa y sube transaccionalmente
  const ref = refs.userStateDoc(uid);
  await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const cur = snap.exists() ? snap.data() : {};
    const list = Array.isArray(cur[key]) ? cur[key] : [];
    tx.set(ref, { [key]: [...list, record], _cloud: { updatedAt: Date.now() } }, { merge: true });
  });
}
