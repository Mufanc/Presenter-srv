<template>
    <div
        ref="box"
        class="box mx-auto max-w-40em mt-5em"
        :class="{ dragover }"
        @dragenter="dragover++"
        @dragleave="dragover--"
        @dragover.prevent
        @drop.prevent="onDragAndDrop"
    >
        <el-card>
            <div class="content">
                <h1 class="title">Presenter-srv</h1>
                <div class="flex justify-center">
                    <el-button :disabled="hasError" @click="pickFile" size="large"
                        >选择一个文件夹</el-button
                    >
                    <el-button v-if="history" :disabled="hasError" @click="useLast" size="large">{{
                        historyHint
                    }}</el-button>
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
            </div>
        </el-card>
    </div>
</template>

<script setup lang="ts">
import { computedAsync } from '@vueuse/core'
import { ElMessage } from 'element-plus'
import { onMounted, ref, computed } from 'vue'
import 'element-plus/theme-chalk/el-message.css'

const box = ref<HTMLElement>()
const dragover = ref(0)

function postMessage(method: string, params: any) {
    navigator.serviceWorker?.controller?.postMessage({
        method,
        params,
    })
}

class PersistenceHelper {
    private static async connect(): Promise<IDBDatabase> {
        const connection = window.indexedDB.open('IndexedDB', 1)

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

    static async save(handle: FileSystemHandle) {
        const idb = await this.connect()
        const store = idb
            .transaction(['STORE'], 'readwrite')
            .objectStore('STORE')

        function onError(ev: Event) {
            console.error('idb error: ', ev)
        }

        const req1 = store.delete('LAST-DIR')
        req1.onerror = onError
        req1.onsuccess = () => {
            const req2 = store.add(handle, 'LAST-DIR')
            req2.onerror = onError
            req2.onsuccess = () => {
                console.log('saved.')
            }
        }
    }

    static async get(): Promise<FileSystemHandle | null> {
        const database = await this.connect()
        const request = database
            .transaction(['STORE'], 'readonly')
            .objectStore('STORE')
            .get('LAST-DIR')

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

const history = computedAsync(async () => {
    const value = await PersistenceHelper.get()
    console.log('history:', value)
    return value
})

const historyHint = computed(() => {
    const isDirectory = history.value instanceof FileSystemDirectoryHandle
    return `使用上一次的${isDirectory ? '文件夹' : '文件'}（${history.value?.name}）`
})

async function pickFile() {
    // Todo: support zip file
    try {
        const handle = await window.showDirectoryPicker()
        console.log('pick:', handle)
        await swRegisterHandle(handle)
    } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
            console.log('user canceled.')
        } else {
            throw err
        }
    }
}

async function useLast() {
    const handle: FileSystemHandle | null = history.value
    if (!handle) return
    await swRegisterHandle(handle)
}

async function onDragAndDrop(event: DragEvent) {
    dragover.value--
    const handle = await event.dataTransfer?.items[0].getAsFileSystemHandle()
    console.log('drag and drop:', handle)
    if (!handle) return
    await swRegisterHandle(handle)
}

async function swRegisterHandle(handle: FileSystemHandle) {
    while ((await handle.queryPermission()) === 'prompt') {
        await handle.requestPermission({ mode: 'read' })
    }

    if ((await handle.queryPermission()) === 'granted') {
        await PersistenceHelper.save(handle)
        postMessage('REGISTER', { handle })
    } else {
        console.error('permission denied.')
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
        const key = 'no-auto-refresh'

        try {
            const resp = await fetch('https://service.worker/check')
            if (resp.status === 200 && resp.statusText === 'ACK') {
                localStorage.removeItem(key)
                return
            }
        } catch (err) {}

        const refresh = !Boolean(localStorage.getItem(key))

        if (refresh) {
            localStorage.setItem(key, '1')
            window.location.reload()
            return
        }

        logE('Service Worker 不可用')
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
                    console.log('beforeunload')
                    postMessage('UNREGISTER', {})
                })

                break

            default:
                console.warn(`unexpected message: ${method}`)
                break
        }
    }
})
</script>

<style scoped lang="less">
:global(#app) {
    position: fixed;
    inset: 0;
    background-color: #f0f0f0;
}

.title {
    text-align: center;
}

.box {
    position: relative;

    @fg-color: #aaa;

    .content {
        transition: all 0.2s ease-in-out;
    }

    &::after {
        content: '打开文件';
        position: absolute;
        inset: 10px;

        display: flex;
        justify-content: center;
        align-items: center;

        font-size: 2em;
        font-weight: bold;
        letter-spacing: 0.1em;

        color: @fg-color;
        border: 5px dashed @fg-color;

        opacity: 0;
        z-index: -1;
        transition: opacity 0.2s ease-in-out;
    }

    &.dragover {
        .content {
            filter: blur(10px);
        }

        &::after {
            display: flex;
            z-index: 0;
            opacity: 1;
        }
    }
}
</style>
