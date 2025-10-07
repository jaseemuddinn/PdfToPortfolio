const ICONS = {
    email: "📧",
    phone: "📞",
    location: "📍",
    link: "🔗",
};

function formatUrlLabel(url) {
    if (!url) return null;
    try {
        const parsed = new URL(url);
        return parsed.hostname.replace(/^www\./, "");
    } catch (error) {
        return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
    }
}

function ContactChip({ icon, label, href }) {
    const content = (
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm text-white/90 backdrop-blur-sm transition hover:bg-white/20">
            <span aria-hidden>{icon}</span>
            <span className="truncate text-ellipsis max-w-[200px] sm:max-w-none">{label}</span>
        </span>
    );

    if (href) {
        return (
            <a href={href} className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900">
                {content}
            </a>
        );
    }

    return content;
}

function SectionShell({ title, kicker, children }) {
    return (
        <section className="rounded-2xl border border-neutral-200/80 bg-white/80 p-8 shadow-sm shadow-neutral-200/40 backdrop-blur-sm">
            <div className="flex items-center justify-between gap-4">
                <div>
                    {kicker && <p className="text-xs uppercase tracking-[0.35em] text-neutral-400">{kicker}</p>}
                    <h3 className="text-xl font-semibold text-neutral-900">{title}</h3>
                </div>
            </div>
            <div className="mt-6 space-y-6 text-sm text-neutral-600">{children}</div>
        </section>
    );
}

export function PortfolioPreview({ portfolio }) {
    if (!portfolio) {
        return null;
    }

    const {
        name,
        contact = {},
        summary,
        experience = [],
        education = [],
        skills = [],
        projects = [],
        achievements = [],
    } = portfolio;

    const heroSummary = summary?.length > 280 ? `${summary.slice(0, 280)}…` : summary;

    const contactChips = [];
    const seenChipKeys = new Set();

    function addChip(chip) {
        if (!chip?.label) return;
        const key = chip.href || chip.label;
        if (seenChipKeys.has(key)) return;
        seenChipKeys.add(key);
        contactChips.push(chip);
    }

    if (contact?.email) {
        addChip({
            icon: ICONS.email,
            label: contact.email,
            href: `mailto:${contact.email}`,
        });
    }

    if (contact?.phone) {
        const tel = contact.phone.replace(/[^0-9+]/g, "");
        addChip({
            icon: ICONS.phone,
            label: contact.phone,
            href: tel ? `tel:${tel}` : undefined,
        });
    }

    if (contact?.location) {
        addChip({
            icon: ICONS.location,
            label: contact.location,
        });
    }

    if (contact?.website) {
        const href = contact.website.startsWith("http") ? contact.website : `https://${contact.website}`;
        addChip({
            icon: ICONS.link,
            label: formatUrlLabel(href) || contact.website,
            href,
        });
    }

    const socialEntries = [
        contact?.linkedin && {
            icon: ICONS.link,
            label: "LinkedIn",
            href: contact.linkedin,
        },
        contact?.github && {
            icon: ICONS.link,
            label: "GitHub",
            href: contact.github,
        },
        ...(Array.isArray(contact?.links) ? contact.links.map((link) => ({
            icon: ICONS.link,
            label: link.label || formatUrlLabel(link.url),
            href: link.url,
        })) : []),
    ].filter(Boolean);

    socialEntries.forEach((chip) => {
        if (!chip.href) return;
        if (!chip.label) {
            chip.label = formatUrlLabel(chip.href) || chip.href;
        }
        addChip(chip);
    });

    const hasExperience = Array.isArray(experience) && experience.some((item) => item?.heading || (item?.bullets && item.bullets.length));
    const hasEducation = Array.isArray(education) && education.some((item) => item?.heading || (item?.details && item.details.length));
    const hasSkills = Array.isArray(skills) && skills.length > 0;
    const hasProjects = Array.isArray(projects) && projects.length > 0;
    const hasAchievements = Array.isArray(achievements) && achievements.length > 0;

    return (
        <section className="w-full max-w-5xl overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-xl shadow-neutral-200/70">
            <div className="relative isolate overflow-hidden bg-neutral-900 px-8 py-12 text-white sm:px-12">
                <span
                    className="absolute -right-24 top-1/2 h-72 w-72 -translate-y-1/2 rounded-full bg-white/10 blur-3xl"
                    aria-hidden
                />
                <div className="relative z-10 flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
                    <div className="max-w-3xl space-y-4">
                        <p className="text-xs uppercase tracking-[0.4em] text-white/60">Portfolio</p>
                        <h2 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                            {name || "Unnamed Professional"}
                        </h2>
                        {heroSummary && (
                            <p className="text-base leading-relaxed text-white/80">{heroSummary}</p>
                        )}
                    </div>

                    {contactChips.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                            {contactChips.map(({ icon, label, href }, idx) => (
                                <ContactChip key={`${label}-${idx}`} icon={icon} label={label} href={href} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid gap-8 px-8 py-10 sm:px-12">
                {summary && (
                    <SectionShell title="About" kicker="Profile overview">
                        <p className="text-base leading-relaxed text-neutral-700">{summary}</p>
                    </SectionShell>
                )}

                {hasExperience && (
                    <SectionShell title="Experience" kicker="Professional timeline">
                        <div className="relative border-l border-dashed border-neutral-200 pl-6">
                            {experience.map((item, idx) => {
                                const hasBullets = Array.isArray(item?.bullets) && item.bullets.length > 0;
                                const heading = item?.heading || `Role ${idx + 1}`;

                                return (
                                    <article key={idx} className="relative pb-10 last:pb-0">
                                        <span className="absolute -left-[9px] top-2 h-4 w-4 rounded-full border-4 border-white bg-neutral-900 shadow-md" />
                                        <h4 className="text-lg font-semibold text-neutral-900">{heading}</h4>
                                        {hasBullets ? (
                                            <ul className="mt-3 space-y-2 text-sm text-neutral-600">
                                                {item.bullets.map((bullet, bulletIdx) => (
                                                    <li key={bulletIdx} className="flex gap-2">
                                                        <span className="mt-[6px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neutral-400" aria-hidden />
                                                        <span>{bullet}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="mt-2 text-sm text-neutral-500">No details provided.</p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </SectionShell>
                )}

                {hasSkills && (
                    <SectionShell title="Skills" kicker="Core strengths">
                        <div className="flex flex-wrap gap-3">
                            {skills.map((skill, idx) => (
                                <span
                                    key={idx}
                                    className="rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-700 shadow-sm shadow-neutral-200/60"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </SectionShell>
                )}

                {hasProjects && (
                    <SectionShell title="Highlighted Projects" kicker="Selected work">
                        <div className="grid gap-4 sm:grid-cols-2">
                            {projects.map((project, idx) => (
                                <article
                                    key={idx}
                                    className="rounded-xl border border-neutral-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md"
                                >
                                    {project.name && (
                                        <h4 className="text-base font-semibold text-neutral-900">{project.name}</h4>
                                    )}
                                    {project.description && (
                                        <p className="mt-2 text-sm text-neutral-600 leading-relaxed">{project.description}</p>
                                    )}
                                    {Array.isArray(project.details) && project.details.length > 0 && (
                                        <ul className="mt-3 space-y-1 text-sm text-neutral-600">
                                            {project.details.map((detail, detailIndex) => (
                                                <li key={detailIndex} className="flex gap-2">
                                                    <span className="mt-[6px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neutral-300" aria-hidden />
                                                    <span>{detail}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </article>
                            ))}
                        </div>
                    </SectionShell>
                )}

                {hasAchievements && (
                    <SectionShell title="Achievements" kicker="Highlights">
                        <ul className="space-y-2 text-sm text-neutral-600">
                            {achievements.map((achievement, idx) => (
                                <li key={idx} className="flex gap-2">
                                    <span className="mt-[6px] inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full bg-neutral-300" aria-hidden />
                                    <span>{achievement}</span>
                                </li>
                            ))}
                        </ul>
                    </SectionShell>
                )}

                {hasEducation && (
                    <SectionShell title="Education" kicker="Academic journey">
                        <div className="grid gap-4 sm:grid-cols-2">
                            {education.map((item, idx) => {
                                const details = Array.isArray(item?.details) ? item.details.filter(Boolean) : [];
                                return (
                                    <article
                                        key={idx}
                                        className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm"
                                    >
                                        <h4 className="text-sm font-semibold text-neutral-900">
                                            {item?.heading || "Institution"}
                                        </h4>
                                        {details.length > 0 && (
                                            <p className="mt-2 text-xs text-neutral-500">{details.join(" · ")}</p>
                                        )}
                                    </article>
                                );
                            })}
                        </div>
                    </SectionShell>
                )}

                {!summary && !hasExperience && !hasEducation && !hasSkills && !hasProjects && !hasAchievements && (
                    <SectionShell title="Portfolio" kicker="Awaiting content">
                        <p className="text-sm text-neutral-500">
                            Upload a resume with more details to unlock a fully personalized portfolio layout.
                        </p>
                    </SectionShell>
                )}
            </div>
        </section>
    );
}
