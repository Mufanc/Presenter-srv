import App from '@/App.vue'
import { createApp } from 'vue'
import 'virtual:uno.css'

if ('serviceWorker' in navigator && import.meta.env.MODE === 'production') {
    navigator.serviceWorker.register('/service-worker.js')
}

createApp(App).mount('#app')
