import {
    DeleteObjectCommand,
    DeleteObjectsCommand,
    ListObjectsV2Command,
    PutObjectCommand,
    S3Client,
} from "@aws-sdk/client-s3";
import {getSignedUrl} from "@aws-sdk/s3-request-presigner";
import {randomUUID} from "crypto";
import {defineSecret, defineString} from "firebase-functions/params";

export const r2AccessKeyId = defineSecret("R2_ACCESS_KEY_ID");
export const r2SecretAccessKey = defineSecret("R2_SECRET_ACCESS_KEY");

const r2AccountId = defineString("R2_ACCOUNT_ID");
const r2BucketName = defineString("R2_BUCKET_NAME");
const r2PublicBaseUrl = defineString("R2_PUBLIC_BASE_URL");

const normalizeBaseUrl = (value: string) => value.replace(/\/+$/, "");

const encodeObjectKeyForUrl = (objectKey: string) => {
    return objectKey
        .split("/")
        .map((segment) => encodeURIComponent(segment))
        .join("/");
};

const getRequiredString = (paramValue: string, label: string) => {
    const trimmed = paramValue.trim();
    if (!trimmed) {
        throw new Error(`Missing required R2 configuration: ${label}`);
    }
    return trimmed;
};

const getR2Client = () => {
    const accountId = getRequiredString(r2AccountId.value(), "R2_ACCOUNT_ID");
    const accessKeyId = getRequiredString(r2AccessKeyId.value(), "R2_ACCESS_KEY_ID");
    const secretAccessKey = getRequiredString(r2SecretAccessKey.value(), "R2_SECRET_ACCESS_KEY");

    return new S3Client({
        region: "auto",
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId,
            secretAccessKey,
        },
    });
};

const getBucketName = () => getRequiredString(r2BucketName.value(), "R2_BUCKET_NAME");

export const buildPublicR2Url = (objectKey: string) => {
    const publicBaseUrl = normalizeBaseUrl(
        getRequiredString(r2PublicBaseUrl.value(), "R2_PUBLIC_BASE_URL")
    );
    return `${publicBaseUrl}/${encodeObjectKeyForUrl(objectKey)}`;
};

const sanitizeExtension = (value: string) => {
    return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
};

const extensionFromContentType = (contentType: string) => {
    switch (contentType) {
    case "image/jpeg":
    case "image/jpg":
        return "jpg";
    case "image/png":
        return "png";
    case "image/webp":
        return "webp";
    case "image/heic":
        return "heic";
    case "image/heif":
        return "heif";
    default:
        return "jpg";
    }
};

export const createR2ObjectKey = (
    scope: "profiles" | "trips",
    uid: string,
    contentType: string,
    fileName?: string
) => {
    const explicitExtension = fileName?.includes(".") ?
        sanitizeExtension(fileName.split(".").pop() || "") :
        "";
    const extension = explicitExtension || extensionFromContentType(contentType);
    return `${scope}/${uid}/${Date.now()}-${randomUUID()}.${extension}`;
};

export const createPresignedUploadUrl = async (
    objectKey: string,
    contentType: string
) => {
    const client = getR2Client();
    const bucket = getBucketName();

    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: objectKey,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
    });

    return getSignedUrl(client, command, {expiresIn: 15 * 60});
};

export const deleteR2Object = async (objectKey: string) => {
    if (!objectKey) return;

    const client = getR2Client();
    const bucket = getBucketName();
    await client.send(new DeleteObjectCommand({
        Bucket: bucket,
        Key: objectKey,
    }));
};

export const deleteR2Objects = async (objectKeys: string[]) => {
    const uniqueKeys = Array.from(
        new Set(objectKeys.map((key) => key.trim()).filter(Boolean))
    );
    if (uniqueKeys.length === 0) return;

    const client = getR2Client();
    const bucket = getBucketName();

    for (let index = 0; index < uniqueKeys.length; index += 1000) {
        const chunk = uniqueKeys.slice(index, index + 1000);
        await client.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: {
                Objects: chunk.map((key) => ({Key: key})),
                Quiet: true,
            },
        }));
    }
};

export const deleteR2Prefix = async (prefix: string) => {
    if (!prefix) return;

    const client = getR2Client();
    const bucket = getBucketName();
    let continuationToken: string | undefined;

    do {
        const response = await client.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: continuationToken,
        }));

        const keys = (response.Contents || [])
            .map((item) => item.Key || "")
            .filter(Boolean);

        if (keys.length > 0) {
            await deleteR2Objects(keys);
        }

        continuationToken = response.IsTruncated ?
            response.NextContinuationToken :
            undefined;
    } while (continuationToken);
};

export const isOwnedObjectKey = (
    objectKey: string,
    scope: "profiles" | "trips",
    uid: string
) => objectKey.startsWith(`${scope}/${uid}/`);
