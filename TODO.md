# Project TODO

- [x] Add resume parsing dependencies (`mongodb`, `pdf-parse`, `mammoth`, `@aws-sdk/client-s3`) and update configuration notes.
- [x] Implement MongoDB connection helper for reuse across server actions/routes.
- [x] Implement AWS S3 upload helper to persist original resumes when required.
- [x] Create resume processing API route to parse uploads and return normalized portfolio data.
- [x] Build drag-and-drop resume upload UI with client-side states and validation.
- [x] Render minimalist portfolio preview from parsed data on the homepage.
- [x] Add portfolio detail route (`/portfolio/[slug]`) backed by MongoDB data.
- [x] Update documentation with environment variable setup, run instructions, and feature overview.
- [x] Redesign portfolio preview/detail pages with a modern, responsive layout.
- [x] Add automated tests covering parsing fallbacks and API handler edge cases.
