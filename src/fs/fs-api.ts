import { DirLike, FileLike } from './index'

export class FsDir implements DirLike {
    private readonly dir: FileSystemDirectoryHandle

    constructor(dir: FileSystemDirectoryHandle) {
        this.dir = dir
    }

    async open(path: string): Promise<FileLike | null> {
        const entries = path.split('/')

        function isNotFoundError(err: any) {
            if (err instanceof DOMException && err.name === 'NotFoundError') {
                console.error(`Cannot found ${path} in specific directory!`)
                return true
            } else {
                return false
            }
        }

        try {
            let curr = this.dir
            for (let i = 0; i < entries.length; i++) {
                const name = entries[i]
                if (i + 1 === entries.length) {
                    return new FsFile(await curr.getFileHandle(name))
                } else {
                    curr = await curr.getDirectoryHandle(name)
                }
            }
        } catch (err: any) {
            if (isNotFoundError(err)) return null
            throw err
        }

        return null
    }
}

export class FsFile implements FileLike {
    private readonly handle: FileSystemFileHandle
    private fp?: File

    constructor(handle: FileSystemFileHandle) {
        this.handle = handle
    }

    private async initFp() {
        if (this.fp) return
        this.fp = await this.handle.getFile()
    }

    async name(): Promise<string> {
        await this.initFp()
        return this.fp!.name
    }

    async string(): Promise<string> {
        await this.initFp()
        return await this.fp!.text()
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        await this.initFp()
        return this.fp!.arrayBuffer()
    }
}
