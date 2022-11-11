import { Consumer, ConsumerSubscribeTopics, EachBatchPayload, Kafka, EachMessagePayload } from 'kafkajs'
import { KafkaMessageProcessor } from '../types/kafka/KafkaMessageProcessor'

export default class KafkaConsumer {
  private readonly consumer: Consumer
  private readonly KAFKA_URL: string

  public constructor(kafkaUrl: string) {
    this.KAFKA_URL = kafkaUrl
    this.consumer = this.createKafkaConsumer()
  }

  public async start(eventProcessor: KafkaMessageProcessor, topics: string[]): Promise<void> {
    const subTopics: ConsumerSubscribeTopics = {
      topics,
      fromBeginning: false,
    }

    try {
      console.log('Connecting kafka consumer...')
      await this.consumer.connect()
      console.log('Connected kafka consumer!')
      console.log('Subscribing to kafka topics...')
      await this.consumer.subscribe(subTopics)
      console.log('Subscribed to kafka topics!')

      await this.consumer.run({
        eachMessage: async (messagePayload: EachMessagePayload) => {
          const { topic, message } = messagePayload
          eventProcessor(topic, message)
        },
        eachBatch: async (eachBatchPayload: EachBatchPayload) => {
          const { batch } = eachBatchPayload
          const { topic, messages } = batch
          for (const message of messages) {
            eventProcessor(topic, message)
          }
        },
      })
    } catch (error) {
      console.log('Error: ', error)
    }
  }

  public async startBatched(eventProcessor: KafkaMessageProcessor, topics: string[]): Promise<void> {
    const subTopics: ConsumerSubscribeTopics = {
      topics,
      fromBeginning: false
    }

    try {
      console.log('Connecting kafka consumer...')
      await this.consumer.connect()
      console.log('Connected kafka consumer!')
      console.log('Subscribing to kafka topics...')
      await this.consumer.subscribe(subTopics)
      console.log('Subscribed to kafka topics!')
      await this.consumer.run({
        eachBatch: async (eachBatchPayload: EachBatchPayload) => {
          const { batch } = eachBatchPayload
          const { topic, partition, messages } = batch
          for (const message of messages) {
            const prefix = `${topic}[${partition} | ${message.offset}] / ${message.timestamp}`
            console.log(`- ${prefix} ${message.key}#${message.value}`)
            eventProcessor(topic, message)
          }
        },
      })
    } catch (error) {
      console.log('Error: ', error)
    }
  }

  public async shutdown(): Promise<void> {
    await this.consumer.disconnect()
  }

  private createKafkaConsumer(): Consumer {
    const kafka = new Kafka({
      clientId: 'users-service-consumer',
      brokers: [ this.KAFKA_URL ],
    })

    console.log('Creating kafka consumer...')
    return kafka.consumer({ groupId: 'users-consumer-group' })
  }
}
