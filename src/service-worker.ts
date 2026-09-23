import Mime from 'mime'
import { EventTypes, WindowEvent } from './events'
import { createDirLike, DirLike } from './fs'
import {
    clientHandleKey,
    deleteHandle,
    getHandle,
    getHandleKeys,
    setHandle,
} from './persistence'

const swContext: ServiceWorkerGlobalScope & typeof self = self as any
const clients = new Map<string, { fs: DirLike; handle: FileSystemHandle }>()

async function getClient(clientId: string) {
    const cached = clients.get(clientId)
    if (cached) return cached

    const handle = await getHandle(clientHandleKey(clientId))
    const fs = handle && createDirLike(handle)
    if (!handle || !fs) return null

    const client = { fs, handle }
    clients.set(clientId, client)
    return client
}

swContext.addEventListener('install', async () => {
    await swContext.skipWaiting()
    console.log('installed!')
})

swContext.addEventListener('activate', event => {
    event.waitUntil(
        (async () => {
            await swContext.clients.claim()

            const activeClients = new Set(
                (await swContext.clients.matchAll()).map(client => client.id)
            )
            const keys = await getHandleKeys()

            await Promise.all(
                keys
                    .filter(key => key.startsWith('CLIENT:') && !activeClients.has(key.slice(7)))
                    .map(deleteHandle)
            )
        })()
    )
})

swContext.addEventListener('message', async event => {
    const ev = event.data as WindowEvent
    const client = event.source as WindowClient

    function postMessage(event: WindowEvent) {
        client.postMessage(event)
    }

    switch (ev.type) {
        case EventTypes.REGISTER:
            const fs = createDirLike(ev.handle as FileSystemHandle)
            console.log('register:', fs)
            if (!fs) return

            try {
                const fp = await fs.open('index.html')
                if (fp !== null) {
                    await setHandle(clientHandleKey(client.id), ev.handle)
                    clients.set(client.id, { fs, handle: ev.handle })
                    console.log(`new client: ${client.id}`)

                    postMessage({ type: EventTypes.REGISTERED })
                }
            } catch (err) {
                postMessage({ type: EventTypes.REGISTERED, error: err })
            }

            break
    }
})

swContext.addEventListener('fetch', event => {
    event.respondWith(
        (async () => {
            const uri = new URL(event.request.url)

            if (uri.host !== location.host) {
                return await fetch(event.request)
            }

            const { replacesClientId = '' } = event as FetchEvent & { replacesClientId?: string }
            const previousClientId = replacesClientId || event.clientId
            const client = await getClient(previousClientId)

            if (!client) {
                return await fetch(event.request)
            }

            const path = event.request.mode === 'navigate'
                ? 'index.html'
                : uri.pathname.replace(/^\//, '')
            let fp: Awaited<ReturnType<DirLike['open']>>

            try {
                if ((await client.handle.queryPermission()) !== 'granted') {
                    throw new DOMException('File access permission expired', 'NotAllowedError')
                }

                fp = await client.fs.open(path)
            } catch (err) {
                if (err instanceof DOMException && err.name === 'NotAllowedError') {
                    clients.delete(previousClientId)
                    await deleteHandle(clientHandleKey(previousClientId))

                    return event.request.mode === 'navigate'
                        ? fetch('/')
                        : new Response(null, { status: 403, statusText: 'Forbidden' })
                }

                throw err
            }

            if (fp === null) {
                return new Response(null, { status: 404, statusText: 'Not Found' })
            }

            if (event.resultingClientId) {
                await setHandle(clientHandleKey(event.resultingClientId), client.handle)
                await deleteHandle(clientHandleKey(previousClientId))
                clients.delete(previousClientId)
                clients.set(event.resultingClientId, client)
            }

            return new Response(await fp.arrayBuffer(), {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Cache-Control': 'no-store',
                    'Content-Type': Mime.getType(await fp.name()) || 'application/octet-stream',
                },
            })
        })()
    )
})

export {}
