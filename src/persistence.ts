const database = new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('IndexedDB', 1)

    request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains('STORE')) {
            request.result.createObjectStore('STORE')
        }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
})

export const lastHandleKey = 'LAST-DIR'
export const clientHandleKey = (clientId: string) => `CLIENT:${clientId}`

export async function getHandle(key: string): Promise<FileSystemHandle | null> {
    const request = (await database).transaction('STORE').objectStore('STORE').get(key)

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result ?? null)
        request.onerror = () => reject(request.error)
    })
}

export async function setHandle(key: string, handle: FileSystemHandle): Promise<void> {
    const transaction = (await database).transaction('STORE', 'readwrite')
    transaction.objectStore('STORE').put(handle, key)

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
    })
}

export async function deleteHandle(key: string): Promise<void> {
    const transaction = (await database).transaction('STORE', 'readwrite')
    transaction.objectStore('STORE').delete(key)

    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve()
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
    })
}

export async function getHandleKeys(): Promise<string[]> {
    const request = (await database).transaction('STORE').objectStore('STORE').getAllKeys()

    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result.filter(key => typeof key === 'string'))
        request.onerror = () => reject(request.error)
    })
}
