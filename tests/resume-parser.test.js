import { describe, expect, it } from "vitest";

import { ResumeValidationError, parseResume } from "@/lib/resume-parser";

const SAMPLE_RESUME_TEXT = `Jane Doe
jane.doe@example.com | 555-123-4567

Summary
Product manager with a focus on user experience and cross-functional collaboration.

Experience
Acme Corp — Senior Product Manager (2019-2024)
- Led a team of 8 to ship new SaaS features
- Increased activation by 18%

Skills
Product Strategy, Roadmapping, Stakeholder Management, Figma, SQL
`;

describe("parseResume", () => {
    it("parses plain text resumes into structured data", async () => {
        const buffer = Buffer.from(SAMPLE_RESUME_TEXT, "utf-8");
        const result = await parseResume(buffer, "text/plain");

        expect(result.name).toBe("Jane Doe");
        expect(result.contact.email).toBe("jane.doe@example.com");
        expect(result.summary).toContain("Product manager");
        expect(result.experience.length).toBeGreaterThan(0);
        expect(result.skills).toContain("Figma");
        expect(result.meta?.heuristics?.isLikely).toBe(true);
    });

    it("throws for unsupported mime types", async () => {
        const buffer = Buffer.from("Unsupported", "utf-8");
        await expect(parseResume(buffer, "application/zip")).rejects.toThrow(
            "Unsupported file type"
        );
    });

    it("rejects documents that do not resemble resumes", async () => {
        const buffer = Buffer.from("This brochure describes vacation packages and pricing tiers.", "utf-8");
        await expect(parseResume(buffer, "text/plain")).rejects.toBeInstanceOf(ResumeValidationError);
    });
});
