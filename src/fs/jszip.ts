import JSZip from 'jszip'
import { DirLike, FileLike } from './index'

export class ZipFile implements DirLike {
    private readonly fp: FileSystemFileHandle
    private zip?: JSZip

    constructor(fp: FileSystemFileHandle) {
        this.fp = fp
    }

    private async initZip() {
        if (this.zip) return
        this.zip = await JSZip.loadAsync(await this.fp.getFile())
    }

    async open(path: string): Promise<FileLike | null> {
        await this.initZip()

        const fp = this.zip!.file(path)
        if (!fp) return null

        return new ZipEntry(fp)
    }
}

export class ZipEntry implements FileLike {
    private readonly fp: JSZip.JSZipObject

    constructor(fp: JSZip.JSZipObject) {
        this.fp = fp
    }

    async name(): Promise<string> {
        return this.fp.name
    }

    async string(): Promise<string> {
        return this.fp.async('string')
    }

    async arrayBuffer(): Promise<ArrayBuffer> {
        return this.fp.async('arraybuffer')
    }
}
