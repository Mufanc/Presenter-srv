import { Tar, Zip } from '@zenfs/archives'
import { bindContext, resolveMountConfig } from '@zenfs/core'
import { WebAccess } from '@zenfs/dom'

export interface DirLike {
    open(path: string): Promise<Uint8Array<ArrayBuffer> | null>
}

export const backendKind = ({ kind, name }: Pick<FileSystemHandle, 'kind' | 'name'>) =>
    kind === 'directory'
        ? 'directory'
        : kind === 'file' && /\.zip$/i.test(name)
          ? 'zip'
          : kind === 'file' && /\.tar$/i.test(name)
            ? 'tar'
            : null

export async function createDirLike(handle: FileSystemHandle): Promise<DirLike | null> {
    const kind = backendKind(handle)
    if (!kind) return null

    let backend
    if (kind === 'directory') {
        backend = await resolveMountConfig({
            backend: WebAccess,
            handle: handle as FileSystemDirectoryHandle,
        })
    } else {
        const data = await (await (handle as FileSystemFileHandle).getFile()).arrayBuffer()
        backend =
            kind === 'zip'
                ? await resolveMountConfig({ backend: Zip, data })
                : await resolveMountConfig({ backend: Tar, data: new Uint8Array(data) })
    }
    const { fs } = bindContext({ mounts: { '/': backend } })

    return {
        async open(path) {
            try {
                return await fs.promises.readFile(`/${path.replace(/^\/+/, '')}`)
            } catch (error) {
                if (
                    error &&
                    typeof error === 'object' &&
                    'code' in error &&
                    error.code === 'ENOENT'
                )
                    return null
                throw error
            }
        },
    }
}
