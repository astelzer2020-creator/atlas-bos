import type { Prisma } from '@atlas/database';
import type { OrganizationId, UserId } from '@atlas/shared-kernel';

export type AgentRole = 'analyst' | 'executor' | 'reviewer' | 'planner' | 'custom';

export type AgentDefinitionStatus = 'draft' | 'published' | 'deprecated' | 'archived';

export interface AgentDefinitionRecord {
  readonly id: string;
  readonly organizationId: OrganizationId | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly role: AgentRole;
  readonly definitionVersion: number;
  readonly status: AgentDefinitionStatus;
  readonly modelId: string;
  readonly systemPrompt: string;
  readonly allowedTools: string[];
  readonly constraints: Record<string, unknown>;
  readonly memoryConfig: Record<string, unknown>;
  readonly riskPolicy: Record<string, unknown>;
  readonly isDefault: boolean;
  readonly publishedAt: Date | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly version: number;
}

export interface CreateAgentDefinitionData {
  readonly organizationId: OrganizationId;
  readonly name: string;
  readonly slug: string;
  readonly role: AgentRole;
  readonly systemPrompt: string;
  readonly description?: string;
  readonly modelId?: string;
  readonly allowedTools?: string[];
  readonly constraints?: Record<string, unknown>;
  readonly memoryConfig?: Record<string, unknown>;
  readonly riskPolicy?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly createdBy?: UserId;
}

export interface UpdateAgentDefinitionData {
  readonly name?: string;
  readonly description?: string | null;
  readonly systemPrompt?: string;
  readonly allowedTools?: string[];
  readonly constraints?: Record<string, unknown>;
  readonly memoryConfig?: Record<string, unknown>;
  readonly riskPolicy?: Record<string, unknown>;
  readonly metadata?: Record<string, unknown>;
  readonly updatedBy?: UserId;
}

export interface ListAgentDefinitionsFilter {
  readonly organizationId: OrganizationId;
  readonly status?: AgentDefinitionStatus;
  readonly role?: AgentRole;
  readonly limit: number;
  readonly cursor?: string;
}

export interface AgentDefinitionRepository {
  findById(
    organizationId: OrganizationId,
    id: string,
  ): Promise<AgentDefinitionRecord | null>;

  findBySlug(
    organizationId: OrganizationId,
    slug: string,
  ): Promise<AgentDefinitionRecord | null>;

  create(data: CreateAgentDefinitionData): Promise<AgentDefinitionRecord>;

  update(
    organizationId: OrganizationId,
    id: string,
    data: UpdateAgentDefinitionData,
    expectedVersion: number,
  ): Promise<AgentDefinitionRecord | null>;

  publish(
    organizationId: OrganizationId,
    id: string,
    publishedAt: Date,
    updatedBy?: UserId,
  ): Promise<AgentDefinitionRecord | null>;

  list(filter: ListAgentDefinitionsFilter): Promise<AgentDefinitionRecord[]>;
}

export type AgentDefinitionRepositoryTx = Prisma.TransactionClient;