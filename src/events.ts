interface RegisterEvent {
    type: 'REGISTER'
    handle: FileSystemHandle
}

interface RegisteredEvent {
    type: 'REGISTERED'
    error?: any
}

export type WindowEvent = RegisterEvent | RegisteredEvent

export type EventType = WindowEvent['type']

export const EventTypes: { [K in EventType]: `${K}` } = {
    REGISTER: 'REGISTER',
    REGISTERED: 'REGISTERED',
}
