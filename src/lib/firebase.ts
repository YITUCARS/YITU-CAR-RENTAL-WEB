'use client'

import { getApp, getApps, initializeApp } from 'firebase/app'
import type { FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously } from 'firebase/auth'
import type { Auth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import type { Firestore } from 'firebase/firestore'

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

function hasFirebaseConfig() {
    return Boolean(
        firebaseConfig.apiKey &&
        firebaseConfig.authDomain &&
        firebaseConfig.projectId &&
        firebaseConfig.appId,
    )
}

export function getFirebaseApp(): FirebaseApp | null {
    if (typeof window === 'undefined') return null
    if (!hasFirebaseConfig()) return null
    return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

export function getFirebaseAuth(): Auth | null {
    const app = getFirebaseApp()
    if (!app) return null
    return getAuth(app)
}

export function getFirebaseFirestore(): Firestore | null {
    const app = getFirebaseApp()
    if (!app) return null
    return getFirestore(app)
}

export async function ensureAnonymousAuth() {
    const auth = getFirebaseAuth()
    if (!auth) {
        throw new Error('Firebase chat is not configured yet.')
    }

    if (auth.currentUser) return auth.currentUser
    const credential = await signInAnonymously(auth)
    return credential.user
}
