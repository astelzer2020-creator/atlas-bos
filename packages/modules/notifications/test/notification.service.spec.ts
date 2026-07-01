import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
  type OrganizationId,
  type UserId,
} from '@atlas/shared-kernel';
import { describe, expect, it, vi } from 'vitest';

import type { DeliveryService } from '../application/services/delivery.service.js';
import { NotificationService } from '../application/services/notification.service.js';
import type {
  NotificationPreferenceRecord,
  NotificationPreferenceRepository,
} from '../domain/repositories/notification-preference.repository.js';
import type {
  NotificationRecord,
  NotificationRepository,
} from '../domain/repositories/notification.repository.js';

const ACTOR_ID = '550e8400-e29b-41d4-a716-446655440000' as UserId;
const RECIPIENT_ID = '6ba7b810-9dad-11d1-80b4-00c04fd430c8' as UserId;
const ORG_ID = '7c9e6679-7425-40de-944b-e07fc1f90ae7' as OrganizationId;
const NOTIFICATION_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';

const sampleNotification: NotificationRecord = {
  id: NOTIFICATION_ID,
  tenantId: ORG_ID,
  definitionId: 'task.assigned',
  category: 'operational',
  priority: 3,
  recipientUserId: RECIPIENT_ID,
  actorUserId: ACTOR_ID,
  actorType: 'user',
  title: 'Task assigned',
  body: 'You have been assigned a new task',
  actionUrl: null,
  entityType: 'task',
  entityId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22',
  payload: { taskId: 'b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22' },
  locale: 'en-US',
  status: 'delivered',
  idempotencyKey: 'task-assigned-001',
  scheduledFor: null,
  expiresAt: null,
  readAt: null,
  dismissedAt: null,
  createdAt: new Date('2026-06-30T08:00:00Z'),
  updatedAt: new Date('2026-06-30T08:00:00Z'),
};

const samplePreference: NotificationPreferenceRecord = {
  id: 'c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a33',
  tenantId: ORG_ID,
  userId: RECIPIENT_ID,
  definitionId: 'task.assigned',
  notificationChannelId: 'd0eebc99-9c0b-4ef8-bb6d-6bb9bd380a44',
  channelType: 'in_app',
  channelCode: 'in_app_sse',
  enabled: true,
  digestMode: 'instant',
  quietHoursOverride: null,
  metadata: {},
  version: 1,
  createdAt: new Date('2026-06-01T08:00:00Z'),
  updatedAt: new Date('2026-06-01T08:00:00Z'),
};

function createLogger() {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn().mockReturnThis(),
  };
}

function createNotificationService(
  repositoryOverrides: Partial<NotificationRepository> = {},
  preferenceOverrides: Partial<NotificationPreferenceRepository> = {},
  deliveryOverrides: Partial<DeliveryService> = {},
) {
  const notificationRepository: NotificationRepository = {
    findById: vi.fn().mockResolvedValue(null),
    findByIdempotencyKey: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue(sampleNotification),
    listInbox: vi.fn().mockResolvedValue([sampleNotification]),
    markAsRead: vi.fn().mockResolvedValue(sampleNotification),
    dismiss: vi.fn().mockResolvedValue(sampleNotification),
    updateStatus: vi.fn().mockResolvedValue(undefined),
    findChannelByType: vi.fn().mockResolvedValue(null),
    createDelivery: vi.fn(),
    findDeliveryByIdempotencyKey: vi.fn().mockResolvedValue(null),
    listPendingDeliveries: vi.fn().mockResolvedValue([]),
    updateDelivery: vi.fn(),
    listDeliveriesByNotificationId: vi.fn().mockResolvedValue([]),
    ...repositoryOverrides,
  };

  const preferenceRepository: NotificationPreferenceRepository = {
    findByUser: vi.fn().mockResolvedValue([]),
    upsert: vi.fn().mockResolvedValue(samplePreference),
    bulkUpsert: vi.fn().mockResolvedValue([samplePreference]),
    ...preferenceOverrides,
  };

  const deliveryService = {
    queueDelivery: vi.fn().mockResolvedValue({ ok: true, value: { deliveries: [], inAppDelivered: false } }),
    processPendingDeliveries: vi.fn(),
    ...deliveryOverrides,
  } as unknown as DeliveryService;

  return {
    service: new NotificationService({
      notificationRepository,
      preferenceRepository,
      deliveryService,
      logger: createLogger(),
    }),
    notificationRepository,
    preferenceRepository,
    deliveryService,
  };
}

describe('NotificationService', () => {
  it('creates a notification and queues delivery', async () => {
    const { service, notificationRepository, deliveryService } = createNotificationService({
      findById: vi.fn().mockResolvedValue(sampleNotification),
    });

    const result = await service.sendNotification(
      ORG_ID,
      {
        definition_id: 'task.assigned',
        category: 'operational',
        recipient_user_id: RECIPIENT_ID,
        title: 'Task assigned',
        idempotency_key: 'task-assigned-001',
      },
      ACTOR_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe('Task assigned');
      expect(result.value.organization_id).toBe(ORG_ID);
    }

    expect(notificationRepository.create).toHaveBeenCalledOnce();
    expect(deliveryService.queueDelivery).toHaveBeenCalledOnce();
  });

  it('returns existing notification on duplicate idempotency key', async () => {
    const { service, notificationRepository, deliveryService } = createNotificationService({
      findByIdempotencyKey: vi.fn().mockResolvedValue(sampleNotification),
    });

    const result = await service.sendNotification(
      ORG_ID,
      {
        definition_id: 'task.assigned',
        category: 'operational',
        recipient_user_id: RECIPIENT_ID,
        title: 'Task assigned',
        idempotency_key: 'task-assigned-001',
      },
      ACTOR_ID,
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.id).toBe(NOTIFICATION_ID);
    }

    expect(notificationRepository.create).not.toHaveBeenCalled();
    expect(deliveryService.queueDelivery).not.toHaveBeenCalled();
  });

  it('rejects send when title is empty', async () => {
    const { service } = createNotificationService();

    const result = await service.sendNotification(
      ORG_ID,
      {
        definition_id: 'task.assigned',
        category: 'operational',
        recipient_user_id: RECIPIENT_ID,
        title: '   ',
        idempotency_key: 'task-assigned-002',
      },
      ACTOR_ID,
    );

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ValidationError);
    }
  });

  it('lists inbox notifications for recipient', async () => {
    const { service, notificationRepository } = createNotificationService();

    const inbox = await service.listInbox(ORG_ID, RECIPIENT_ID, { limit: 10 });

    expect(inbox.data).toHaveLength(1);
    expect(inbox.data[0]?.title).toBe('Task assigned');
    expect(notificationRepository.listInbox).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: ORG_ID,
        recipientUserId: RECIPIENT_ID,
        limit: 10,
      }),
    );
  });

  it('marks notification as read for recipient', async () => {
    const readNotification: NotificationRecord = {
      ...sampleNotification,
      readAt: new Date('2026-06-30T09:00:00Z'),
    };

    const { service, notificationRepository } = createNotificationService({
      markAsRead: vi.fn().mockResolvedValue(readNotification),
    });

    const result = await service.markAsRead(ORG_ID, NOTIFICATION_ID, RECIPIENT_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.read_at).not.toBeNull();
    }

    expect(notificationRepository.markAsRead).toHaveBeenCalledWith(
      ORG_ID,
      NOTIFICATION_ID,
      RECIPIENT_ID,
    );
  });

  it('returns not found when marking unknown notification', async () => {
    const { service, notificationRepository } = createNotificationService({
      markAsRead: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(null),
    });

    const result = await service.markAsRead(ORG_ID, NOTIFICATION_ID, RECIPIENT_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(NotFoundError);
    }

    expect(notificationRepository.markAsRead).toHaveBeenCalledOnce();
  });

  it('returns forbidden when recipient does not own notification', async () => {
    const { service } = createNotificationService({
      markAsRead: vi.fn().mockResolvedValue(null),
      findById: vi.fn().mockResolvedValue(sampleNotification),
    });

    const result = await service.markAsRead(ORG_ID, NOTIFICATION_ID, ACTOR_ID);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeInstanceOf(ForbiddenError);
    }
  });

  it('dismisses notification for recipient', async () => {
    const dismissedNotification: NotificationRecord = {
      ...sampleNotification,
      dismissedAt: new Date('2026-06-30T10:00:00Z'),
    };

    const { service, notificationRepository } = createNotificationService({
      dismiss: vi.fn().mockResolvedValue(dismissedNotification),
    });

    const result = await service.dismiss(ORG_ID, NOTIFICATION_ID, RECIPIENT_ID);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.dismissed_at).not.toBeNull();
    }

    expect(notificationRepository.dismiss).toHaveBeenCalledWith(
      ORG_ID,
      NOTIFICATION_ID,
      RECIPIENT_ID,
    );
  });

  it('returns user notification preferences', async () => {
    const { service, preferenceRepository } = createNotificationService(
      {},
      {
        findByUser: vi.fn().mockResolvedValue([samplePreference]),
      },
    );

    const preferences = await service.getPreferences(ORG_ID, RECIPIENT_ID);

    expect(preferences).toHaveLength(1);
    expect(preferences[0]?.definition_id).toBe('task.assigned');
    expect(preferenceRepository.findByUser).toHaveBeenCalledWith(ORG_ID, RECIPIENT_ID);
  });

  it('updates notification preferences', async () => {
    const { service, preferenceRepository } = createNotificationService();

    const preferences = await service.updatePreferences(ORG_ID, RECIPIENT_ID, {
      preferences: [
        {
          definition_id: 'task.assigned',
          channel_type: 'email',
          enabled: false,
        },
      ],
    });

    expect(preferences).toHaveLength(1);
    expect(preferenceRepository.bulkUpsert).toHaveBeenCalledOnce();
  });
});