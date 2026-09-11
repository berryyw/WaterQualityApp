import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { PrismaService } from './prisma/prisma.service';
import { Request, Response, NextFunction } from 'express';
import {
  createGzip,
  createBrotliCompress,
  constants as zlibConstants,
} from 'node:zlib';
import { Stream } from 'node:stream';

function resolveCorsOrigins() {
  const configuredOrigins = (process.env.CORS_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return [/^http:\/\/localhost:\d+$/, /^http:\/\/127\.0\.0\.1:\d+$/];
}

/**
 * Built-in gzip/brotli response compression (zero npm dependencies).
 * Compresses any non-binary JSON/text response where body size > ~1KB and client
 * sent Accept-Encoding. Shrinks 280KB LA venues JSON → ~25KB (10x smaller),
 * fixes 18s cross-Pacific transfer delay on mobile/cellular.
 */
function compressionMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const accept = req.headers['accept-encoding'] ?? '';
  const useBrotli = accept.includes('br');
  const useGzip = !useBrotli && accept.includes('gzip');
  if (!useBrotli && !useGzip) {
    next();
    return;
  }
  const originalEnd = res.end.bind(res);
  const originalWrite = res.write.bind(res);
  const chunks: Buffer[] = [];
  let capturedContentType: string | undefined;

  // Intercept writeHead to capture Content-Type before we decide to transform
  const originalWriteHead = res.writeHead.bind(res) as typeof res.writeHead;

  (res as any).writeHead = function (
    statusCode: any,
    headersOrReason?: any,
    maybeHeaders?: any,
  ) {
    let candidateHeaders: Record<string, any> | undefined;
    if (
      headersOrReason &&
      typeof headersOrReason === 'object' &&
      !Array.isArray(headersOrReason)
    ) {
      candidateHeaders = headersOrReason;
    } else if (
      maybeHeaders &&
      typeof maybeHeaders === 'object' &&
      !Array.isArray(maybeHeaders)
    ) {
      candidateHeaders = maybeHeaders;
    }
    if (candidateHeaders) {
      for (const key of Object.keys(candidateHeaders)) {
        if (key.toLowerCase() === 'content-type') {
          capturedContentType = String(candidateHeaders[key]);
        }
      }
    }
    return originalWriteHead(statusCode, headersOrReason, maybeHeaders);
  } as typeof res.writeHead;

  (res as any).write = function (chunk: any, encodingOrCb?: any, cb?: any) {
    if (chunk == null) return true;
    const buf = Buffer.isBuffer(chunk)
      ? chunk
      : Buffer.from(
          chunk,
          typeof encodingOrCb === 'string'
            ? (encodingOrCb as BufferEncoding)
            : 'utf8',
        );
    if (buf.length > 0) chunks.push(buf);
    return true;
  } as typeof res.write;

  (res as any).end = function (chunk?: any, encodingOrCb?: any, cb?: any) {
    try {
      if (chunk != null) {
        const buf = Buffer.isBuffer(chunk)
          ? chunk
          : Buffer.from(
              chunk,
              typeof encodingOrCb === 'string'
                ? (encodingOrCb as BufferEncoding)
                : 'utf8',
            );
        if (buf.length > 0) chunks.push(buf);
      }
      const body = Buffer.concat(chunks);
      const contentType =
        capturedContentType ??
        (res.getHeader('Content-Type') as string | undefined) ??
        '';
      const isCompressible =
        /(?:^|;)\s*(?:application\/json|text\/|application\/javascript|application\/xml|image\/svg\+xml)(?:$|;)/i.test(
          contentType,
        );
      // Always respect explicit no-transform
      const cacheControl =
        (res.getHeader('Cache-Control') as string | undefined) ?? '';
      const noTransform = /\bno-transform\b/i.test(cacheControl);
      if (
        !isCompressible ||
        body.length < 1024 ||
        noTransform ||
        res.headersSent
      ) {
        if (body.length > 0 && !res.headersSent)
          res.setHeader('Content-Length', body.length);
        return originalEnd(body);
      }
      const compressor = useBrotli
        ? createBrotliCompress({
            params: {
              [zlibConstants.BROTLI_PARAM_QUALITY]: 5,
              [zlibConstants.BROTLI_PARAM_MODE]: zlibConstants.BROTLI_MODE_TEXT,
            },
          })
        : createGzip({ level: 6 });
      res.setHeader('Content-Encoding', useBrotli ? 'br' : 'gzip');
      res.removeHeader('Content-Length');
      if (useBrotli || useGzip) res.setHeader('Vary', 'Accept-Encoding');
      Stream.pipeline(Stream.Readable.from(body), compressor, (err) => {
        if (err) {
          try {
            if (!res.headersSent) res.setHeader('Content-Length', body.length);
            originalEnd(body);
          } catch {
            /* swallow */
          }
          return;
        }
      });
      try {
        compressor.on('data', (outChunk) => originalWrite(outChunk));
        compressor.on('end', () => originalEnd());
      } catch {
        if (!res.headersSent) res.setHeader('Content-Length', body.length);
        return originalEnd(body);
      }
      return res;
    } catch {
      if (chunk != null) return originalEnd(chunk, encodingOrCb, cb);
      return originalEnd();
    }
  } as typeof res.end;

  next();
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const uploadsRoot = join(process.cwd(), 'uploads');
  mkdirSync(join(uploadsRoot, 'avatars'), { recursive: true });

  // Gzip/brotli compression first so all responses are shrunk
  app.use(compressionMiddleware);

  app.enableCors({
    origin: resolveCorsOrigins(),
    credentials: true,
  });
  app.useStaticAssets(uploadsRoot, {
    prefix: '/uploads/',
  });
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidUnknownValues: false,
    }),
  );

  const prismaService = app.get(PrismaService);
  prismaService.enableShutdownHooks(app);

  await app.listen(process.env.PORT ?? 3000, process.env.HOST ?? '0.0.0.0');
}
void bootstrap();
