"use client";

import { useCallback, useRef, useState } from "react";

import { PortfolioPreview } from "./portfolio-preview";

const ACCEPTED_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
];

const MAX_FILE_SIZE_MB = 5;

function formatBytes(bytes) {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function ResumeWorkflow() {
    const inputRef = useRef(null);
    const [status, setStatus] = useState("idle");
    const [error, setError] = useState(null);
    const [portfolio, setPortfolio] = useState(null);
    const [slug, setSlug] = useState(null);
    const [shareUrl, setShareUrl] = useState(null);

    const reset = useCallback(() => {
        setStatus("idle");
        setError(null);
        setPortfolio(null);
        setSlug(null);
        setShareUrl(null);
    }, []);

    const handleFiles = useCallback(async (fileList) => {
        const file = fileList?.[0];
        if (!file) return;

        if (!ACCEPTED_TYPES.includes(file.type)) {
            setError("Unsupported file type. Upload a PDF or Word document.");
            setStatus("error");
            return;
        }

        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            setError(`File is too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
            setStatus("error");
            return;
        }

        setStatus("uploading");
        setError(null);

        try {
            const body = new FormData();
            body.append("resume", file);

            const response = await fetch("/api/process-resume", {
                method: "POST",
                body,
            });

            if (!response.ok) {
                const data = await response.json().catch(() => ({}));

                if (response.status === 422) {
                    throw new Error(
                        data.error ||
                        "This document doesn't look like a resume. Please upload a resume in PDF, DOC, or DOCX format."
                    );
                }

                throw new Error(data.error || "Failed to process resume.");
            }

            const data = await response.json();
            setPortfolio(data.portfolio);
            setSlug(data.slug);
            setShareUrl(data.url || null);
            setStatus("success");
        } catch (uploadError) {
            console.error(uploadError);
            setError(uploadError.message);
            setStatus("error");
        }
    }, []);

    const onDrop = useCallback(
        async (event) => {
            event.preventDefault();
            reset();
            const files = event.dataTransfer?.files;
            if (!files?.length) return;
            await handleFiles(files);
        },
        [handleFiles, reset]
    );

    const onFileChange = useCallback(
        async (event) => {
            reset();
            const files = event.target.files;
            if (!files?.length) return;
            await handleFiles(files);
        },
        [handleFiles, reset]
    );

    const onDragOver = useCallback((event) => {
        event.preventDefault();
    }, []);

    const handleCopy = useCallback(() => {
        if (!shareUrl) return;
        if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
            navigator.clipboard.writeText(shareUrl).catch(() => {
                if (typeof window !== "undefined") {
                    window.prompt("Copy this link", shareUrl);
                }
            });
        } else if (typeof window !== "undefined") {
            window.prompt("Copy this link", shareUrl);
        }
    }, [shareUrl]);

    return (
        <div className="flex w-full max-w-5xl flex-col items-center gap-8">
            <section className="w-full rounded-lg border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm">
                <div
                    className="flex flex-col items-center gap-4"
                    onDrop={onDrop}
                    onDragOver={onDragOver}
                >
                    <p className="text-lg font-medium text-neutral-900">
                        Drag and drop your resume here
                    </p>
                    <p className="text-sm text-neutral-500">
                        Accepted formats: PDF, DOC, DOCX (max {MAX_FILE_SIZE_MB} MB)
                    </p>
                    <button
                        type="button"
                        className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                        onClick={() => inputRef.current?.click()}
                    >
                        Browse files
                    </button>
                    <input
                        ref={inputRef}
                        type="file"
                        accept={ACCEPTED_TYPES.join(",")}
                        className="hidden"
                        onChange={onFileChange}
                    />
                </div>
                {status === "uploading" && (
                    <p className="mt-6 text-sm text-neutral-500">Processing your resume…</p>
                )}
                {status === "success" && (slug || shareUrl) && (
                    <div className="mt-6 flex flex-col items-center gap-2 text-center text-sm text-green-600">
                        {slug && (
                            <p>
                                Portfolio generated! Slug: <span className="font-medium">{slug}</span>
                            </p>
                        )}
                        {shareUrl && (
                            <div className="flex flex-col items-center gap-2 text-neutral-700">
                                <a
                                    href={shareUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="break-all text-sm font-medium text-green-700 underline"
                                >
                                    {shareUrl}
                                </a>
                                <button
                                    type="button"
                                    onClick={handleCopy}
                                    className="rounded-full border border-green-200 px-4 py-1 text-xs font-medium text-green-700 hover:bg-green-50"
                                >
                                    Copy link
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {status === "error" && error && (
                    <p className="mt-6 text-sm text-red-600">{error}</p>
                )}
            </section>

            {portfolio ? (
                <PortfolioPreview portfolio={portfolio} />
            ) : (
                <section className="w-full max-w-3xl rounded-lg border border-neutral-200 bg-white p-8 text-neutral-500">
                    <h2 className="text-lg font-semibold text-neutral-800">Preview</h2>
                    <p className="mt-2 text-sm">
                        Upload a resume to see a minimalist portfolio generated for you.
                    </p>
                </section>
            )}

            {portfolio && status === "success" && (
                <section className="w-full max-w-3xl text-sm text-neutral-500">
                    <p>
                        Want to refine it? Edit the JSON model on the server side and re-render, or
                        add inline editing controls in this interface as a follow-up.
                    </p>
                </section>
            )}
        </div>
    );
}
