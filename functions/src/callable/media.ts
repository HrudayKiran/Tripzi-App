import * as admin from "firebase-admin";
import {CallableRequest, HttpsError, onCall} from "firebase-functions/v2/https";
import {
    buildPublicR2Url,
    createPresignedUploadUrl,
    createR2ObjectKey,
    deleteR2Object,
    deleteR2Objects,
    isOwnedObjectKey,
    r2AccessKeyId,
    r2SecretAccessKey,
} from "../utils/r2";

const isImageContentType = (value: unknown): value is string => {
    return typeof value === "string" && /^image\/[a-z0-9.+-]+$/i.test(value.trim());
};

const normalizeString = (value: unknown) => {
    return typeof value === "string" ? value.trim() : "";
};

const normalizeObjectKeys = (value: unknown) => {
    if (!Array.isArray(value)) return [];
    return value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean);
};

const assertAuthenticated = (request: CallableRequest<any>) => {
    const uid = request.auth?.uid;
    if (!uid) {
        throw new HttpsError("unauthenticated", "Authentication required.");
    }
    return uid;
};

const assertTripOwnership = async (uid: string, tripId: string) => {
    const tripDoc = await admin.firestore().collection("trips").doc(tripId).get();
    if (!tripDoc.exists) {
        throw new HttpsError("not-found", "Trip not found.");
    }

    if (tripDoc.data()?.userId !== uid) {
        throw new HttpsError("permission-denied", "You do not own this trip.");
    }
};

const mediaCallableOptions = {
    secrets: [r2AccessKeyId, r2SecretAccessKey],
    timeoutSeconds: 60 as const,
    memory: "256MiB" as const,
};

export const startProfileImageUpload = onCall(
    mediaCallableOptions,
    async (request) => {
        const uid = assertAuthenticated(request);
        const contentType = normalizeString(request.data?.contentType).toLowerCase();
        const fileName = normalizeString(request.data?.fileName);

        if (!isImageContentType(contentType)) {
            throw new HttpsError("invalid-argument", "A valid image content type is required.");
        }

        const objectKey = createR2ObjectKey("profiles", uid, contentType, fileName);
        const uploadUrl = await createPresignedUploadUrl(objectKey, contentType);

        return {
            uploadUrl,
            publicUrl: buildPublicR2Url(objectKey),
            objectKey,
        };
    }
);

export const startTripImageUpload = onCall(
    mediaCallableOptions,
    async (request) => {
        const uid = assertAuthenticated(request);
        const contentType = normalizeString(request.data?.contentType).toLowerCase();
        const fileName = normalizeString(request.data?.fileName);
        const tripId = normalizeString(request.data?.tripId);

        if (!isImageContentType(contentType)) {
            throw new HttpsError("invalid-argument", "A valid image content type is required.");
        }
        if (tripId) {
            await assertTripOwnership(uid, tripId);
        }

        const objectKey = createR2ObjectKey("trips", uid, contentType, fileName);
        const uploadUrl = await createPresignedUploadUrl(objectKey, contentType);

        return {
            uploadUrl,
            publicUrl: buildPublicR2Url(objectKey),
            objectKey,
        };
    }
);

export const deleteProfileImage = onCall(
    mediaCallableOptions,
    async (request) => {
        const uid = assertAuthenticated(request);
        const objectKey = normalizeString(request.data?.objectKey);

        if (!objectKey) {
            throw new HttpsError("invalid-argument", "objectKey is required.");
        }
        if (!isOwnedObjectKey(objectKey, "profiles", uid)) {
            throw new HttpsError("permission-denied", "You do not own this asset.");
        }

        await deleteR2Object(objectKey);

        return {
            success: true,
        };
    }
);

export const deleteTripImages = onCall(
    mediaCallableOptions,
    async (request) => {
        const uid = assertAuthenticated(request);
        const tripId = normalizeString(request.data?.tripId);
        const objectKeys = normalizeObjectKeys(request.data?.objectKeys);

        if (objectKeys.length === 0) {
            return {
                success: true,
                deletedCount: 0,
            };
        }
        if (tripId) {
            await assertTripOwnership(uid, tripId);
        }

        for (const objectKey of objectKeys) {
            if (!isOwnedObjectKey(objectKey, "trips", uid)) {
                throw new HttpsError("permission-denied", "You do not own one or more assets.");
            }
        }

        await deleteR2Objects(objectKeys);

        return {
            success: true,
            deletedCount: objectKeys.length,
        };
    }
);
