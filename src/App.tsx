import type { RegisteredEvent } from '@/events'
import { getHandle, lastHandleKey, setHandle } from '@/persistence'
import { useEffect, useRef, useState } from 'react'
import type { DragEvent } from 'react'

const abortError = (error: unknown) => error instanceof DOMException && error.name === 'AbortError'

export default function App() {
    const [history, setHistory] = useState<FileSystemHandle | null>(null)
    const [dragging, setDragging] = useState(false)
    const [opening, setOpening] = useState(false)
    const [pickerOpen, setPickerOpen] = useState(false)
    const [error, setError] = useState('')
    const [unavailable, setUnavailable] = useState(false)
    const dragDepth = useRef(0)
    const archiveButton = useRef<HTMLButtonElement>(null)

    useEffect(() => {
        getHandle(lastHandleKey)
            .then(setHistory)
            .catch(() => setHistory(null))

        if (!window.isSecureContext) {
            setUnavailable(true)
            setError('需要通过 HTTPS 访问')
        } else if (!navigator.serviceWorker?.controller) {
            setUnavailable(true)
            setError('Service Worker 不可用')
        }

        const onMessage = ({ data }: MessageEvent<RegisteredEvent>) => {
            if (data.type !== 'REGISTERED') return
            if (data.error) {
                setOpening(false)
                setError(data.error)
            } else {
                window.location.reload()
            }
        }
        const onControllerChange = () => window.location.reload()

        navigator.serviceWorker?.addEventListener('message', onMessage)
        navigator.serviceWorker?.addEventListener('controllerchange', onControllerChange)

        return () => {
            navigator.serviceWorker?.removeEventListener('message', onMessage)
            navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
        }
    }, [])

    async function open(handle: FileSystemHandle) {
        setOpening(true)
        setError('')

        try {
            let permission = await handle.queryPermission({ mode: 'read' })
            if (permission === 'prompt')
                permission = await handle.requestPermission({ mode: 'read' })
            if (permission !== 'granted') throw new Error('没有文件读取权限')

            await setHandle(lastHandleKey, handle)
            navigator.serviceWorker.controller?.postMessage({ type: 'REGISTER', handle })
        } catch (error) {
            setOpening(false)
            if (!abortError(error)) setError(error instanceof Error ? error.message : String(error))
        }
    }

    async function pickDirectory() {
        setPickerOpen(false)
        try {
            await open(await window.showDirectoryPicker({ mode: 'read' }))
        } catch (error) {
            if (!abortError(error)) setError(error instanceof Error ? error.message : String(error))
        }
    }

    async function pickArchive() {
        setPickerOpen(false)
        try {
            const [handle] = await window.showOpenFilePicker({
                multiple: false,
                types: [
                    {
                        description: 'ZIP / TAR 压缩包',
                        accept: {
                            'application/zip': ['.zip'],
                            'application/x-tar': ['.tar'],
                        },
                    },
                ],
            })
            if (handle) await open(handle)
        } catch (error) {
            if (!abortError(error)) setError(error instanceof Error ? error.message : String(error))
        }
    }

    function revealPicker() {
        setPickerOpen(true)
        requestAnimationFrame(() => archiveButton.current?.focus())
    }

    function enterDropZone(event: DragEvent) {
        event.preventDefault()
        if (++dragDepth.current === 1) setDragging(true)
    }

    function leaveDropZone(event: DragEvent) {
        event.preventDefault()
        dragDepth.current = Math.max(0, dragDepth.current - 1)
        if (dragDepth.current === 0) setDragging(false)
    }

    async function drop(event: DragEvent) {
        event.preventDefault()
        dragDepth.current = 0
        setDragging(false)
        const handle = await event.dataTransfer.items[0]?.getAsFileSystemHandle()
        if (handle) await open(handle)
    }

    const historyLabel = history
        ? `继续打开 ${history.kind === 'directory' ? '文件夹' : '文件'}「${history.name}」`
        : ''

    return (
        <main className="stage">
            <section
                className={`launcher${dragging ? ' is-dragging' : ''}`}
                onDragEnter={enterDropZone}
                onDragLeave={leaveDropZone}
                onDragOver={event => event.preventDefault()}
                onDrop={drop}
            >
                <div className="frame" aria-hidden="true">
                    <span />
                    <span />
                    <span />
                    <span />
                </div>

                {history && (
                    <div className="history-control">
                        <button
                            className="history-button"
                            disabled={opening || unavailable}
                            aria-label={historyLabel}
                            onClick={() => open(history)}
                        >
                            <span>{history.name}</span>
                            <svg viewBox="0 0 24 24" aria-hidden="true">
                                <path d="M3 12a9 9 0 1 0 3-6.7M3 4v5h5M12 7v5l3 2" />
                            </svg>
                        </button>
                    </div>
                )}

                <p className="eyebrow">LOCAL SLIDE RUNTIME</p>
                <h1>
                    Presenter<span>/srv</span>
                </h1>
                <p className="lede">把构建结果交给浏览器，直接开始演示。</p>

                <div className="actions">
                    <div
                        className={`picker-stack${pickerOpen ? ' is-open' : ''}`}
                        onBlur={event => {
                            if (!event.currentTarget.contains(event.relatedTarget))
                                setPickerOpen(false)
                        }}
                    >
                        <button
                            className="primary picker-cover"
                            disabled={opening || unavailable}
                            aria-expanded={pickerOpen}
                            aria-haspopup="menu"
                            onClick={revealPicker}
                        >
                            {opening ? '正在打开…' : '打开演示'}
                        </button>
                        <button
                            ref={archiveButton}
                            className="primary picker-option picker-archive"
                            disabled={opening || unavailable}
                            onClick={pickArchive}
                        >
                            ZIP / TAR
                        </button>
                        <button
                            className="secondary picker-option picker-directory"
                            disabled={opening || unavailable}
                            onClick={pickDirectory}
                        >
                            文件夹
                        </button>
                    </div>
                </div>

                {error && (
                    <p className="error" role="alert">
                        {error}
                    </p>
                )}

                <div className="drop-hint">
                    <span>或拖入 web-app 文件夹 / ZIP / TAR</span>
                    <span className="line" />
                </div>

                <details>
                    <summary>这是做什么的？</summary>
                    <p>
                        Presenter-srv 在 Chromium 浏览器中直接运行 Presenter 导出的 Slidev SPA。
                        文件只在本地读取，不会上传。
                    </p>
                </details>
            </section>
        </main>
    )
}
