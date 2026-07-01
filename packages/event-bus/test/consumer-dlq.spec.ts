import { describe, expect, it } from 'vitest';

import { consumerDlqTopic } from '../src/kafka/topic-naming.js';

describe('publishToDlq', () => {
  it('uses atlas.dead-letter.{consumer-group} topic naming', () => {
    expect(consumerDlqTopic('atlas-webhook-dispatcher')).toBe(
      'atlas.dead-letter.atlas-webhook-dispatcher',
    );
  });
});