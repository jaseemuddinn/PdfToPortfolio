import { randomUUID } from "crypto";
import { NextResponse } from "next/server";

import { getDb } from "@/lib/mongodb";
import { ResumeValidationError, parseResume } from "@/lib/resume-parser";
import {
    isStorageConfigured,
    uploadResumeToS3,
} from "@/lib/storage";

export const runtime = "nodejs";

function createSlug(name) {
    const base = name
        ? name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/(^-|-$)/g, "")
        : "portfolio";

    const suffix = randomUUID().split("-")[0];
    return `${base || "portfolio"}-${suffix}`;
}

function getCollection(db) {
    const collectionName = process.env.MONGODB_COLLECTION || "portfolios";
    return db.collection(collectionName);
}

export async function POST(request) {
    try {
        const formData = await request.formData();
        const resumeFile = formData.get("resume");

        if (!resumeFile || typeof resumeFile === "string") {
            return NextResponse.json(
                { error: "Upload a resume file under the `resume` field." },
                { status: 400 }
            );
        }

        const arrayBuffer = await resumeFile.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = resumeFile.type || "application/octet-stream";

        const portfolio = await parseResume(buffer, mimeType);

        const db = await getDb();
        const collection = getCollection(db);

        const now = new Date();
        const slug = createSlug(portfolio.name);

        const originHeader = request.headers.get("origin");
        const baseUrl =
            process.env.NEXT_PUBLIC_BASE_URL ||
            originHeader ||
            (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");
        const normalizedBaseUrl = baseUrl.replace(/\/$/, "");
        const shareUrl = `${normalizedBaseUrl}/portfolio/${slug}`;

        let storage = null;
        if (isStorageConfigured()) {
            try {
                storage = await uploadResumeToS3(buffer, {
                    filename: resumeFile.name || "resume",
                    contentType: mimeType,
                });
            } catch (storageError) {
                console.error("Failed to upload resume to S3", storageError);
            }
        }

        const result = await collection.insertOne({
            slug,
            portfolio,
            resumeMetadata: {
                filename: resumeFile.name || null,
                mimeType,
                storageKey: storage?.key || null,
                storageUrl: storage?.url || null,
            },
            createdAt: now,
            updatedAt: now,
            isPublic: false,
            shareUrl,
        });

        return NextResponse.json(
            {
                id: result.insertedId,
                slug,
                portfolio,
                url: shareUrl,
            },
            { status: 201 }
        );
    } catch (error) {
        if (error instanceof ResumeValidationError) {
            return NextResponse.json(
                { error: error.message },
                { status: 422 }
            );
        }

        console.error("Failed to process resume", error);

        const status = error.message.includes("Unsupported file type") ? 415 : 500;
        return NextResponse.json(
            { error: error.message || "Unable to process resume." },
            { status }
        );
    }
}
