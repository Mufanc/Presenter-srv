import Mime from 'mime'

const swContext: ServiceWorkerGlobalScope & typeof self = self as any
const clientMap = new Map<string, FileSystemDirectoryHandle>()

async function getFile(dir: FileSystemDirectoryHandle, path: string): Promise<File | null> {
    const paths = path.replace(/^\//, '').split('/')

    function check(err: any) {
        if (err instanceof DOMException && err.name == 'NotFoundError') {
            console.error(`Cannot found ${path} in specific directory!`)
            return null
        } else {
            throw err // or throw out
        }
    }

    let entry = dir

    for (let i = 0; i < paths.length - 1; i++) {
        try {
            entry = await entry.getDirectoryHandle(paths[i])
        } catch (err) {
            return check(err)
        }
    }

    try {
        return await (await entry.getFileHandle(paths[paths.length - 1])).getFile()
    } catch (err) {
        return check(err)
    }
}

swContext.addEventListener('message', async event => {
    const { method, params } = event.data
    const client = event.source as WindowClient

    switch (method) {
        case 'REGISTER':
            const handle = params.handle as FileSystemDirectoryHandle

            const fp = await getFile(handle, 'index.html')
            if (fp !== null) {
                const content = await fp.text()

                clientMap.set(client.id, params.handle)
                console.log(`Registered proxy for client: ${client.id}`)

                client.postMessage({
                    method: 'LOAD',
                    params: { content },
                })
            }

            break

        case 'UNREGISTER':
            if (clientMap.delete(client.id)) {
                console.log(`Client disconnected: ${client.id}`)
            }
            break

        default:
            console.warn(`Unexpected message: ${method}`)
            break
    }
})

swContext.addEventListener('fetch', event => {
    const root = clientMap.get(event.clientId)

    event.respondWith(
        (async () => {
            const requestUrl = new URL(event.request.url)

            // special url
            if (requestUrl.host === 'service.worker' && requestUrl.pathname === '/check') {
                return new Response(null, { status: 200, statusText: 'ACK' })
            }

            if (!root || requestUrl.host !== location.host) {
                return await fetch(event.request)
            } else {
                const file = await getFile(root, requestUrl.pathname)

                if (file !== null) {
                    return new Response(await file.arrayBuffer(), {
                        status: 200,
                        statusText: 'OK',
                        headers: {
                            'Cache-Control': 'no-store',
                            'Content-Type': Mime.getType(file.name) || 'application/octet-stream',
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
