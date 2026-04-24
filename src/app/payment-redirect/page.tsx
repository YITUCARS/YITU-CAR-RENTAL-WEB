'use client'

import { useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'

function RedirectContent() {
    const params = useSearchParams()

    useEffect(() => {
        const raw = params.get('redirect')
        if (!raw) return

        let url: string
        try {
            url = decodeURIComponent(raw)
        } catch {
            url = raw
        }

        // Give the loading UI time to render before navigating
        const timer = setTimeout(() => {
            window.location.href = url
        }, 300)

        return () => clearTimeout(timer)
    }, [params])

    return (
        <div style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#f5f7fb',
            fontFamily: 'system-ui, sans-serif'
        }}>
            <div style={{
                width: 56,
                height: 56,
                border: '4px solid #e8431a',
                borderTopColor: 'transparent',
                borderRadius: '50%',
                animation: 'spin 0.8s linear infinite',
                marginBottom: 24
            }} />
            <p style={{ color: '#1a2b6b', fontWeight: 700, fontSize: 18, margin: 0 }}>
                正在跳转支付页面…
            </p>
            <p style={{ color: '#5c6a80', fontSize: 14, marginTop: 8 }}>
                请稍候，勿关闭此页面
            </p>
            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    )
}

export default function PaymentRedirectPage() {
    return (
        <Suspense fallback={
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#f5f7fb'
            }}>
                <p style={{ color: '#1a2b6b' }}>Loading…</p>
            </div>
        }>
            <RedirectContent />
        </Suspense>
    )
}
