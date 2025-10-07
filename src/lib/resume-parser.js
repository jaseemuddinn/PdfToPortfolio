import { analyzeResumeWithGemini, isGeminiConfigured } from "./gemini";

const HEADING_ALIASES = {
    summary: [
        "summary",
        "objective",
        "about",
        "professional summary",
        "profile",
        "career summary",
    ],
    experience: [
        "experience",
        "work experience",
        "professional experience",
        "employment history",
        "career history",
        "work history",
        "professional background",
    ],
    education: ["education", "academic background", "academics", "education & certifications"],
    skills: [
        "skills",
        "technical skills",
        "core competencies",
        "skills summary",
        "key skills",
        "skills & tools",
        "technical proficiencies",
    ],
    projects: [
        "projects",
        "selected projects",
        "portfolio",
        "project highlights",
        "highlighted projects",
        "project experience",
        "project",
    ],
    achievements: [
        "achievements",
        "accomplishments",
        "awards",
        "recognition",
        "distinctions",
        "achievement",
    ],
};

const headingLookup = new Map();
Object.entries(HEADING_ALIASES).forEach(([canonical, aliases]) => {
    aliases.forEach((alias) => {
        headingLookup.set(alias.toLowerCase(), canonical);
    });
});

const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const phoneRegex = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{4}|\d{5}[\s-]?\d{5})/;
const NAME_WORD_REGEX = /^[A-Za-zÀ-ÖØ-öø-ÿ'`.-]+$/;
const CONTACT_TOKENS = [
    "email",
    "e-mail",
    "mail",
    "phone",
    "mobile",
    "contact",
    "linkedin",
    "github",
    "portfolio",
    "website",
    "www",
    "http",
    "tel",
];
const CONTACT_KEYWORDS = [...CONTACT_TOKENS, "location", "based in"];

const SOCIAL_PATTERNS = [
    {
        type: "LinkedIn",
        regex: /(https?:\/\/)?(www\.)?linkedin\.com\/[A-Za-z0-9_/\-]+/i,
    },
    {
        type: "GitHub",
        regex: /(https?:\/\/)?(www\.)?github\.com\/[A-Za-z0-9_/\-]+/i,
    },
    {
        type: "Portfolio",
        regex: /(https?:\/\/|www\.)[A-Za-z0-9._~:/?#@!$&'()*+,;=-]+/i,
    },
];

function collectSocialLinksFromText(source, contact, seenLinks) {
    if (!source) return;

    SOCIAL_PATTERNS.forEach(({ type, regex }) => {
        const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
        const globalRegex = new RegExp(regex.source, flags);
        let match;

        while ((match = globalRegex.exec(source))) {
            let normalizedUrl = normalizeSocialUrl(match[0]);
            if (!normalizedUrl) continue;

            normalizedUrl = normalizedUrl.replace(/(?:\/)?(?:mobile|phone|email)$/i, "");

            if (seenLinks.has(normalizedUrl)) continue;

            const label = labelForSocialLink(type, normalizedUrl);
            seenLinks.set(normalizedUrl, { type, url: normalizedUrl, label });

            if (type === "Portfolio" && !contact.website) {
                contact.website = normalizedUrl;
            }
            if (type === "LinkedIn" && !contact.linkedin) {
                contact.linkedin = normalizedUrl;
            }
            if (type === "GitHub" && !contact.github) {
                contact.github = normalizedUrl;
            }
        }
    });
}

const HEADING_KEYWORDS = new Set(
    [
        ...Object.keys(HEADING_ALIASES),
        ...Object.values(HEADING_ALIASES).flat(),
        "experience",
        "education",
        "skills",
        "projects",
        "portfolio",
        "profile",
        "summary",
        "objective",
        "contact",
        "achievements",
        "awards",
        "accomplishments",
    ].map((word) => word.toLowerCase())
);

function normalizeSocialUrl(url) {
    if (!url) return null;
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    if (trimmed.startsWith("www.")) {
        return `https://${trimmed}`;
    }
    return `https://${trimmed}`;
}

function labelForSocialLink(type, url) {
    if (!url) return type;
    try {
        const parsed = new URL(url);
        if (type === "Portfolio") {
            return parsed.hostname.replace(/^www\./, "");
        }
        return type;
    } catch (error) {
        return type;
    }
}

export class ResumeValidationError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = "ResumeValidationError";
        this.details = details;
    }
}

function normalizeHeading(line) {
    if (!line) {
        return null;
    }

    const sanitized = line
        .replace(/^[\s|·•●◦▶■□▪▫➤➔⮕⮞⮟\-–—]+/, "")
        .replace(/[:.\s]+$/, "")
        .trim()
        .toLowerCase();

    if (!sanitized) {
        return null;
    }

    if (headingLookup.has(sanitized)) {
        return headingLookup.get(sanitized);
    }

    if (sanitized.endsWith("s")) {
        const singular = sanitized.replace(/s$/, "");
        if (headingLookup.has(singular)) {
            return headingLookup.get(singular);
        }
    }

    return null;
}

function splitIntoSections(lines) {
    const sections = {};
    let currentSection = "summary";
    sections[currentSection] = [];

    lines.forEach((rawLine) => {
        const line = typeof rawLine === "string" ? rawLine : "";
        const trimmed = line.trim();

        if (!trimmed) {
            if (!sections[currentSection]) {
                sections[currentSection] = [];
            }
            sections[currentSection].push("");
            return;
        }

        const possibleHeading = normalizeHeading(trimmed);
        if (possibleHeading) {
            currentSection = possibleHeading;
            if (!sections[currentSection]) {
                sections[currentSection] = [];
            }
            return;
        }

        if (!sections[currentSection]) {
            sections[currentSection] = [];
        }

        sections[currentSection].push(trimmed);
    });

    return sections;
}

function chunkByBlankLines(lines = []) {
    const chunks = [];
    let buffer = [];

    lines.forEach((line) => {
        const trimmed = (line ?? "").trim();
        if (!trimmed) {
            if (buffer.length) {
                chunks.push(buffer);
                buffer = [];
            }
            return;
        }
        buffer.push(trimmed);
    });

    if (buffer.length) {
        chunks.push(buffer);
    }

    return chunks;
}

const MONTH_REGEX = /(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z.]*/i;

function injectExperienceBreaks(lines = []) {
    const result = [];
    let previousWasBreak = true;

    lines.forEach((line, index) => {
        if (!line) {
            if (!previousWasBreak) {
                result.push("");
            }
            previousWasBreak = true;
            return;
        }

        const trimmed = line.trim();
        const cleaned = trimmed.replace(/^[-•●◦\s]+/, "");
        const startsWithBullet = /^[-•●◦]/.test(trimmed);
        const isDescriptorLine = /^[A-Za-z][A-Za-z\s]{0,20}:/i.test(cleaned);
        const looksLikeHeading =
            !startsWithBullet &&
            !isDescriptorLine &&
            (MONTH_REGEX.test(cleaned) ||
                /\d{4}/.test(cleaned) ||
                (cleaned.split(/\s+/).length <= 8 && /[A-Z]/.test(cleaned.charAt(0))));

        let lastContentLine = null;
        for (let i = result.length - 1; i >= 0; i -= 1) {
            if (result[i] && result[i].trim()) {
                lastContentLine = result[i].trim();
                break;
            }
        }
        const lastWasBullet = lastContentLine ? /^[-•●◦]/.test(lastContentLine) : false;

        const shouldInsertBreak =
            index > 0 &&
            looksLikeHeading &&
            !previousWasBreak &&
            !lastWasBullet &&
            (result.length === 0 || result[result.length - 1] !== "");

        if (shouldInsertBreak) {
            result.push("");
        }

        result.push(trimmed);
        previousWasBreak = false;
    });

    return result;
}

function normalizeExperienceHeading(value) {
    if (!value) return null;
    return value
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
}

function parseExperience(lines = []) {
    const prepared = injectExperienceBreaks(lines);

    return chunkByBlankLines(prepared)
        .map((chunk) => {
            if (!chunk.length) return null;
            const [rawHeading, ...rest] = chunk;
            const heading = normalizeExperienceHeading(rawHeading);
            const bullets = rest
                .map((item) => item.replace(/^[-•●◦\s]+/, "").trim())
                .filter(Boolean);

            if (!heading && bullets.length) {
                const [firstBullet, ...remaining] = bullets;
                return {
                    heading: normalizeExperienceHeading(firstBullet) || null,
                    bullets: remaining,
                };
            }

            return {
                heading: heading || null,
                bullets,
            };
        })
        .filter(Boolean);
}

function parseEducation(lines = []) {
    return chunkByBlankLines(lines)
        .map((chunk) => {
            const cleanedChunk = chunk
                .map((line) => line.replace(/^[-•●◦\s]+/, "").trim())
                .filter(Boolean);

            if (!cleanedChunk.length) {
                return null;
            }

            const [institutionLine, ...rest] = cleanedChunk;
            return {
                heading: institutionLine || null,
                details: rest,
            };
        })
        .filter(Boolean);
}

function parseSkills(lines = []) {
    if (!Array.isArray(lines) || !lines.length) {
        return [];
    }

    return lines
        .flatMap((line) =>
            line
                .split(/[••·\u2022,;\|]/)
                .map((item) => item.trim())
                .filter(Boolean)
        )
        .map((skill) => skill.replace(/^[A-Za-z\s]+:\s*/, "").trim())
        .filter((skill, index, array) => array.findIndex((item) => item.toLowerCase() === skill.toLowerCase()) === index);
}

function parseProjects(lines = []) {
    const filtered = Array.isArray(lines) ? lines.filter((line) => line && !/^[-•●◦]$/.test(line.trim())) : [];
    const chunks = chunkByBlankLines(filtered);
    return chunks
        .map((chunk) => {
            if (!chunk.length) return null;
            const [first, ...rest] = chunk;
            const name = first.replace(/^[-•●◦\s]+/, "").trim();
            const details = rest.map((item) => item.replace(/^[-•●◦\s]+/, "").trim()).filter(Boolean);
            const description = details.join(" ").trim() || null;
            return {
                name: name || null,
                description,
                details,
            };
        })
        .filter(Boolean);
}

function parseAchievements(lines = []) {
    if (!Array.isArray(lines) || !lines.length) {
        return [];
    }

    return lines
        .map((line) => line.replace(/^[-•●◦\s]+/, "").trim())
        .map((item) => item.replace(/[:;]+$/g, "").trim())
        .filter(Boolean);
}

function extractContactInfo(lines) {
    const contact = {
        email: null,
        phone: null,
        location: null,
        website: null,
        links: [],
        linkedin: null,
        github: null,
    };

    const seenLinks = new Map();

    lines.forEach((line) => {
        if (!line) return;

        const cleanedLine = line.replace(/\s+/g, " ").trim();

        if (!contact.email) {
            const emailMatch = cleanedLine.match(emailRegex);
            if (emailMatch) {
                contact.email = emailMatch[0];
            }
        }

        if (!contact.phone) {
            const phoneMatch = cleanedLine.match(phoneRegex);
            if (phoneMatch) {
                contact.phone = phoneMatch[0];
            }
        }

        const segments = cleanedLine
            .replace(/\|/g, " ")
            .replace(/\b(Email|E-mail|Phone|Mobile|LinkedIn|Github|GitHub|Portfolio|Website|Contact)\b/gi, "|$1")
            .split("|")
            .map((segment) => segment.trim())
            .filter(Boolean);

        segments.forEach((segment) => {
            let working = segment;
            const lower = working.toLowerCase();

            if (!contact.location && (lower.startsWith("location") || lower.includes(" based in "))) {
                contact.location = working.replace(/^(location|based in)[^:]*:?/i, "").trim();
            }

            if (CONTACT_KEYWORDS.some((keyword) => lower.startsWith(keyword))) {
                working = working.replace(/^(email|e-mail|phone|mobile|contact|linkedin|github|portfolio|website|www|http|tel)[:\s-]*/i, "").trim();
            }

            SOCIAL_PATTERNS.forEach(({ type, regex }) => {
                const match = working.match(regex);
                if (!match) return;

                let normalizedUrl = normalizeSocialUrl(match[0]);
                if (!normalizedUrl) return;

                normalizedUrl = normalizedUrl.replace(/(?:\/)?(?:mobile|phone|email)$/i, "");

                if (seenLinks.has(normalizedUrl)) return;

                const label = labelForSocialLink(type, normalizedUrl);
                seenLinks.set(normalizedUrl, { type, url: normalizedUrl, label });

                if (type === "Portfolio" && !contact.website) {
                    contact.website = normalizedUrl;
                }
                if (type === "LinkedIn" && !contact.linkedin) {
                    contact.linkedin = normalizedUrl;
                }
                if (type === "GitHub" && !contact.github) {
                    contact.github = normalizedUrl;
                }
            });
        });

        collectSocialLinksFromText(cleanedLine, contact, seenLinks);
    });

    contact.links = Array.from(seenLinks.values()).filter((link) => {
        if (contact.website && link.url === contact.website) {
            return false;
        }
        return true;
    });

    return contact;
}

function cleanSummaryLines(lines = [], contact = {}) {
    if (!Array.isArray(lines) || !lines.length) {
        return [];
    }

    const blockedValues = new Set(
        [contact.email, contact.phone, contact.website]
            .filter(Boolean)
            .map((value) => value.toLowerCase())
    );

    const linkPhrases = (contact.links || [])
        .map((link) => link.url)
        .filter(Boolean)
        .map((url) => url.toLowerCase());

    return lines.filter((line) => {
        const trimmed = line.trim();
        if (!trimmed) return false;
        const lower = trimmed.toLowerCase();

        if (emailRegex.test(trimmed) || phoneRegex.test(trimmed)) {
            return false;
        }

        if (blockedValues.has(lower)) {
            return false;
        }

        if (linkPhrases.some((phrase) => lower.includes(phrase))) {
            return false;
        }

        if (lower.includes("linkedin.com") || lower.includes("github.com")) {
            return false;
        }

        return true;
    });
}

function extractName(lines) {
    const searchWindow = lines.slice(0, 20);

    for (const line of searchWindow) {
        if (!line) continue;

        let working = line.trim();
        if (!working) continue;

        const lower = working.toLowerCase();
        if (HEADING_KEYWORDS.has(lower)) continue;

        CONTACT_TOKENS.forEach((token) => {
            const idx = working.toLowerCase().indexOf(token);
            if (idx > 0) {
                working = working.slice(0, idx).trim();
            }
        });

        working = working.replace(/[|•·]/g, " ").replace(/\s+/g, " ").trim();
        if (!working) continue;

        if (working.includes("@") || /(https?:\/\/|www\.)/i.test(working)) continue;

        const words = working.split(/\s+/);
        if (words.length < 2 || words.length > 6) continue;

        const cleanedWords = words.map((word) => word.replace(/[.,]/g, ""));
        if (cleanedWords.some((word) => !NAME_WORD_REGEX.test(word))) continue;

        const capitalizedCount = cleanedWords.filter((word) => {
            if (!word) return false;
            const firstChar = word.charAt(0);
            return firstChar === firstChar.toUpperCase();
        }).length;

        if (capitalizedCount >= Math.ceil(cleanedWords.length / 2)) {
            return cleanedWords.join(" ");
        }
    }

    const fallback = lines.find((line) => line && /^[A-Z'`\-\s]+$/.test(line.toUpperCase()));
    if (fallback && !HEADING_KEYWORDS.has(fallback.trim().toLowerCase())) {
        return fallback.trim();
    }

    return null;
}

function dedupeLines(lines = []) {
    const result = [];
    let previous = null;

    lines.forEach((line) => {
        const current = typeof line === "string" ? line : "";
        if (previous !== null && current.toLowerCase() === previous.toLowerCase()) {
            return;
        }
        result.push(current);
        previous = current;
    });

    return result;
}

async function extractText(buffer, mimeType) {
    if (mimeType === "application/pdf") {
        const pdfParseModule = await import("pdf-parse/lib/pdf-parse.js");
        const pdfParse = pdfParseModule.default || pdfParseModule;
        const { text } = await pdfParse(buffer);
        return text;
    }

    if (
        mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        mimeType === "application/msword"
    ) {
        const mammothModule = await import("mammoth");
        const mammoth = mammothModule.default || mammothModule;
        const { value } = await mammoth.extractRawText({ buffer });
        return value;
    }

    if (mimeType.startsWith("text/")) {
        return buffer.toString("utf-8");
    }

    throw new Error(`Unsupported file type: ${mimeType}`);
}

function evaluateResumeLikelihood(text, sections, lines) {
    const normalized = text.toLowerCase();
    const keywords = ["experience", "education", "skills", "summary", "employment", "professional", "portfolio"];
    const matchedKeywords = keywords.filter((keyword) => normalized.includes(keyword));
    const bulletMatches = text.match(/\n[•*\-]/g) || [];
    const sectionHits = Object.entries(sections)
        .filter(([section, values]) => section !== "summary" && Array.isArray(values) && values.some(Boolean))
        .map(([section]) => section);

    const keywordScore = matchedKeywords.length / keywords.length;
    const bulletScore = Math.min(bulletMatches.length / 6, 1) * 0.2;
    const sectionScore = Math.min(sectionHits.length / 3, 1) * 0.4;
    const contactScore = (emailRegex.test(text) ? 0.2 : 0) + (phoneRegex.test(text) ? 0.1 : 0);
    const hasName = Boolean(extractName(lines));
    const nameScore = hasName ? 0.1 : 0;

    const score = Number((keywordScore * 0.4 + bulletScore + sectionScore + contactScore + nameScore).toFixed(3));
    const isLikely = score >= 0.45 || matchedKeywords.length >= 3 || sectionHits.length >= 2;

    const reason = isLikely
        ? `Detected resume-like structure with sections: ${sectionHits.join(", ") || "n/a"}`
        : `Could not find enough resume clues (keywords: ${matchedKeywords.join(", ") || "none"}).`;

    return {
        isLikely,
        score,
        matchedKeywords,
        sectionHits,
        reason,
    };
}

function coerceString(value) {
    if (typeof value === "string") {
        const trimmed = value.trim();
        return trimmed.length ? trimmed : null;
    }
    return null;
}

function coerceStringArray(value) {
    if (Array.isArray(value)) {
        return value
            .map((item) => (typeof item === "string" ? item.trim() : ""))
            .filter(Boolean);
    }
    if (typeof value === "string") {
        return value
            .split(/\n|,|\u2022|•|;|\|/)
            .map((item) => item.trim())
            .filter(Boolean);
    }
    return [];
}

function mergeStructuredData(base, candidate = {}) {
    if (!candidate) {
        return base;
    }

    const candidateLinks = Array.isArray(candidate?.contact?.links)
        ? candidate.contact.links
            .map((link) => {
                if (!link) return null;
                if (typeof link === "string") {
                    const normalizedUrl = normalizeSocialUrl(link);
                    return normalizedUrl ? { url: normalizedUrl, label: labelForSocialLink("Link", normalizedUrl) } : null;
                }
                if (typeof link === "object") {
                    const normalizedUrl = normalizeSocialUrl(link.url || link.href || "");
                    if (!normalizedUrl) {
                        return null;
                    }
                    return {
                        url: normalizedUrl,
                        label: link.label || link.title || labelForSocialLink(link.type || "Link", normalizedUrl),
                    };
                }
                return null;
            })
            .filter(Boolean)
        : null;

    const mergedContact = {
        email: coerceString(candidate?.contact?.email) || base.contact?.email || null,
        phone: coerceString(candidate?.contact?.phone) || base.contact?.phone || null,
        location: coerceString(candidate?.contact?.location) || base.contact?.location || null,
        website: normalizeSocialUrl(coerceString(candidate?.contact?.website)) || base.contact?.website || null,
        linkedin: normalizeSocialUrl(coerceString(candidate?.contact?.linkedin)) || base.contact?.linkedin || null,
        github: normalizeSocialUrl(coerceString(candidate?.contact?.github)) || base.contact?.github || null,
        links: candidateLinks?.length ? candidateLinks : base.contact?.links || [],
    };

    const normalizeExperience = (entries) => {
        const list = Array.isArray(entries) ? entries : [];
        if (!list.length) return null;
        return list
            .map((item) => {
                const role = coerceString(item?.role) || "";
                const company = coerceString(item?.company) || "";
                const start = coerceString(item?.start) || "";
                const end = coerceString(item?.end) || "";
                const headingParts = [role, company].filter(Boolean);
                const period = [start, end].filter(Boolean).join(" – ");
                if (period) {
                    headingParts.push(period);
                }

                const highlights = coerceStringArray(item?.highlights);

                return {
                    heading: headingParts.join(" · ") || null,
                    bullets: highlights,
                };
            })
            .filter((entry) => entry.heading || (entry.bullets && entry.bullets.length));
    };

    const normalizeEducation = (entries) => {
        const list = Array.isArray(entries) ? entries : [];
        if (!list.length) return null;
        return list
            .map((item) => {
                const headingParts = [coerceString(item?.institution), coerceString(item?.degree)].filter(Boolean);
                const years = coerceString(item?.years);
                const details = coerceStringArray(item?.details);
                const combinedDetails = [years, ...details].filter(Boolean);
                return {
                    heading: headingParts.join(" · ") || headingParts[0] || null,
                    details: combinedDetails,
                };
            })
            .filter((entry) => entry.heading || (entry.details && entry.details.length));
    };

    const normalizeProjects = (entries) => {
        const list = Array.isArray(entries) ? entries : [];
        if (!list.length) return null;
        return list
            .map((item) => {
                const name = coerceString(item?.name);
                const description = coerceString(item?.description);
                const details = coerceStringArray(item?.details);
                const fallbackDescription = description || (details.length ? details.join(" ") : null);
                return {
                    name: name || null,
                    description: fallbackDescription,
                    details,
                };
            })
            .filter((entry) => entry.name || entry.description || (entry.details && entry.details.length));
    };

    const normalizeAchievements = (entries) => {
        const list = coerceStringArray(entries);
        return list.length ? list : null;
    };

    const experience = normalizeExperience(candidate?.experience) || base.experience;
    const education = normalizeEducation(candidate?.education) || base.education;
    const projects = normalizeProjects(candidate?.projects) || base.projects;
    const achievements = normalizeAchievements(candidate?.achievements) || base.achievements;

    const candidateSkills = coerceStringArray(candidate?.skills);
    const skills = candidateSkills.length ? candidateSkills : base.skills;

    const candidateSummary = coerceString(candidate?.summary);
    const summary = candidateSummary
        ? cleanSummaryLines(candidateSummary.split(/\n+/), mergedContact).join(" ") || candidateSummary
        : base.summary;

    return {
        ...base,
        name: coerceString(candidate?.name) || base.name,
        contact: mergedContact,
        summary,
        experience,
        education,
        skills,
        projects,
        achievements,
    };
}

export async function parseResume(buffer, mimeType) {
    const text = await extractText(buffer, mimeType);
    const lines = dedupeLines(
        text.split(/\r?\n/).map((line) => (typeof line === "string" ? line.trimEnd() : ""))
    );

    const sections = splitIntoSections(lines);

    const contactInfo = extractContactInfo(lines.slice(0, 20));
    const rawSummaryLines = sections.summary ? [...sections.summary] : [];
    const cleanedSummaryLines = cleanSummaryLines(rawSummaryLines, contactInfo);
    const summaryText = cleanedSummaryLines.length ? cleanedSummaryLines.join(" ") : null;

    const baseResult = {
        name: extractName(lines) || null,
        contact: {
            email: contactInfo.email,
            phone: contactInfo.phone,
            location: contactInfo.location,
            website: contactInfo.website,
            linkedin: contactInfo.linkedin,
            github: contactInfo.github,
            links: contactInfo.links,
        },
        summary: summaryText,
        experience: parseExperience(sections.experience),
        education: parseEducation(sections.education),
        skills: parseSkills(sections.skills),
        projects: parseProjects(sections.projects),
        achievements: parseAchievements(sections.achievements),
        meta: {
            rawText: text,
            mimeType,
        },
    };

    const heuristics = evaluateResumeLikelihood(text, sections, lines);

    if (!heuristics.isLikely && !isGeminiConfigured()) {
        throw new ResumeValidationError(
            "We couldn't detect typical resume details. Please upload a resume in PDF, DOC, or DOCX format.",
            { heuristics }
        );
    }

    let geminiAnalysis = null;
    if (isGeminiConfigured()) {
        geminiAnalysis = await analyzeResumeWithGemini(text);

        if (geminiAnalysis?.is_resume === false) {
            throw new ResumeValidationError(
                geminiAnalysis?.reason || "Gemini determined that this document is not a resume.",
                { heuristics, gemini: geminiAnalysis }
            );
        }
    }

    const merged = mergeStructuredData(baseResult, geminiAnalysis?.candidate);

    return {
        ...merged,
        meta: {
            ...merged.meta,
            heuristics,
            llm: geminiAnalysis
                ? {
                    used: true,
                    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
                    confidence: geminiAnalysis?.confidence ?? null,
                    reason: geminiAnalysis?.reason || null,
                }
                : {
                    used: false,
                    reason: heuristics.reason,
                },
        },
    };
}
