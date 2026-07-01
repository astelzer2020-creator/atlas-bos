export interface CursorPagination {
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
  readonly limit: number;
}

export interface PaginatedResponse<T> {
  readonly data: readonly T[];
  readonly pagination: CursorPagination;
}

export interface CurrentUser {
  readonly id: string;
  readonly email: string;
  readonly email_verified: boolean;
  readonly display_name: string | null;
  readonly status: string;
  readonly type: string;
  readonly locale: string;
  readonly timezone: string;
  readonly avatar_url: string | null;
  readonly created_at: string;
}

export interface Organization {
  readonly object: 'organization';
  readonly id: string;
  readonly workspace_id: string;
  readonly slug: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly status: string;
  readonly timezone: string;
  readonly locale: string;
  readonly currency_code: string;
  readonly data_region: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface CrmAccount {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly legalName: string | null;
  readonly accountType: string;
  readonly industry: string | null;
  readonly website: string | null;
  readonly phone: string | null;
  readonly email: string | null;
  readonly status: string;
  readonly ownerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CrmContact {
  readonly id: string;
  readonly organizationId: string;
  readonly displayName: string;
  readonly firstName: string | null;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly jobTitle: string | null;
  readonly accountId: string | null;
  readonly status: string;
  readonly ownerId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface CrmDeal {
  readonly id: string;
  readonly organizationId: string;
  readonly name: string;
  readonly accountId: string | null;
  readonly contactId: string | null;
  readonly pipelineStageId: string;
  readonly ownerId: string;
  readonly amount: string;
  readonly currencyCode: string;
  readonly probability: number;
  readonly status: string;
  readonly expectedCloseDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface PipelineStage {
  readonly id: string;
  readonly organizationId: string;
  readonly pipelineId: string;
  readonly pipelineName: string;
  readonly name: string;
  readonly sortOrder: number;
  readonly probability: number;
  readonly isDefault: boolean;
  readonly version: number;
}

export interface Project {
  readonly id: string;
  readonly organizationId: string;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string;
  readonly progressPercent: string;
  readonly startDate: string | null;
  readonly targetEndDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface Task {
  readonly id: string;
  readonly organizationId: string;
  readonly projectId: string;
  readonly title: string;
  readonly description: string | null;
  readonly status: string;
  readonly priority: string;
  readonly assigneeId: string | null;
  readonly dueDate: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface ChartOfAccount {
  readonly id: string;
  readonly organizationId: string;
  readonly parentAccountId: string | null;
  readonly code: string;
  readonly name: string;
  readonly description: string | null;
  readonly accountType: string;
  readonly normalBalance: string;
  readonly isActive: boolean;
  readonly currencyCode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface JournalLine {
  readonly id: string;
  readonly lineNumber: number;
  readonly accountId: string;
  readonly description: string | null;
  readonly debitAmount: string;
  readonly creditAmount: string;
  readonly currencyCode: string;
}

export interface JournalEntry {
  readonly id: string;
  readonly organizationId: string;
  readonly entryNumber: string;
  readonly entryDate: string;
  readonly status: string;
  readonly entryType: string;
  readonly description: string;
  readonly currencyCode: string;
  readonly totalDebit: string;
  readonly totalCredit: string;
  readonly lines: readonly JournalLine[];
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface WorkflowDefinition {
  readonly id: string;
  readonly organization_id: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly definition_version: number;
  readonly status: string;
  readonly category: string;
  readonly is_template: boolean;
  readonly published_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface WorkflowInstance {
  readonly id: string;
  readonly organization_id: string;
  readonly definition_id: string;
  readonly definition_version: number;
  readonly status: string;
  readonly entity_type: string | null;
  readonly entity_id: string | null;
  readonly correlation_id: string | null;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface WorkflowApproval {
  readonly id: string;
  readonly organization_id: string;
  readonly instance_id: string;
  readonly step_id: string;
  readonly approval_type: string;
  readonly status: string;
  readonly title: string;
  readonly description: string | null;
  readonly assignee_ids: readonly string[];
  readonly requested_at: string;
  readonly expires_at: string | null;
  readonly resolved_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface AutomationRule {
  readonly id: string;
  readonly organization_id: string;
  readonly name: string;
  readonly description: string | null;
  readonly status: string;
  readonly rule_version: number;
  readonly execution_count: string;
  readonly tags: readonly string[];
  readonly last_executed_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface AgentDefinition {
  readonly id: string;
  readonly organization_id: string | null;
  readonly name: string;
  readonly slug: string;
  readonly description: string | null;
  readonly role: string;
  readonly definition_version: number;
  readonly status: string;
  readonly model_id: string;
  readonly system_prompt: string;
  readonly allowed_tools: readonly string[];
  readonly published_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface AgentRun {
  readonly id: string;
  readonly organization_id: string;
  readonly agent_definition_id: string;
  readonly goal: string;
  readonly status: string;
  readonly status_reason: string | null;
  readonly orchestration_pattern: string;
  readonly iteration_count: number;
  readonly max_iterations: number;
  readonly cost_cents: number;
  readonly started_at: string;
  readonly completed_at: string | null;
  readonly result_summary: string | null;
  readonly created_at: string;
  readonly updated_at: string;
  readonly version: number;
}

export interface KnowledgeDocument {
  readonly id: string;
  readonly organizationId: string;
  readonly title: string;
  readonly description: string | null;
  readonly sourceType: string;
  readonly sourceUri: string | null;
  readonly contentType: string;
  readonly status: string;
  readonly chunkCount: number;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
}

export interface KnowledgeChunk {
  readonly id: string;
  readonly organizationId: string;
  readonly documentId: string;
  readonly chunkIndex: number;
  readonly contentHash: string;
  readonly textContent: string;
  readonly tokenCount: number | null;
  readonly metadata: Record<string, unknown>;
  readonly createdAt: string;
}

export interface Workspace {
  readonly object: 'workspace';
  readonly id: string;
  readonly slug: string;
  readonly name: string;
  readonly display_name: string | null;
  readonly status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface OrganizationMember {
  readonly object: 'member';
  readonly id: string;
  readonly user_id: string;
  readonly status: string;
  readonly is_owner: boolean;
  readonly title: string | null;
  readonly department: string | null;
  readonly joined_at: string;
  readonly user: {
    readonly email: string;
    readonly display_name: string | null;
  };
}

export interface Team {
  readonly object: 'team';
  readonly id: string;
  readonly organization_id: string;
  readonly slug: string;
  readonly name: string;
  readonly description: string | null;
  readonly is_default: boolean;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AuditLogEntry {
  readonly object: 'audit_log_entry';
  readonly id: string;
  readonly organization_id: string;
  readonly actor_id: string | null;
  readonly actor_type: string;
  readonly action: string;
  readonly entity_type: string;
  readonly entity_id: string;
  readonly occurred_at: string;
  readonly metadata: Record<string, unknown>;
}

export interface Notification {
  readonly object: 'notification';
  readonly id: string;
  readonly organization_id: string;
  readonly definition_id: string;
  readonly category: string;
  readonly priority: number;
  readonly recipient_user_id: string;
  readonly title: string;
  readonly body: string | null;
  readonly action_url: string | null;
  readonly status: string;
  readonly read_at: string | null;
  readonly created_at: string;
  readonly updated_at: string;
}