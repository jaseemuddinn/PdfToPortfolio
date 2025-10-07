import { randomUUID } from "crypto";
import { S3Client, DeleteObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";

const region = process.env.AWS_REGION;
const bucket = process.env.AWS_S3_BUCKET;
const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

let s3Client;

export function isStorageConfigured() {
    return Boolean(bucket && region && accessKeyId && secretAccessKey);
}

function ensureConfig() {
    if (!isStorageConfigured()) {
        throw new Error(
            "AWS storage is not configured. Set AWS_S3_BUCKET, AWS_REGION, AWS_ACCESS_KEY_ID, and AWS_SECRET_ACCESS_KEY."
        );
    }
}

export function getS3Client() {
    if (!s3Client) {
        ensureConfig();
        s3Client = new S3Client({
            region,
            credentials: {
                accessKeyId,
                secretAccessKey,
            },
        });
    }
    return s3Client;
}

export async function uploadResumeToS3(buffer, { filename, contentType }) {
    ensureConfig();

    const client = getS3Client();
    const key = `resumes/${randomUUID()}-${filename}`;

    await client.send(
        new PutObjectCommand({
            Bucket: bucket,
            Key: key,
            Body: buffer,
            ContentType: contentType,
        })
    );

    return {
        key,
        url: `https://${bucket}.s3.${region}.amazonaws.com/${key}`,
    };
}

export async function deleteResumeFromS3(key) {
    ensureConfig();

    const client = getS3Client();
    await client.send(
        new DeleteObjectCommand({
            Bucket: bucket,
            Key: key,
        })
    );
}
