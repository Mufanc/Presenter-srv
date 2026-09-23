export interface RegisterEvent {
    type: 'REGISTER'
    handle: FileSystemHandle
}

export interface RegisteredEvent {
    type: 'REGISTERED'
    error?: string
}

export type WindowEvent = RegisterEvent | RegisteredEvent
