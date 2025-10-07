import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GEMINI_API_KEY;
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let client;

export function isGeminiConfigured() {
    return Boolean(apiKey);
}

function getClient() {
    if (!isGeminiConfigured()) {
        throw new Error("Gemini is not configured. Set GEMINI_API_KEY to enable LLM parsing.");
    }

    if (!client) {
        client = new GoogleGenerativeAI(apiKey);
    }

    return client;
}

function sanitizeText(text, maxLength = 12000) {
    if (text.length <= maxLength) {
        return text;
    }
    return `${text.slice(0, maxLength)}\n\n[TRUNCATED ${text.length - maxLength} CHARACTERS]`;
}

export async function analyzeResumeWithGemini(rawText) {
    if (!isGeminiConfigured()) {
        return null;
    }

    try {
        const genAI = getClient();
        const model = genAI.getGenerativeModel({
            model: modelName,
            generationConfig: {
                temperature: 0.2,
                maxOutputTokens: 2048,
                responseMimeType: "application/json",
            },
        });

        const prompt = `You are an expert resume analyst. Given the raw text of a document, decide if it is a professional resume. If it is, extract structured data that can populate a portfolio. Respond with strict JSON (no additional commentary) matching this shape:
{
    "is_resume": boolean,
    "confidence": number (0-1),
    "reason": string,
    "candidate": {
        "name": string | null,
        "contact": {
            "email": string | null,
            "phone": string | null,
            "location": string | null,
            "website": string | null,
            "linkedin": string | null,
            "github": string | null,
            "links": Array<{ "label": string | null, "url": string }>
        },
        "summary": string | null,
        "experience": Array<{
            "role": string | null,
            "company": string | null,
            "start": string | null,
            "end": string | null,
            "highlights": string[]
        }>,
        "education": Array<{
            "institution": string | null,
            "degree": string | null,
            "years": string | null,
            "details": string[]
        }>,
        "skills": string[],
        "projects": Array<{
            "name": string | null,
            "description": string | null,
            "details": string[] | null
        }>,
        "achievements": string[]
    }
}

Guidelines:
- Preserve key facts from the resume; do not invent data.
- Ensure arrays contain trimmed strings with at least 3-5 bullet points when available.
- Omit duplicate or contact-only lines from summaries, highlights, and details.
- Normalize URLs to include https:// and provide labels for extra links when possible.
- If the document is not a resume, set "is_resume" to false, supply a brief reason, and omit the candidate object.

Document text:\n"""${sanitizeText(rawText)}"""`;

        const result = await model.generateContent({
            contents: [
                {
                    role: "user",
                    parts: [{ text: prompt }],
                },
            ],
        });

        const jsonText = result?.response?.text();
        if (!jsonText) {
            return null;
        }

        try {
            return JSON.parse(jsonText);
        } catch (parseError) {
            console.error("Failed to parse Gemini response", parseError, jsonText);
            return null;
        }
    } catch (error) {
        console.error("Gemini analysis failed", error);
        return null;
    }
}
