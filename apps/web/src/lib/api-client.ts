const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export interface ProblemDetails {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly instance?: string;
  readonly request_id?: string;
  readonly code?: string;
  readonly errors?: readonly {
    readonly field: string;
    readonly code: string;
    readonly message: string;
  }[];
}

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.status = status;
    this.problem = problem;
  }

  get fieldErrors(): Record<string, string> {
    if (!this.problem.errors) {
      return {};
    }
    return Object.fromEntries(
      this.problem.errors.map((error) => [error.field, error.message]),
    );
  }
}

export interface LoginRequest {
  readonly email: string;
  readonly password: string;
  readonly organization_id?: string;
  readonly remember_device?: boolean;
}

export interface LoginResponse {
  readonly mfa_required: boolean;
  readonly access_token?: string;
  readonly refresh_token?: string;
  readonly token_type?: 'Bearer';
  readonly expires_in?: number;
  readonly session_id?: string;
  readonly user?: {
    readonly id: string;
    readonly email: string;
    readonly display_name: string | null;
    readonly email_verified: boolean;
  };
}

export interface RegisterRequest {
  readonly email: string;
  readonly password: string;
  readonly display_name: string;
  readonly locale?: string;
  readonly timezone?: string;
  readonly accept_terms: boolean;
}

export interface RegisterResponse {
  readonly user_id: string;
  readonly email: string;
  readonly status: 'PENDING_VERIFICATION';
  readonly verification_sent: boolean;
  readonly verification_expires_at: string;
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  readonly body?: unknown;
  readonly accessToken?: string;
}

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.accessToken) {
    headers.set('Authorization', `Bearer ${options.accessToken}`);
  }

  const init: RequestInit = {
    headers,
    credentials: 'include',
  };

  if (options.method !== undefined) {
    init.method = options.method;
  }

  if (options.cache !== undefined) {
    init.cache = options.cache;
  }

  if (options.signal !== undefined) {
    init.signal = options.signal;
  }

  if (options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, init);

  if (response.status === 204) {
    return undefined as T;
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.includes('application/json') && !contentType.includes('application/problem+json')) {
    if (!response.ok) {
      throw new ApiError(response.status, {
        type: 'about:blank',
        title: 'Request Failed',
        status: response.status,
        detail: response.statusText,
      });
    }
    return undefined as T;
  }

  const data = (await response.json()) as T | ProblemDetails;

  if (!response.ok) {
    throw new ApiError(response.status, data as ProblemDetails);
  }

  return data as T;
}

import type {
  AgentDefinition,
  AgentRun,
  AuditLogEntry,
  AutomationRule,
  ChartOfAccount,
  CrmAccount,
  CrmContact,
  CrmDeal,
  CurrentUser,
  CursorPagination,
  JournalEntry,
  KnowledgeDocument,
  Notification,
  Organization,
  OrganizationMember,
  PaginatedResponse,
  PipelineStage,
  Project,
  Task,
  Team,
  WorkflowApproval,
  WorkflowDefinition,
  WorkflowInstance,
  Workspace,
} from './api-types';

interface SnakePagination {
  readonly has_more: boolean;
  readonly next_cursor: string | null;
  readonly prev_cursor?: string | null;
  readonly limit: number;
}

interface CamelPagination {
  readonly hasMore: boolean;
  readonly nextCursor: string | null;
  readonly limit: number;
}

interface SnakePaginatedResponse<T> {
  readonly data: readonly T[];
  readonly pagination: SnakePagination;
}

interface CamelPaginatedResponse<T> {
  readonly data: readonly T[];
  readonly pagination: CamelPagination;
}

function normalizePagination(
  pagination: SnakePagination | CamelPagination,
): CursorPagination {
  if ('hasMore' in pagination) {
    return pagination;
  }
  return {
    hasMore: pagination.has_more,
    nextCursor: pagination.next_cursor,
    limit: pagination.limit,
  };
}

function normalizePaginated<T>(
  response: SnakePaginatedResponse<T> | CamelPaginatedResponse<T>,
): PaginatedResponse<T> {
  return {
    data: response.data,
    pagination: normalizePagination(response.pagination),
  };
}

function orgPath(organizationId: string, path: string): string {
  return `/v1/organizations/${organizationId}${path}`;
}

function withAuth(accessToken: string): { accessToken: string } {
  return { accessToken };
}

export const authApi = {
  login(input: LoginRequest): Promise<LoginResponse> {
    return apiFetch<LoginResponse>('/v1/auth/login', {
      method: 'POST',
      body: input,
    });
  },

  register(input: RegisterRequest): Promise<RegisterResponse> {
    return apiFetch<RegisterResponse>('/v1/auth/register', {
      method: 'POST',
      body: input,
    });
  },

  logout(accessToken?: string): Promise<undefined> {
    return apiFetch<undefined>('/v1/auth/logout', {
      method: 'POST',
      ...(accessToken !== undefined ? { accessToken } : {}),
    });
  },

  me(accessToken: string): Promise<CurrentUser> {
    return apiFetch<CurrentUser>('/v1/auth/me', withAuth(accessToken));
  },

  verifyMfa(body: { session_id: string; code: string }): Promise<LoginResponse> {
    return apiFetch<LoginResponse>('/v1/auth/mfa/verify', {
      method: 'POST',
      body,
    });
  },
};

export const userApi = {
  getProfile(accessToken: string): Promise<{ data: CurrentUser & { object: 'user' } }> {
    return apiFetch('/v1/users/me', withAuth(accessToken));
  },

  updateProfile(
    accessToken: string,
    body: {
      display_name?: string;
      locale?: string;
      timezone?: string;
    },
  ): Promise<{ data: CurrentUser & { object: 'user' } }> {
    return apiFetch('/v1/users/me', {
      method: 'PATCH',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const workspaceApi = {
  list(accessToken: string): Promise<PaginatedResponse<Workspace>> {
    return apiFetch<SnakePaginatedResponse<Workspace>>('/v1/workspaces', withAuth(accessToken)).then(
      normalizePaginated,
    );
  },

  create(
    accessToken: string,
    body: { slug: string; name: string; display_name?: string },
  ): Promise<Workspace> {
    return apiFetch<{ data: Workspace }>('/v1/workspaces', {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    }).then((response) => response.data);
  },
};

export const organizationApi = {
  list(accessToken: string): Promise<PaginatedResponse<Organization>> {
    return apiFetch<SnakePaginatedResponse<Organization>>('/v1/organizations', withAuth(accessToken)).then(
      normalizePaginated,
    );
  },

  create(
    accessToken: string,
    body: {
      workspace_id: string;
      slug: string;
      name: string;
      display_name?: string;
      timezone?: string;
      locale?: string;
      currency_code?: string;
      data_region?: string;
    },
  ): Promise<Organization> {
    return apiFetch<{ data: Organization }>('/v1/organizations', {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    }).then((response) => response.data);
  },

  get(accessToken: string, organizationId: string): Promise<Organization> {
    return apiFetch<Organization>(`/v1/organizations/${organizationId}`, withAuth(accessToken));
  },

  listMembers(
    accessToken: string,
    organizationId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<PaginatedResponse<OrganizationMember>> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options?.cursor !== undefined) {
      params.set('cursor', options.cursor);
    }
    const query = params.toString();
    return apiFetch<SnakePaginatedResponse<OrganizationMember>>(
      `/v1/organizations/${organizationId}/members${query ? `?${query}` : ''}`,
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  update(
    accessToken: string,
    organizationId: string,
    body: {
      name?: string;
      display_name?: string | null;
      timezone?: string;
      locale?: string;
      currency_code?: string;
    },
  ): Promise<Organization> {
    return apiFetch(`/v1/organizations/${organizationId}`, {
      method: 'PATCH',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const teamApi = {
  list(accessToken: string, organizationId: string): Promise<PaginatedResponse<Team>> {
    return apiFetch<SnakePaginatedResponse<Team>>(
      `/v1/organizations/${organizationId}/teams`,
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  create(
    accessToken: string,
    organizationId: string,
    body: { slug: string; name: string; description?: string },
  ): Promise<Team> {
    return apiFetch<{ data: Team }>(`/v1/organizations/${organizationId}/teams`, {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    }).then((response) => response.data);
  },

  addMember(
    accessToken: string,
    organizationId: string,
    teamId: string,
    body: { user_id: string; role?: 'LEAD' | 'MEMBER' },
  ): Promise<unknown> {
    return apiFetch(`/v1/organizations/${organizationId}/teams/${teamId}/members`, {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const auditApi = {
  list(
    accessToken: string,
    organizationId: string,
    options?: { limit?: number; cursor?: string; action?: string },
  ): Promise<PaginatedResponse<AuditLogEntry>> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options?.cursor !== undefined) {
      params.set('cursor', options.cursor);
    }
    if (options?.action !== undefined) {
      params.set('action', options.action);
    }
    const query = params.toString();
    return apiFetch<SnakePaginatedResponse<AuditLogEntry>>(
      orgPath(organizationId, `/audit-log${query ? `?${query}` : ''}`),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },
};

export const crmApi = {
  listAccounts(accessToken: string, organizationId: string): Promise<PaginatedResponse<CrmAccount>> {
    return apiFetch<CamelPaginatedResponse<CrmAccount>>(
      orgPath(organizationId, '/accounts'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  getAccount(accessToken: string, organizationId: string, accountId: string): Promise<CrmAccount> {
    return apiFetch(orgPath(organizationId, `/accounts/${accountId}`), withAuth(accessToken));
  },

  createAccount(
    accessToken: string,
    organizationId: string,
    body: { name: string; accountType?: string; email?: string; phone?: string; industry?: string },
  ): Promise<CrmAccount> {
    return apiFetch(orgPath(organizationId, '/accounts'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  updateAccount(
    accessToken: string,
    organizationId: string,
    accountId: string,
    body: {
      name?: string;
      email?: string;
      phone?: string;
      industry?: string;
      status?: string;
    },
  ): Promise<CrmAccount> {
    return apiFetch(orgPath(organizationId, `/accounts/${accountId}`), {
      method: 'PATCH',
      body,
      ...withAuth(accessToken),
    });
  },

  listContacts(accessToken: string, organizationId: string): Promise<PaginatedResponse<CrmContact>> {
    return apiFetch<CamelPaginatedResponse<CrmContact>>(
      orgPath(organizationId, '/contacts'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  getContact(accessToken: string, organizationId: string, contactId: string): Promise<CrmContact> {
    return apiFetch(orgPath(organizationId, `/contacts/${contactId}`), withAuth(accessToken));
  },

  createContact(
    accessToken: string,
    organizationId: string,
    body: {
      displayName: string;
      email?: string;
      phone?: string;
      jobTitle?: string;
      accountId?: string;
    },
  ): Promise<CrmContact> {
    return apiFetch(orgPath(organizationId, '/contacts'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  updateContact(
    accessToken: string,
    organizationId: string,
    contactId: string,
    body: {
      displayName?: string;
      email?: string;
      phone?: string;
      jobTitle?: string;
      status?: string;
    },
  ): Promise<CrmContact> {
    return apiFetch(orgPath(organizationId, `/contacts/${contactId}`), {
      method: 'PATCH',
      body,
      ...withAuth(accessToken),
    });
  },

  listDeals(accessToken: string, organizationId: string): Promise<PaginatedResponse<CrmDeal>> {
    return apiFetch<CamelPaginatedResponse<CrmDeal>>(
      orgPath(organizationId, '/deals'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  getDeal(accessToken: string, organizationId: string, dealId: string): Promise<CrmDeal> {
    return apiFetch(orgPath(organizationId, `/deals/${dealId}`), withAuth(accessToken));
  },

  createDeal(
    accessToken: string,
    organizationId: string,
    body: {
      name: string;
      pipelineStageId: string;
      ownerId: string;
      amount?: string;
      accountId?: string;
      contactId?: string;
    },
  ): Promise<CrmDeal> {
    return apiFetch(orgPath(organizationId, '/deals'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  updateDeal(
    accessToken: string,
    organizationId: string,
    dealId: string,
    body: {
      name?: string;
      amount?: string;
      status?: string;
      pipelineStageId?: string;
    },
  ): Promise<CrmDeal> {
    return apiFetch(orgPath(organizationId, `/deals/${dealId}`), {
      method: 'PATCH',
      body,
      ...withAuth(accessToken),
    });
  },

  listPipelineStages(
    accessToken: string,
    organizationId: string,
  ): Promise<PaginatedResponse<PipelineStage>> {
    return apiFetch<CamelPaginatedResponse<PipelineStage>>(
      orgPath(organizationId, '/pipeline-stages'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  createPipelineStage(
    accessToken: string,
    organizationId: string,
    body: { name: string; pipelineName?: string; isDefault?: boolean },
  ): Promise<PipelineStage> {
    return apiFetch(orgPath(organizationId, '/pipeline-stages'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const projectsApi = {
  list(accessToken: string, organizationId: string): Promise<PaginatedResponse<Project>> {
    return apiFetch<CamelPaginatedResponse<Project>>(
      orgPath(organizationId, '/projects'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  get(accessToken: string, organizationId: string, projectId: string): Promise<Project> {
    return apiFetch(orgPath(organizationId, `/projects/${projectId}`), withAuth(accessToken));
  },

  create(
    accessToken: string,
    organizationId: string,
    body: { code: string; name: string; description?: string; status?: string; priority?: string },
  ): Promise<Project> {
    return apiFetch(orgPath(organizationId, '/projects'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  listTasks(
    accessToken: string,
    organizationId: string,
    projectId: string,
  ): Promise<PaginatedResponse<Task>> {
    return apiFetch<CamelPaginatedResponse<Task>>(
      orgPath(organizationId, `/projects/${projectId}/tasks`),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  createTask(
    accessToken: string,
    organizationId: string,
    projectId: string,
    body: { title: string; description?: string; status?: string; priority?: string },
  ): Promise<Task> {
    return apiFetch(orgPath(organizationId, `/projects/${projectId}/tasks`), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const financeApi = {
  listAccounts(
    accessToken: string,
    organizationId: string,
  ): Promise<PaginatedResponse<ChartOfAccount>> {
    return apiFetch<CamelPaginatedResponse<ChartOfAccount>>(
      orgPath(organizationId, '/chart-of-accounts'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  createAccount(
    accessToken: string,
    organizationId: string,
    body: {
      code: string;
      name: string;
      accountType: string;
      normalBalance: string;
      description?: string;
    },
  ): Promise<ChartOfAccount> {
    return apiFetch(orgPath(organizationId, '/chart-of-accounts'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  listJournalEntries(
    accessToken: string,
    organizationId: string,
  ): Promise<PaginatedResponse<JournalEntry>> {
    return apiFetch<CamelPaginatedResponse<JournalEntry>>(
      orgPath(organizationId, '/journal-entries'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  createJournalEntry(
    accessToken: string,
    organizationId: string,
    body: {
      description: string;
      lines: Array<{
        accountId: string;
        debitAmount?: string;
        creditAmount?: string;
        description?: string;
      }>;
    },
  ): Promise<JournalEntry> {
    return apiFetch(orgPath(organizationId, '/journal-entries'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const workflowApi = {
  listDefinitions(
    accessToken: string,
    organizationId: string,
  ): Promise<PaginatedResponse<WorkflowDefinition>> {
    return apiFetch<SnakePaginatedResponse<WorkflowDefinition>>(
      orgPath(organizationId, '/workflow-definitions'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  createDefinition(
    accessToken: string,
    organizationId: string,
    body: { name: string; slug: string; description?: string; category?: string },
  ): Promise<WorkflowDefinition> {
    return apiFetch(orgPath(organizationId, '/workflow-definitions'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  listInstances(
    accessToken: string,
    organizationId: string,
  ): Promise<PaginatedResponse<WorkflowInstance>> {
    return apiFetch<SnakePaginatedResponse<WorkflowInstance>>(
      orgPath(organizationId, '/workflow-instances'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  listApprovals(
    accessToken: string,
    organizationId: string,
  ): Promise<PaginatedResponse<WorkflowApproval>> {
    return apiFetch<SnakePaginatedResponse<WorkflowApproval>>(
      orgPath(organizationId, '/approvals'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  approve(
    accessToken: string,
    organizationId: string,
    approvalId: string,
    body?: { comment?: string },
  ): Promise<WorkflowApproval> {
    return apiFetch(orgPath(organizationId, `/approvals/${approvalId}/approve`), {
      method: 'POST',
      body: body ?? {},
      ...withAuth(accessToken),
    });
  },

  reject(
    accessToken: string,
    organizationId: string,
    approvalId: string,
    body: { reason: string },
  ): Promise<WorkflowApproval> {
    return apiFetch(orgPath(organizationId, `/approvals/${approvalId}/reject`), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const automationApi = {
  listRules(accessToken: string, organizationId: string): Promise<PaginatedResponse<AutomationRule>> {
    return apiFetch<SnakePaginatedResponse<AutomationRule>>(
      orgPath(organizationId, '/automation-rules'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  createRule(
    accessToken: string,
    organizationId: string,
    body: { name: string; description?: string },
  ): Promise<AutomationRule> {
    return apiFetch(orgPath(organizationId, '/automation-rules'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const aiApi = {
  listAgents(
    accessToken: string,
    organizationId: string,
  ): Promise<PaginatedResponse<AgentDefinition>> {
    return apiFetch<SnakePaginatedResponse<AgentDefinition>>(
      orgPath(organizationId, '/agent-definitions'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  createAgent(
    accessToken: string,
    organizationId: string,
    body: {
      name: string;
      slug: string;
      role: string;
      system_prompt: string;
      description?: string;
    },
  ): Promise<AgentDefinition> {
    return apiFetch(orgPath(organizationId, '/agent-definitions'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  listRuns(accessToken: string, organizationId: string): Promise<PaginatedResponse<AgentRun>> {
    return apiFetch<SnakePaginatedResponse<AgentRun>>(
      orgPath(organizationId, '/agent-runs'),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },
};

export const aiMemoryApi = {
  listKnowledgeDocuments(
    accessToken: string,
    organizationId: string,
  ): Promise<{ data: KnowledgeDocument[]; next_cursor: string | null }> {
    return apiFetch(orgPath(organizationId, '/knowledge-documents'), withAuth(accessToken));
  },

  uploadKnowledgeDocument(
    accessToken: string,
    organizationId: string,
    body: {
      title: string;
      description?: string;
      raw_content?: string;
      auto_chunk?: boolean;
    },
  ): Promise<KnowledgeDocument> {
    return apiFetch(orgPath(organizationId, '/knowledge-documents'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },

  searchMemory(
    accessToken: string,
    organizationId: string,
    body: { query: string; limit?: number },
  ): Promise<{ results: Array<{ chunk: Record<string, unknown>; score: number }> }> {
    return apiFetch(orgPath(organizationId, '/memory-chunks/search'), {
      method: 'POST',
      body,
      ...withAuth(accessToken),
    });
  },
};

export const notificationsApi = {
  listInbox(
    accessToken: string,
    organizationId: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<PaginatedResponse<Notification>> {
    const params = new URLSearchParams();
    if (options?.limit !== undefined) {
      params.set('limit', String(options.limit));
    }
    if (options?.cursor !== undefined) {
      params.set('cursor', options.cursor);
    }
    const query = params.toString();
    return apiFetch<SnakePaginatedResponse<Notification>>(
      orgPath(organizationId, `/notifications${query ? `?${query}` : ''}`),
      withAuth(accessToken),
    ).then(normalizePaginated);
  },

  markRead(accessToken: string, organizationId: string, notificationId: string): Promise<undefined> {
    return apiFetch(orgPath(organizationId, `/notifications/${notificationId}/read`), {
      method: 'POST',
      ...withAuth(accessToken),
    });
  },
};