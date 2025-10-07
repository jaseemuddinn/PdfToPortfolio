import { notFound } from "next/navigation";

import { getDb } from "@/lib/mongodb";
import { PortfolioPreview } from "@/components/portfolio-preview";

export const dynamic = "force-dynamic";

async function fetchPortfolio(slug) {
    const db = await getDb();
    const collectionName = process.env.MONGODB_COLLECTION || "portfolios";
    const collection = db.collection(collectionName);
    const document = await collection.findOne({ slug });
    if (!document) {
        return null;
    }

    const { portfolio, createdAt, updatedAt, resumeMetadata, shareUrl, slug: storedSlug } = document;
    return {
        portfolio,
        createdAt: createdAt?.toISOString?.() || null,
        updatedAt: updatedAt?.toISOString?.() || null,
        resumeMetadata: resumeMetadata || null,
        shareUrl: shareUrl || null,
        slug: storedSlug || slug,
    };
}

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const data = await fetchPortfolio(slug);

    if (!data) {
        return {
            title: "Portfolio not found",
            description: "We couldn’t locate this generated portfolio.",
        };
    }

    const name = data?.portfolio?.name;
    return {
        title: name ? `${name} · Portfolio` : "Generated Portfolio",
        description:
            "Minimalist portfolio generated automatically from a resume upload.",
    };
}

export default async function PortfolioPage({ params }) {
    const { slug } = await params;
    const data = await fetchPortfolio(slug);

    if (!data) {
        notFound();
    }

    const lastUpdated = data.updatedAt ? new Date(data.updatedAt).toLocaleString() : null;
    const shareUrl = data.shareUrl || `/portfolio/${data.slug || slug}`;
    const resumeDownload = data.resumeMetadata?.storageUrl;

    return (
        <main className="min-h-screen bg-gradient-to-b from-neutral-100 via-white to-neutral-100 px-6 py-16 sm:px-12">
            <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
                <header className="flex flex-col gap-4 rounded-3xl border border-neutral-200 bg-white/80 p-6 shadow-sm shadow-neutral-200/60 backdrop-blur">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <div>
                            <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">
                                Generated portfolio
                            </p>
                            <h1 className="text-2xl font-semibold text-neutral-900">
                                {data.portfolio?.name || "Untitled Portfolio"}
                            </h1>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs text-neutral-500">
                            {lastUpdated && <span className="rounded-full bg-neutral-100 px-3 py-1">Updated {lastUpdated}</span>}
                            <span className="rounded-full bg-neutral-100 px-3 py-1">Slug: {data.slug || slug}</span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-sm text-neutral-600">
                        {shareUrl && (
                            <a
                                href={shareUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:-translate-y-[1px] hover:shadow">
                                <span aria-hidden>🔗</span>
                                <span>View live portfolio</span>
                            </a>
                        )}
                        {resumeDownload && (
                            <a
                                href={resumeDownload}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm transition hover:-translate-y-[1px] hover:shadow"
                            >
                                <span aria-hidden>⬇️</span>
                                <span>Download original resume</span>
                            </a>
                        )}
                    </div>
                </header>

                <PortfolioPreview portfolio={data.portfolio} />
            </div>
        </main>
    );
}
