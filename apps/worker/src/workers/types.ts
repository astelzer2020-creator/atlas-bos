export interface WorkerProcessor {
  readonly name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}