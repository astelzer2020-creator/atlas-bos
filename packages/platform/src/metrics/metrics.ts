export type MetricLabels = Readonly<Record<string, string>>;

export interface HistogramSample {
  readonly name: string;
  readonly value: number;
  readonly labels: MetricLabels;
  readonly observedAt: Date;
}

export interface CounterSample {
  readonly name: string;
  readonly value: number;
  readonly labels: MetricLabels;
  readonly observedAt: Date;
}

export interface MetricsCollector {
  incrementCounter(name: string, labels?: MetricLabels, value?: number): void;
  observeHistogram(name: string, value: number, labels?: MetricLabels): void;
  startTimer(name: string, labels?: MetricLabels): () => void;
}

export interface InMemoryMetricsSnapshot {
  readonly counters: readonly CounterSample[];
  readonly histograms: readonly HistogramSample[];
}

function labelKey(labels: MetricLabels): string {
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join(',');
}

/**
 * No-op metrics collector for tests and environments without observability backends.
 */
export class NoopMetricsCollector implements MetricsCollector {
  incrementCounter(_name: string, _labels?: MetricLabels, _value?: number): void {}

  observeHistogram(_name: string, _value: number, _labels?: MetricLabels): void {}

  startTimer(_name: string, _labels?: MetricLabels): () => void {
    return () => {};
  }
}

/**
 * In-memory metrics collector useful for unit tests and local diagnostics.
 */
export class InMemoryMetricsCollector implements MetricsCollector {
  private readonly counters = new Map<string, number>();
  private readonly counterSamples: CounterSample[] = [];
  private readonly histogramSamples: HistogramSample[] = [];

  incrementCounter(name: string, labels: MetricLabels = {}, value = 1): void {
    const key = `${name}|${labelKey(labels)}`;
    const current = this.counters.get(key) ?? 0;
    const next = current + value;
    this.counters.set(key, next);
    this.counterSamples.push({
      name,
      value: next,
      labels,
      observedAt: new Date(),
    });
  }

  observeHistogram(name: string, value: number, labels: MetricLabels = {}): void {
    this.histogramSamples.push({
      name,
      value,
      labels,
      observedAt: new Date(),
    });
  }

  startTimer(name: string, labels: MetricLabels = {}): () => void {
    const startedAt = performance.now();
    return () => {
      const durationMs = performance.now() - startedAt;
      this.observeHistogram(name, durationMs, labels);
    };
  }

  getCounter(name: string, labels: MetricLabels = {}): number {
    const key = `${name}|${labelKey(labels)}`;
    return this.counters.get(key) ?? 0;
  }

  getHistogramSamples(name?: string): readonly HistogramSample[] {
    if (name === undefined) {
      return [...this.histogramSamples];
    }
    return this.histogramSamples.filter((sample) => sample.name === name);
  }

  snapshot(): InMemoryMetricsSnapshot {
    return {
      counters: [...this.counterSamples],
      histograms: [...this.histogramSamples],
    };
  }

  reset(): void {
    this.counters.clear();
    this.counterSamples.length = 0;
    this.histogramSamples.length = 0;
  }
}

export function createNoopMetricsCollector(): MetricsCollector {
  return new NoopMetricsCollector();
}

export function createInMemoryMetricsCollector(): InMemoryMetricsCollector {
  return new InMemoryMetricsCollector();
}