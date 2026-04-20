import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

export function getAdminDb() {
    try {
        const app = getApps().length > 0
            ? getApps()[0]
            : (() => {
                console.log('[firebase-admin] initializing app, projectId:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID, 'clientEmail:', process.env.FIREBASE_CLIENT_EMAIL)
                return initializeApp({
                    credential: cert({
                        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                    }),
                })
            })()
        console.log('[firebase-admin] getting firestore')
        return getFirestore(app, '(default)')
    } catch (error) {
        console.error('[firebase-admin] init error:', error)
        throw error
    }
}
