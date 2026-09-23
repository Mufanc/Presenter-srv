import App from '@/App'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@/styles.css'

async function prepareServiceWorker() {
    if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return

    try {
        await navigator.serviceWorker.register('/service-worker.js')
        await navigator.serviceWorker.ready

        if (!navigator.serviceWorker.controller) {
            await new Promise<void>(resolve => {
                navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
                    once: true,
                })
            })
        }
    } catch (error) {
        console.error('Service Worker registration failed:', error)
    }
}

await prepareServiceWorker()

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
)
