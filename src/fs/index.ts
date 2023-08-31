import { FsDir } from './fs-api'
import { ZipFile } from './jszip'

export interface DirLike {
    open(path: string): Promise<FileLike | null>
}

export interface FileLike {
    name(): Promise<string>
    string(): Promise<string>
    arrayBuffer(): Promise<ArrayBuffer>
}

export function createDirLike(handle: FileSystemHandle): DirLike | null {
    try {
        if (handle instanceof FileSystemDirectoryHandle) {
            return new FsDir(handle)
        }

        if (handle instanceof FileSystemFileHandle) {
            return new ZipFile(handle)
        }
    } catch (err: any) {
        console.error(err)
    }

    return null
}
