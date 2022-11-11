import KafkaProducer from '../utils/KafkaProducer'
import { EventMessage, verifyEventMessage } from '../types/kafka/EventMessage'
import KafkaConsumer from '../utils/KafkaConsumer'
import { EventMessageProcessor } from '../types/kafka/EventMessageProcessor'
import { KafkaMessage } from 'kafkajs'
import { KafkaTopic } from '../types/kafka/KafkaTopic'

export default class EventHandler {
  private readonly PRODUCER: KafkaProducer
  private readonly CONSUMER: KafkaConsumer
  private messageProcessors: Record<string, EventMessageProcessor[]> = {}

  constructor() {
    console.log(process.env.KAFKA_URL)
    this.PRODUCER = new KafkaProducer(process.env.KAFKA_URL || 'localhost:9092')
    this.CONSUMER = new KafkaConsumer(process.env.KAFKA_URL || 'localhost:9092')
  }

  public addMessageProcessorFor(topic: KafkaTopic, processor: EventMessageProcessor): void {
    if (topic in this.messageProcessors) {this.messageProcessors[topic].push(processor)}
    else {this.messageProcessors[topic] = [ processor ] }
  }

  public async send(topic: string, payloads: EventMessage[]): Promise<void> {
    await this.PRODUCER.sendBatched({
      topic,
      messages: payloads.map(it => ({ value: JSON.stringify(it) })),
    })
  }

  public async start(): Promise<void> {
    await this.PRODUCER.start()
    await this.CONSUMER.start(this.processMessage, Object.keys(this.messageProcessors))
  }

  private processMessage = (topic: string, message: KafkaMessage): void => {
    if (!message.value) {return}

    try {
      const value = JSON.parse(message.value.toString())
      verifyEventMessage(value)

      const processors = (topic in this.messageProcessors) ? this.messageProcessors[topic] : []
      processors.forEach(it => it(value))
    } catch (_e) {
      console.log('Event message in wrong format.')
    }
  }
}
