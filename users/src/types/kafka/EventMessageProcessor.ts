import { EventMessage } from './EventMessage'

export type EventMessageProcessor = (message: EventMessage) => Promise<void>|void
