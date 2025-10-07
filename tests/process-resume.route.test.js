import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("@/lib/mongodb", () => ({
    getDb: vi.fn(),
}));
vi.mock("@/lib/resume-parser", async () => {
    const actual = await vi.importActual("@/lib/resume-parser");
    return {
        ...actual,
        parseResume: vi.fn(),
    };
});
vi.mock("@/lib/storage", () => ({
    isStorageConfigured: vi.fn(),
    uploadResumeToS3: vi.fn(),
}));

const { getDb } = await import("@/lib/mongodb");
const { parseResume, ResumeValidationError } = await import("@/lib/resume-parser");
const { isStorageConfigured, uploadResumeToS3 } = await import("@/lib/storage");

const { POST } = await import("@/app/api/process-resume/route");

describe("POST /api/process-resume", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("parses a resume, stores it, and returns portfolio data", async () => {
        const insertOne = vi.fn().mockResolvedValue({ insertedId: "abc123" });
        const collection = vi.fn().mockReturnValue({ insertOne });
        getDb.mockResolvedValue({ collection });

        parseResume.mockResolvedValue({
            name: "Jane Doe",
            summary: "Product manager",
        });

        isStorageConfigured.mockReturnValue(false);
        uploadResumeToS3.mockResolvedValue(null);

        const form = new FormData();
        const file = new File(["Jane resume"], "resume.txt", {
            type: "text/plain",
        });
        form.append("resume", file);

        const request = new Request("http://localhost/api/process-resume", {
            method: "POST",
            body: form,
            headers: {
                origin: "http://localhost:3000",
            },
        });

        const response = await POST(request);
        expect(response.status).toBe(201);

        const payload = await response.json();
        expect(payload.slug).toMatch(/jane-doe-/);
        expect(payload.portfolio.name).toBe("Jane Doe");
        expect(payload.url).toBe(`http://localhost:3000/portfolio/${payload.slug}`);
        expect(insertOne).toHaveBeenCalledTimes(1);
    });

    it("returns 400 when no file is provided", async () => {
        const form = new FormData();
        const request = new Request("http://localhost/api/process-resume", {
            method: "POST",
            body: form,
            headers: {
                origin: "http://localhost:3000",
            },
        });

        const response = await POST(request);
        expect(response.status).toBe(400);
        const payload = await response.json();
        expect(payload.error).toMatch(/upload a resume/i);
    });

    it("returns 422 when parsing determines the upload is not a resume", async () => {
        parseResume.mockRejectedValueOnce(new ResumeValidationError("Document is not a resume"));

        const form = new FormData();
        const file = new File(["Not a resume"], "notes.txt", {
            type: "text/plain",
        });
        form.append("resume", file);

        const request = new Request("http://localhost/api/process-resume", {
            method: "POST",
            body: form,
            headers: {
                origin: "http://localhost:3000",
            },
        });

        const response = await POST(request);
        expect(response.status).toBe(422);
        const payload = await response.json();
        expect(payload.error).toMatch(/not a resume/i);
    });
});
