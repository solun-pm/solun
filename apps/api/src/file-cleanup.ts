import { PrismaClient } from "@prisma/client";
import { AbortMultipartUploadCommand, DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";

export type FileCleanupDeps = {
  prisma: PrismaClient;
  r2Client: S3Client;
  bucket: string;
};

export async function runFileCleanup({ prisma, r2Client, bucket }: FileCleanupDeps): Promise<{
  aborted: number;
  expired: number;
  overDownloaded: number;
}> {
  const now = new Date();
  const cutoff = new Date(Date.now() - 60 * 60 * 1000);
  let aborted = 0;
  let expired = 0;
  let overDownloaded = 0;

  const pending = await prisma.sharedFile.findMany({
    where: {
      status: "pending",
      createdAt: { lt: cutoff }
    }
  });

  for (const record of pending) {
    if (record.uploadId) {
      await r2Client
        .send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: record.r2Key,
            UploadId: record.uploadId
          })
        )
        .catch(() => undefined);
    }
    await prisma.sharedFile.delete({ where: { shortId: record.shortId } }).catch(() => undefined);
    aborted += 1;
  }

  const expiredRecords = await prisma.sharedFile.findMany({
    where: {
      expiresAt: { lt: now }
    }
  });

  for (const record of expiredRecords) {
    if (record.status === "pending" && record.uploadId) {
      await r2Client
        .send(
          new AbortMultipartUploadCommand({
            Bucket: bucket,
            Key: record.r2Key,
            UploadId: record.uploadId
          })
        )
        .catch(() => undefined);
    }
    await r2Client
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: record.r2Key }))
      .catch(() => undefined);
    await r2Client
      .send(new DeleteObjectCommand({ Bucket: bucket, Key: record.metadataKey }))
      .catch(() => undefined);
    await prisma.sharedFile.delete({ where: { shortId: record.shortId } }).catch(() => undefined);
    expired += 1;
  }

  const activeWithMax = await prisma.sharedFile.findMany({
    where: {
      status: "active",
      maxDownloads: { not: null },
      downloadCount: { gt: 0 }
    }
  });

  for (const record of activeWithMax) {
    if (record.maxDownloads && record.downloadCount >= record.maxDownloads) {
      await r2Client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: record.r2Key }))
        .catch(() => undefined);
      await r2Client
        .send(new DeleteObjectCommand({ Bucket: bucket, Key: record.metadataKey }))
        .catch(() => undefined);
      await prisma.sharedFile.delete({ where: { shortId: record.shortId } }).catch(() => undefined);
      overDownloaded += 1;
    }
  }

  return { aborted, expired, overDownloaded };
}
