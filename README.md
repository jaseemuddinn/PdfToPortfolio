## PDF to Portfolio (Development Phase)

Transform PDF or Word resumes into minimalist, shareable portfolio pages in seconds. Upload a resume, let the backend parse the content, and preview the generated layout immediately.

### Features

- Drag-and-drop resume upload with client-side validation.
- Server-side parsing for PDF/DOC/DOCX (via `pdf-parse` and `mammoth`).
- Optional Gemini-assisted parsing to normalize tricky resume formats.
- Structured portfolio data stored in MongoDB with shareable slugs.
- Optional AWS S3 storage for original resume files.
- Instant preview on the homepage plus a dedicated `/portfolio/[slug]` route.

## Prerequisites

- Node.js 18.18 or later.
- Access to a MongoDB database (MongoDB Atlas recommended).
- (Optional) AWS S3 bucket + credentials for storing uploaded resumes.
- (Optional) Google Gemini API key for LLM-powered resume analysis.

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values:

3. Start the dev server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) and drop in a resume to generate a preview. Visit `/portfolio/<slug>` to view the persisted portfolio page.

## Tests

Automated tests are powered by Vitest (see `package.json`). Run them anytime with:

```bash
npm test
```

## Deployment notes

- Ensure environment variables are set in your hosting platform (Vercel, Netlify, etc.).
- Provision MongoDB and optional S3 access before deploying.
- Consider enabling HTTPS for any external callbacks or file uploads if hosting custom infrastructure.
