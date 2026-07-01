export { loadConfig, ConfigValidationError } from './config/env.js';
export type { AppConfig, NodeEnv } from './config/env.js';

export { createLogger, createCorrelationLogger } from './logging/logger.js';
export type { CreateLoggerOptions, LogLevel, Logger, LoggerBindings } from './logging/logger.js';

export { AtlasHttpError } from './errors/http-errors.js';
export type { AtlasHttpErrorOptions, FieldError, ProblemDetails } from './errors/http-errors.js';
export { mapDomainErrorToHttp, toProblemDetails } from './errors/error-handler.js';
export type { MapDomainErrorContext } from './errors/error-handler.js';

export {
  createInMemoryMetricsCollector,
  createNoopMetricsCollector,
  InMemoryMetricsCollector,
  NoopMetricsCollector,
} from './metrics/metrics.js';
export type {
  CounterSample,
  HistogramSample,
  InMemoryMetricsSnapshot,
  MetricLabels,
  MetricsCollector,
} from './metrics/metrics.js';

export {
  createPrometheusMetrics,
  registerMetricsRoute,
  registerPrometheusMiddleware,
} from './metrics/prometheus.js';
export type { PrometheusMetrics, PrometheusMetricsOptions } from './metrics/prometheus.js';

export {
  Argon2PasswordHasher,
  BcryptPasswordHasher,
  createPasswordHasher,
  ResilientPasswordHasher,
} from './security/password-hasher.js';
export type {
  PasswordHasher,
  PasswordHasherAlgorithm,
  PasswordHasherOptions,
} from './security/password-hasher.js';

export { createJwtService, JoseJwtService, JwtVerificationError } from './security/jwt-service.js';
export type {
  AtlasJwtClaims,
  JwtService,
  JwtServiceOptions,
  JwtTokenType,
  SignTokenInput,
  VerifiedJwt,
} from './security/jwt-service.js';

export { generateSecureToken, secureTokenEquals } from './security/token-generator.js';
export type { GenerateSecureTokenOptions, SecureTokenEncoding } from './security/token-generator.js';

export { decodeBase32, generateTotp, verifyTotp } from './crypto/totp.js';
export type { TotpOptions } from './crypto/totp.js';

export {
  getTenantContext,
  requireTenantContext,
  runWithTenant,
  TenantContextError,
} from './tenant/tenant-context.js';
export type { TenantContext } from './tenant/tenant-context.js';

export {
  paginationQuery,
  parsePaginationQuery,
  parseUuidParam,
  uuidParam,
  uuidSchema,
} from './validation/zod-helpers.js';
export type { PaginationQuery, UuidParam } from './validation/zod-helpers.js';