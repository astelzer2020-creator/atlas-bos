import { createHmac, randomBytes } from 'node:crypto';
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

export interface StorageAdapterConfig {
  readonly provider: 's3' | 'local';
  readonly bucket: string;
  readonly region: string;
  readonly endpoint?: string;
  readonly accessKeyId?: string;
  readonly secretAccessKey?: string;
  readonly localRootPath?: string;
  readonly localBaseUrl?: string;
  readonly signingSecret?: string;
}

export interface PresignedUploadRequest {
  readonly bucket: string;
  readonly objectKey: string;
  readonly mimeType: string;
  readonly sizeBytes: bigint;
  readonly expiresInSeconds: number;
}

export interface PresignedUploadResult {
  readonly uploadUrl: string;
  readonly uploadMethod: 'PUT' | 'POST';
  readonly uploadHeaders?: Readonly<Record<string, string>>;
  readonly expiresAt: Date;
}

export interface PresignedDownloadRequest {
  readonly bucket: string;
  readonly objectKey: string;
  readonly expiresInSeconds: number;
  readonly fileName?: string;
}

export interface PresignedDownloadResult {
  readonly downloadUrl: string;
  readonly expiresAt: Date;
}

export interface S3StorageAdapter {
  readonly bucket: string;
  createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUploadResult>;
  createPresignedDownload(request: PresignedDownloadRequest): Promise<PresignedDownloadResult>;
  objectExists(bucket: string, objectKey: string): Promise<boolean>;
  deleteObject(bucket: string, objectKey: string): Promise<void>;
}

export function resolveStorageConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): StorageAdapterConfig {
  const provider = env['ATLAS_STORAGE_PROVIDER'] === 's3' ? 's3' : 'local';

  return {
    provider,
    bucket: env['ATLAS_S3_BUCKET'] ?? 'atlas-uploads-dev',
    region: env['ATLAS_S3_REGION'] ?? 'us-east-1',
    ...(env['ATLAS_S3_ENDPOINT'] !== undefined ? { endpoint: env['ATLAS_S3_ENDPOINT'] } : {}),
    ...(env['ATLAS_S3_ACCESS_KEY_ID'] !== undefined
      ? { accessKeyId: env['ATLAS_S3_ACCESS_KEY_ID'] }
      : {}),
    ...(env['ATLAS_S3_SECRET_ACCESS_KEY'] !== undefined
      ? { secretAccessKey: env['ATLAS_S3_SECRET_ACCESS_KEY'] }
      : {}),
    localRootPath: env['ATLAS_STORAGE_LOCAL_ROOT'] ?? resolve(process.cwd(), '.atlas-storage'),
    localBaseUrl: env['ATLAS_STORAGE_LOCAL_BASE_URL'] ?? 'http://127.0.0.1:9000/__atlas_storage__',
    signingSecret: env['ATLAS_STORAGE_SIGNING_SECRET'] ?? 'atlas-local-storage-dev-secret',
  };
}

export async function createStorageAdapter(
  config: StorageAdapterConfig,
): Promise<S3StorageAdapter> {
  if (config.provider === 's3') {
    const s3Adapter = await tryCreateS3Adapter(config);
    if (s3Adapter !== null) {
      return s3Adapter;
    }
  }

  return new LocalFilesystemAdapter(config);
}

async function tryCreateS3Adapter(config: StorageAdapterConfig): Promise<S3Adapter | null> {
  try {
    const [{ S3Client, HeadObjectCommand, DeleteObjectCommand, PutObjectCommand, GetObjectCommand }, { getSignedUrl }] =
      await Promise.all([
        import('@aws-sdk/client-s3'),
        import('@aws-sdk/s3-request-presigner'),
      ]);

    return new S3Adapter(config, {
      S3Client: S3Client as S3SdkDeps['S3Client'],
      HeadObjectCommand: HeadObjectCommand as S3SdkDeps['HeadObjectCommand'],
      DeleteObjectCommand: DeleteObjectCommand as S3SdkDeps['DeleteObjectCommand'],
      PutObjectCommand: PutObjectCommand as S3SdkDeps['PutObjectCommand'],
      GetObjectCommand: GetObjectCommand as S3SdkDeps['GetObjectCommand'],
      getSignedUrl: getSignedUrl as S3SdkDeps['getSignedUrl'],
    });
  } catch {
    return null;
  }
}

interface S3CommandClient {
  send(command: unknown): Promise<unknown>;
}

type S3CommandCtor = new (input: object) => unknown;

interface S3SdkDeps {
  readonly S3Client: new (config: object) => S3CommandClient;
  readonly HeadObjectCommand: S3CommandCtor;
  readonly DeleteObjectCommand: S3CommandCtor;
  readonly PutObjectCommand: S3CommandCtor;
  readonly GetObjectCommand: S3CommandCtor;
  readonly getSignedUrl: (
    client: unknown,
    command: unknown,
    options: { expiresIn: number },
  ) => Promise<string>;
}

class S3Adapter implements S3StorageAdapter {
  readonly bucket: string;
  private readonly client: S3CommandClient;

  constructor(
    config: StorageAdapterConfig,
    private readonly sdk: S3SdkDeps,
  ) {
    this.bucket = config.bucket;
    this.client = new sdk.S3Client({
      region: config.region,
      ...(config.endpoint !== undefined ? { endpoint: config.endpoint, forcePathStyle: true } : {}),
      ...(config.accessKeyId !== undefined && config.secretAccessKey !== undefined
        ? {
            credentials: {
              accessKeyId: config.accessKeyId,
              secretAccessKey: config.secretAccessKey,
            },
          }
        : {}),
    });
  }

  async createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUploadResult> {
    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1000);
    const command = new this.sdk.PutObjectCommand({
      Bucket: request.bucket,
      Key: request.objectKey,
      ContentType: request.mimeType,
      ContentLength: Number(request.sizeBytes),
    });

    const uploadUrl = await this.sdk.getSignedUrl(this.client, command, {
      expiresIn: request.expiresInSeconds,
    });

    return {
      uploadUrl,
      uploadMethod: 'PUT',
      uploadHeaders: {
        'Content-Type': request.mimeType,
      },
      expiresAt,
    };
  }

  async createPresignedDownload(
    request: PresignedDownloadRequest,
  ): Promise<PresignedDownloadResult> {
    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1000);
    const command = new this.sdk.GetObjectCommand({
      Bucket: request.bucket,
      Key: request.objectKey,
      ...(request.fileName !== undefined
        ? { ResponseContentDisposition: `attachment; filename="${request.fileName}"` }
        : {}),
    });

    const downloadUrl = await this.sdk.getSignedUrl(this.client, command, {
      expiresIn: request.expiresInSeconds,
    });

    return {
      downloadUrl,
      expiresAt,
    };
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await this.client.send(
        new this.sdk.HeadObjectCommand({
          Bucket: bucket,
          Key: objectKey,
        }),
      );
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    await this.client.send(
      new this.sdk.DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
      }),
    );
  }
}

export class LocalFilesystemAdapter implements S3StorageAdapter {
  readonly bucket: string;
  private readonly rootPath: string;
  private readonly baseUrl: string;
  private readonly signingSecret: string;

  constructor(config: StorageAdapterConfig) {
    this.bucket = config.bucket;
    this.rootPath = config.localRootPath ?? resolve(process.cwd(), '.atlas-storage');
    this.baseUrl = config.localBaseUrl ?? 'http://127.0.0.1:9000/__atlas_storage__';
    this.signingSecret = config.signingSecret ?? 'atlas-local-storage-dev-secret';
  }

  async createPresignedUpload(request: PresignedUploadRequest): Promise<PresignedUploadResult> {
    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1000);
    const token = this.sign(request.bucket, request.objectKey, expiresAt, 'upload');

    const uploadUrl = `${this.baseUrl}/upload?bucket=${encodeURIComponent(request.bucket)}&key=${encodeURIComponent(request.objectKey)}&token=${encodeURIComponent(token)}&expires=${expiresAt.getTime()}`;

    return {
      uploadUrl,
      uploadMethod: 'PUT',
      uploadHeaders: {
        'Content-Type': request.mimeType,
      },
      expiresAt,
    };
  }

  async createPresignedDownload(
    request: PresignedDownloadRequest,
  ): Promise<PresignedDownloadResult> {
    const expiresAt = new Date(Date.now() + request.expiresInSeconds * 1000);
    const token = this.sign(request.bucket, request.objectKey, expiresAt, 'download');

    const downloadUrl = `${this.baseUrl}/download?bucket=${encodeURIComponent(request.bucket)}&key=${encodeURIComponent(request.objectKey)}&token=${encodeURIComponent(token)}&expires=${expiresAt.getTime()}`;

    return {
      downloadUrl,
      expiresAt,
    };
  }

  async objectExists(bucket: string, objectKey: string): Promise<boolean> {
    try {
      await stat(this.resolvePath(bucket, objectKey));
      return true;
    } catch {
      return false;
    }
  }

  async deleteObject(bucket: string, objectKey: string): Promise<void> {
    try {
      await unlink(this.resolvePath(bucket, objectKey));
    } catch {
      // Object may already be absent; deletion is idempotent.
    }
  }

  /** Writes bytes directly to local storage (used in development and tests). */
  async writeObject(bucket: string, objectKey: string, body: Buffer): Promise<void> {
    const target = this.resolvePath(bucket, objectKey);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  /** Reads bytes from local storage (used in development and tests). */
  async readObject(bucket: string, objectKey: string): Promise<Buffer> {
    return readFile(this.resolvePath(bucket, objectKey));
  }

  /** Validates a signed local upload/download token. */
  verifyToken(
    bucket: string,
    objectKey: string,
    token: string,
    expiresMs: number,
    operation: 'upload' | 'download',
  ): boolean {
    if (Date.now() > expiresMs) {
      return false;
    }

    const expected = this.sign(bucket, objectKey, new Date(expiresMs), operation);
    return timingSafeEqual(token, expected);
  }

  private resolvePath(bucket: string, objectKey: string): string {
    return join(this.rootPath, bucket, objectKey);
  }

  private sign(
    bucket: string,
    objectKey: string,
    expiresAt: Date,
    operation: 'upload' | 'download',
  ): string {
    const payload = `${operation}:${bucket}:${objectKey}:${expiresAt.getTime()}`;
    return createHmac('sha256', this.signingSecret).update(payload).digest('hex');
  }
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

/** Generates a random signing secret suitable for local development. */
export function generateLocalSigningSecret(): string {
  return randomBytes(32).toString('hex');
}