<template>
    <el-card class="card mx-auto max-w-40em mt-5em">
        <h1 class="title">Presenter-srv</h1>
        <div class="flex justify-center">
            <el-button :disabled="hasError" @click="pickAndRegister" size="large"
                >选择一个文件夹</el-button
            >
            <el-button
                v-if="lastUsedDirectory"
                :disabled="hasError"
                @click="registerLast"
                size="large"
                >使用上一次的文件夹（{{ lastUsedDirectory.name }}）</el-button
            >
        </div>
        <details class="mt-2em text-center">
            <summary>如何使用？</summary>
            <div class="text-justify my-1em">
                <p>
                    &emsp;&emsp;这是
                    <a href="https://github.com/Mufanc/Presenter">Presenter</a>
                    的配套项目，让你能够仅用一个搭载了 Chromium 的浏览器就能完成 Slidev SPA
                    的部署工作。你只需要点击上方按钮选择 Presenter 打包时生成的 web-app
                    文件夹，即可进入演示模式。
                </p>
            </div>
        </details>
    </el-card>
</template>

<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { onMounted, ref } from 'vue'
import 'element-plus/theme-chalk/el-message.css'

function postMessage(method: string, params: any) {
    navigator.serviceWorker?.controller?.postMessage({
        method,
        params,
    })
}

class FileSystemHelper {
    static async #connect(): Promise<IDBDatabase> {
        const connection = window.indexedDB.open('FileHandleDB', 1)

        connection.onupgradeneeded = () => {
            const database = connection.result
            if (!database.objectStoreNames.contains('STORE')) {
                database.createObjectStore('STORE')
            }
        }

        return new Promise(resolve => {
            connection.onsuccess = () => {
                resolve(connection.result)
            }
        })
    }

    static async pickDirectory(): Promise<FileSystemDirectoryHandle> {
        const handle = await window.showDirectoryPicker()
        const database = await this.#connect()

        const request = database
            .transaction(['STORE'], 'readwrite')
            .objectStore('STORE')
            .add(handle, 'LAST')

        request.onsuccess = () => {
            console.log('FileSystemDirectoryHandle saved.')
        }

        return handle
    }

    static async getLastDirectory(): Promise<FileSystemDirectoryHandle | null> {
        const database = await this.#connect()
        const request = database.transaction(['STORE'], 'readonly').objectStore('STORE').get('LAST')

        return new Promise(resolve => {
            request.onerror = () => {
                resolve(null)
            }

            request.onsuccess = () => {
                resolve(request.result)
            }
        })
    }
}

async function pickAndRegister() {
    try {
        const handle = await FileSystemHelper.pickDirectory()
        postMessage('REGISTER', { handle })
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.log('User canceled.')
        } else {
            throw err
        }
    }
}

const lastUsedDirectory = computedAsync(async () => await FileSystemHelper.getLastDirectory(), null)

async function registerLast() {
    const handle = lastUsedDirectory.value!

    while (await handle.queryPermission() == 'prompt') {
        await handle.requestPermission({ mode: 'read' })
    }

    if (await handle.queryPermission() == 'granted') {
        postMessage('REGISTER', { handle })
    } else {
        console.error('Permission denied.')
    }
}

const hasError = ref(false)

function checkEnv() {
    function logE(message: string) {
        hasError.value = true
        ElMessage({ type: 'error', duration: 5000, message })
    }

    // ensure HTTPS
    if (!window.isSecureContext) {
        logE('需要 HTTPS')
    }

    // check Service Worker
    ;(async () => {
        try {
            const resp = await fetch('https://service.worker/check')
            if (resp.status === 200 && resp.statusText == 'ACK') {
                return
            }
        } catch (err) { }

        const key = "no-auto-refresh"
        const noRefresh = Boolean(localStorage.getItem(key))

        if (noRefresh) {
            logE('Service Worker 不可用')
            return
        }

        localStorage.setItem(key, "1")
        window.location.reload()
    })()
}

onMounted(() => {
    checkEnv()

    navigator.serviceWorker.onmessage = event => {
        let { method, params } = event.data
        switch (method) {
            case 'LOAD':
                document.open()
                document.write(params.content)
                document.close()

                window.addEventListener('beforeunload', () => {
                    console.log('unload')
                    postMessage('UNREGISTER', { })
                })

                break

            default:
                console.warn(`Unexpected message: ${method}`)
                break
        }
    }
})
</script>

<style scoped>
:global(body) {
    background-color: #f0f0f0;
}

.title {
    text-align: center;
    font-family: 'Noto Serif SC', system-ui;
}
</style>
