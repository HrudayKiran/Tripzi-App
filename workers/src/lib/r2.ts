import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Env } from './supabase';

const encodeObjectKeyForUrl = (objectKey: string) => {
  return objectKey
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
};

const getR2Client = (env: Env) => {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY,
    },
  });
};

export const buildPublicR2Url = (env: Env, objectKey: string) => {
  const publicBaseUrl = env.R2_PUBLIC_BASE_URL.replace(/\/+$/, '');
  return `${publicBaseUrl}/${encodeObjectKeyForUrl(objectKey)}`;
};

const extensionFromContentType = (contentType: string) => {
  switch (contentType) {
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/heic':
      return 'heic';
    case 'image/heif':
      return 'heif';
    default:
      return 'jpg';
  }
};

export const createR2ObjectKey = (
  scope: 'profiles' | 'trips',
  uid: string,
  contentType: string,
  fileName?: string
) => {
  const sanitize = (v: string) => v.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const explicitExt = fileName?.includes('.')
    ? sanitize(fileName.split('.').pop() || '')
    : '';
  const extension = explicitExt || extensionFromContentType(contentType);
  return `${scope}/${uid}/${Date.now()}-${crypto.randomUUID()}.${extension}`;
};

export const createPresignedUploadUrl = async (
  env: Env,
  objectKey: string,
  contentType: string
) => {
  const client = getR2Client(env);
  const command = new PutObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: objectKey,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  });
  return getSignedUrl(client, command, { expiresIn: 15 * 60 });
};

export const deleteR2Object = async (env: Env, objectKey: string) => {
  if (!objectKey) return;
  const client = getR2Client(env);
  await client.send(new DeleteObjectCommand({
    Bucket: env.R2_BUCKET_NAME,
    Key: objectKey,
  }));
};

export const deleteR2Objects = async (env: Env, objectKeys: string[]) => {
  const uniqueKeys = [...new Set(objectKeys.map((k) => k.trim()).filter(Boolean))];
  if (uniqueKeys.length === 0) return;

  const client = getR2Client(env);
  for (let i = 0; i < uniqueKeys.length; i += 1000) {
    const chunk = uniqueKeys.slice(i, i + 1000);
    await client.send(new DeleteObjectsCommand({
      Bucket: env.R2_BUCKET_NAME,
      Delete: {
        Objects: chunk.map((key) => ({ Key: key })),
        Quiet: true,
      },
    }));
  }
};

export const deleteR2Prefix = async (env: Env, prefix: string) => {
  if (!prefix) return;
  const client = getR2Client(env);
  let continuationToken: string | undefined;

  do {
    const response = await client.send(new ListObjectsV2Command({
      Bucket: env.R2_BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken,
    }));

    const keys = (response.Contents || [])
      .map((item) => item.Key || '')
      .filter(Boolean);

    if (keys.length > 0) {
      await deleteR2Objects(env, keys);
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);
};

export const isOwnedObjectKey = (
  objectKey: string,
  scope: 'profiles' | 'trips',
  uid: string
) => objectKey.startsWith(`${scope}/${uid}/`);
