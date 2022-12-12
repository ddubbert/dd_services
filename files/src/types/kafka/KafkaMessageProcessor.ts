import { KafkaMessage } from 'kafkajs'

export type KafkaMessageProcessor = (topic: string, message: KafkaMessage) => void
