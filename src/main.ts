import App from '@/App.vue'
import { createApp } from 'vue'
import 'virtual:uno.css'

if ('serviceWorker' in navigator && import.meta.env.MODE === 'production') {
    await navigator.serviceWorker.register('/service-worker.js')
    await navigator.serviceWorker.ready

    if (!navigator.serviceWorker.controller) {
        await new Promise<void>(resolve => {
            navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), {
                once: true,
            })
        })
    }
}

createApp(App).mount('#app')
