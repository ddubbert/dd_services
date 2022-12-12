import { Kafka, Partitioners, Producer, ProducerBatch, TopicMessages } from 'kafkajs'

export default class KafkaProducer {
  private readonly KAFKA_URL: string
  private producer: Producer

  constructor(kafkaUrl: string) {
    this.KAFKA_URL = kafkaUrl
    this.producer = this.createProducer()
  }

  public async start(): Promise<void> {
    try {
      console.log('Connecting kafka producer...')
      await this.producer.connect()
      console.log('Connected kafka producer!')
    } catch (error) {
      console.log('Error connecting the producer: ', error)
    }
  }

  public async shutdown(): Promise<void> {
    await this.producer.disconnect()
  }

  public async sendBatched(messages: TopicMessages): Promise<void> {
    const batch: ProducerBatch = {
      topicMessages: [ messages ],
    }

    await this.producer.sendBatch(batch)
  }

  private createProducer(): Producer {
    const kafka = new Kafka({
      clientId: 'files-service-producer',
      brokers: [ this.KAFKA_URL ],
    })

    console.log('Creating kafka producer...')
    return kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner })
  }
}
