import { Kafka, type KafkaConfig, type SASLOptions } from 'kafkajs';

export interface KafkaClientOptions {
  readonly brokers: readonly string[];
  readonly clientId: string;
  readonly ssl?: boolean;
  readonly sasl?: SASLOptions;
}

/** Creates a KafkaJS client from broker configuration. */
export function createKafkaClient(options: KafkaClientOptions): Kafka {
  const config: KafkaConfig = {
    clientId: options.clientId,
    brokers: [...options.brokers],
    retry: {
      retries: 5,
      initialRetryTime: 300,
      maxRetryTime: 30_000,
    },
  };

  if (options.ssl !== undefined) {
    config.ssl = options.ssl;
  }

  if (options.sasl !== undefined) {
    config.sasl = options.sasl;
  }

  return new Kafka(config);
}