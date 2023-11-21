interface RegisterEvent {
    type: 'REGISTER'
    handle: FileSystemHandle
}

interface UnregisterEvent {
    type: 'UNREGISTER'
}

interface LoadEvent {
    type: 'LOAD'
    error?: any
    content?: string
}

export type WindowEvent = RegisterEvent | UnregisterEvent | LoadEvent

export type EventType = WindowEvent['type']

export const EventTypes: { [K in EventType]: `${K}` } = {
    REGISTER: 'REGISTER',
    UNREGISTER: 'UNREGISTER',
    LOAD: 'LOAD',
}
