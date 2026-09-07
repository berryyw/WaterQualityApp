import { randomUUID } from 'node:crypto';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  PutObjectCommand,
  DeleteObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

type StorageProvider = 'local' | 'oss';

@Injectable()
export class StorageService {
  private s3Client?: S3Client;

  constructor(private readonly configService: ConfigService) {}

  getProvider(): StorageProvider {
    const provider =
      this.configService
        .get<string>('STORAGE_PROVIDER')
        ?.trim()
        .toLowerCase() || 'local';

    return provider === 'oss' ? 'oss' : 'local';
  }

  async uploadBuffer(params: {
    objectKey: string;
    mimeType: string;
    body: Buffer;
  }) {
    if (this.getProvider() === 'oss') {
      return this.uploadToOss(params);
    }

    return this.uploadToLocal(params);
  }

  async deleteByPublicUrl(publicUrl?: string | null) {
    if (!publicUrl) {
      return;
    }

    const objectKey = this.extractObjectKeyFromPublicUrl(publicUrl);
    if (!objectKey) {
      return;
    }

    if (this.getProvider() === 'oss') {
      const client = this.getS3Client();
      await client.send(
        new DeleteObjectCommand({
          Bucket: this.requireConfig('OSS_BUCKET'),
          Key: objectKey,
        }),
      );
      return;
    }

    await rm(join(process.cwd(), 'uploads', objectKey), { force: true });
  }

  async createUploadTicket(params: { objectKey: string; mimeType: string }) {
    if (this.getProvider() !== 'oss') {
      return {
        provider: 'local',
        objectKey: params.objectKey,
        mimeType: params.mimeType,
        uploadMethod: 'server',
        uploadUrl: null,
        publicUrl: this.buildLocalPublicUrl(params.objectKey),
        expiresInSeconds: null,
        note: '当前环境使用本地存储，不返回直传签名链接。',
      };
    }

    const client = this.getS3Client();
    const command = new PutObjectCommand({
      Bucket: this.requireConfig('OSS_BUCKET'),
      Key: params.objectKey,
      ContentType: params.mimeType,
    });
    const expiresInSeconds = 900;
    const uploadUrl = await getSignedUrl(client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      provider: 'oss',
      bucket: this.requireConfig('OSS_BUCKET'),
      region: this.requireConfig('OSS_REGION'),
      objectKey: params.objectKey,
      mimeType: params.mimeType,
      uploadMethod: 'PUT',
      uploadUrl,
      publicUrl: this.buildOssPublicUrl(params.objectKey),
      expiresInSeconds,
      note: '已生成真实 OSS/S3 兼容直传签名链接。',
    };
  }

  buildObjectKey(
    scope: 'user-avatar' | 'venue-cover',
    ownerId: string,
    extension: string,
  ) {
    const normalizedExtension = extension.startsWith('.')
      ? extension
      : `.${extension}`;
    const fileName = `${randomUUID()}${normalizedExtension}`;

    if (scope === 'user-avatar') {
      return `users/${ownerId}/avatar/${fileName}`;
    }

    return `venues/${ownerId}/cover/${fileName}`;
  }

  private async uploadToLocal(params: {
    objectKey: string;
    mimeType: string;
    body: Buffer;
  }) {
    const filePath = join(process.cwd(), 'uploads', params.objectKey);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, params.body);

    return {
      provider: 'local',
      objectKey: params.objectKey,
      mimeType: params.mimeType,
      publicUrl: this.buildLocalPublicUrl(params.objectKey),
    };
  }

  private async uploadToOss(params: {
    objectKey: string;
    mimeType: string;
    body: Buffer;
  }) {
    const client = this.getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: this.requireConfig('OSS_BUCKET'),
        Key: params.objectKey,
        Body: params.body,
        ContentType: params.mimeType,
      }),
    );

    return {
      provider: 'oss',
      objectKey: params.objectKey,
      mimeType: params.mimeType,
      publicUrl: this.buildOssPublicUrl(params.objectKey),
    };
  }

  private buildLocalPublicUrl(objectKey: string) {
    const baseUrl =
      this.configService.get<string>('SERVICE_PUBLIC_BASE_URL')?.trim() ||
      'http://localhost:3000';

    return `${baseUrl.replace(/\/$/, '')}/uploads/${objectKey}`;
  }

  private buildOssPublicUrl(objectKey: string) {
    const publicBaseUrl =
      this.configService.get<string>('OSS_PUBLIC_BASE_URL')?.trim() ||
      this.configService.get<string>('OSS_CDN_BASE_URL')?.trim();

    if (!publicBaseUrl) {
      throw new Error(
        '启用 OSS 时必须提供 OSS_PUBLIC_BASE_URL 或 OSS_CDN_BASE_URL',
      );
    }

    return `${publicBaseUrl.replace(/\/$/, '')}/${objectKey}`;
  }

  private extractObjectKeyFromPublicUrl(publicUrl: string) {
    if (publicUrl.startsWith('/uploads/')) {
      return publicUrl.replace(/^\/uploads\//, '');
    }

    const localPrefix = `${(
      this.configService.get<string>('SERVICE_PUBLIC_BASE_URL')?.trim() ||
      'http://localhost:3000'
    ).replace(/\/$/, '')}/uploads/`;
    if (publicUrl.startsWith(localPrefix)) {
      return publicUrl.slice(localPrefix.length);
    }

    const ossBases = [
      this.configService.get<string>('OSS_PUBLIC_BASE_URL')?.trim(),
      this.configService.get<string>('OSS_CDN_BASE_URL')?.trim(),
    ].filter(Boolean) as string[];

    for (const base of ossBases) {
      const normalizedBase = `${base.replace(/\/$/, '')}/`;
      if (publicUrl.startsWith(normalizedBase)) {
        return publicUrl.slice(normalizedBase.length);
      }
    }

    return null;
  }

  private getS3Client() {
    if (!this.s3Client) {
      this.s3Client = new S3Client({
        region: this.requireConfig('OSS_REGION'),
        endpoint: this.requireConfig('OSS_ENDPOINT'),
        credentials: {
          accessKeyId: this.requireConfig('OSS_ACCESS_KEY_ID'),
          secretAccessKey: this.requireConfig('OSS_ACCESS_KEY_SECRET'),
        },
        forcePathStyle:
          String(
            this.configService.get<string>('OSS_FORCE_PATH_STYLE') || 'false',
          ).toLowerCase() === 'true',
      });
    }

    return this.s3Client;
  }

  private requireConfig(key: string) {
    const value = this.configService.get<string>(key)?.trim();
    if (!value) {
      throw new Error(`缺少存储配置：${key}`);
    }
    return value;
  }
}
