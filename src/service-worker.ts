import Mime from 'mime'
import { EventTypes, WindowEvent } from './events'
import { createDirLike, DirLike } from './fs'

const swContext: ServiceWorkerGlobalScope & typeof self = self as any
const clients = new Map<string, DirLike>()

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
                    const content = await fp.string()

                    clients.set(client.id, fs)
                    console.log(`new client: ${client.id}`)

                    postMessage({ type: EventTypes.LOAD, content })
                }
            } catch (err) {
                postMessage({ type: EventTypes.LOAD, error: err })
            }

            break

        case EventTypes.UNREGISTER:
            if (clients.delete(client.id)) {
                console.log(`client disconnected: ${client.id}`)
            }
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
