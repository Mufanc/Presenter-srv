import Mime from 'mime'
import { createDirLike, DirLike } from './fs'

const swContext: ServiceWorkerGlobalScope & typeof self = self as any
const clients = new Map<string, DirLike>()

swContext.addEventListener('message', async event => {
    const { method, params } = event.data
    const client = event.source as WindowClient

    switch (method) {
        case 'REGISTER':
            const fs = createDirLike(params.handle as FileSystemHandle)
            console.log('register:', fs)
            if (!fs) return

            const fp = await fs.open('index.html')
            if (fp !== null) {
                const content = await fp.string()

                clients.set(client.id, fs)
                console.log(`new client: ${client.id}`)

                client.postMessage({
                    method: 'LOAD',
                    params: { content },
                })
            }

            break

        case 'UNREGISTER':
            if (clients.delete(client.id)) {
                console.log(`client disconnected: ${client.id}`)
            }
            break

        default:
            console.warn(`unexpected message: ${method}`)
            break
    }
})

swContext.addEventListener('fetch', event => {
    const fs = clients.get(event.clientId)

    event.respondWith(
        (async () => {
            const uri = new URL(event.request.url)

            // special url
            if (uri.host === 'service.worker' && uri.pathname === '/check') {
                return new Response(null, { status: 200, statusText: 'ACK' })
            }

            if (!fs || uri.host !== location.host) {
                return await fetch(event.request)
            } else {
                const fp = await fs.open(uri.pathname.replace(/^\//, ''))
                if (fp !== null) {
                    new Response()
                    return new Response(await fp.arrayBuffer(), {
                        status: 200,
                        statusText: 'OK',
                        headers: {
                            'Cache-Control': 'no-store',
                            'Content-Type':
                                Mime.getType(await fp.name()) || 'application/octet-stream',
                        },
                    })
                } else {
                    return new Response(null, { status: 404, statusText: 'Not Found' })
                }
            }
        })()
    )
})

export {}
