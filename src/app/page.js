import { ResumeWorkflow } from "@/components/resume-workflow";

export default function Home() {
  return (
    <main className="min-h-screen bg-neutral-50 px-6 py-16 sm:px-12">
      <div className="mx-auto flex max-w-6xl flex-col items-center gap-12">
        <section className="text-center sm:text-left">
          <p className="text-sm uppercase tracking-[0.3em] text-neutral-500">
            Resume to Portfolio
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-900 sm:text-5xl">
            Turn your resume into a minimalist portfolio in seconds
          </h1>
          <p className="mt-4 max-w-2xl text-base text-neutral-600">
            Drop in your PDF or Word resume and we’ll transform it into a clean, shareable
            portfolio layout that you can tweak and publish. No manual formatting, no hassle.
          </p>
        </section>

        <ResumeWorkflow />
      </div>
    </main>
  );
}
