import Mime from 'mime'
import type { WindowEvent } from './events'
import { createDirLike } from './fs'
import type { DirLike } from './fs'
import { clientHandleKey, deleteHandle, getHandle, getHandleKeys, setHandle } from './persistence'
import { isResetPath, requestPath } from './request-path'

const swContext: ServiceWorkerGlobalScope & typeof self = self as any
const clients = new Map<string, { fs: DirLike; handle: FileSystemHandle }>()

async function getClient(clientId: string) {
    const cached = clients.get(clientId)
    if (cached) return cached

    const handle = await getHandle(clientHandleKey(clientId))
    const fs = handle && (await createDirLike(handle))
    if (!handle || !fs) return null

    const client = { fs, handle }
    clients.set(clientId, client)
    return client
}

async function forgetClient(clientId: string) {
    clients.delete(clientId)
    await deleteHandle(clientHandleKey(clientId))
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
                (await swContext.clients.matchAll()).map(client => client.id),
            )
            const keys = await getHandleKeys()

            await Promise.all(
                keys
                    .filter(key => key.startsWith('CLIENT:') && !activeClients.has(key.slice(7)))
                    .map(deleteHandle),
            )
        })(),
    )
})

swContext.addEventListener('message', async event => {
    const ev = event.data as WindowEvent
    const client = event.source as WindowClient

    function postMessage(event: WindowEvent) {
        client.postMessage(event)
    }

    if (ev.type !== 'REGISTER') return

    try {
        const fs = await createDirLike(ev.handle)
        if (!fs) throw new Error('只支持文件夹、ZIP 或 TAR 文件')
        if (!(await fs.open('index.html'))) throw new Error('所选内容中没有 index.html')

        await setHandle(clientHandleKey(client.id), ev.handle)
        clients.set(client.id, { fs, handle: ev.handle })
        postMessage({ type: 'REGISTERED' })
    } catch (error) {
        postMessage({
            type: 'REGISTERED',
            error: error instanceof Error ? error.message : String(error),
        })
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

            if (event.request.mode === 'navigate' && isResetPath(event.request.url)) {
                if (previousClientId) await forgetClient(previousClientId)
                return Response.redirect(new URL('/', uri), 302)
            }

            const client = await getClient(previousClientId)

            if (!client) {
                return await fetch(event.request)
            }

            const path = requestPath(event.request.url, event.request.mode === 'navigate')
            let contents: Awaited<ReturnType<DirLike['open']>>

            try {
                if ((await client.handle.queryPermission()) !== 'granted') {
                    throw new DOMException('File access permission expired', 'NotAllowedError')
                }

                contents = await client.fs.open(path)
            } catch (err) {
                if (err instanceof DOMException && err.name === 'NotAllowedError') {
                    await forgetClient(previousClientId)

                    return event.request.mode === 'navigate'
                        ? fetch('/')
                        : new Response(null, { status: 403, statusText: 'Forbidden' })
                }

                throw err
            }

            if (contents === null) {
                return new Response(null, { status: 404, statusText: 'Not Found' })
            }

            if (event.resultingClientId) {
                await setHandle(clientHandleKey(event.resultingClientId), client.handle)
                await deleteHandle(clientHandleKey(previousClientId))
                clients.delete(previousClientId)
                clients.set(event.resultingClientId, client)
            }

            return new Response(contents, {
                status: 200,
                statusText: 'OK',
                headers: {
                    'Cache-Control': 'no-store',
                    'Content-Type': Mime.getType(path) || 'application/octet-stream',
                },
            })
        })(),
    )
})

export {}
