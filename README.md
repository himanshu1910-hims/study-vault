# StudyVault — Cloud Study Notes, Folder Storage & Personalized Commute Audio Summaries

StudyVault combines a high-speed personal study document vault (**React 19 + TypeScript + Tailwind CSS + Firebase Firestore**) with a **Personalized Commute Audio Studio** powered by **Gemini 3.8 Flash** and **Gemini 3.8 Flash TTS (`gemini-3.8-flash-tts`)**.

---

## Key Capabilities

1. **Hierarchical Subject & Topic Folders (Root Index + Unlimited Subfolders)**
   - Instant root index folder (`My Library`) and nested subject/chapter folders with zero missing-index errors.
   - Optimistic 0ms folder creation, renaming, color tagging, moving (with circular-move protection), starring, and Recycle Bin restore.

2. **Reliable Multi-File Upload & Hybrid Cloud Storage**
   - Drag-and-drop PDFs, DOCX, PPTX, XLSX, TXT, MD, and Images (up to 50 MB per file).
   - Binary files are automatically cached in `IndexedDB` for 0ms local opening and uploaded as chunked documents in Firestore (`/files/{fileId}/chunks/{chunkId}`), eliminating Cloud Storage bucket CORS/permission failures.

3. **Integrated PDF.js Reader & Document Previews**
   - Read PDFs directly inside the browser with Zoom (`50%–250%`), `90°` clockwise rotation, page navigation, and fullscreen mode.
   - Automatic plain-text indexing on PDFs and notes for instant search and 1-click **Commute Audio Summary** or **Read Aloud (TTS)**.

4. **Personalized Commute Audio Studio (`gemini-3.8-flash-tts`)**
   - Paste one or multiple news articles, fetch readable text from an article URL, or combine uploaded PDFs/notes from your StudyVault folders.
   - Choose **2-Host Podcast Dialogue** (`Alex & Sam` using `multiSpeakerVoiceConfig`) or **Single News Anchor** in **English**, **Hindi**, or **Hinglish**.
   - Docked **Commute Player Bar** with queue playback, `1x–2x` speed toggle, `±15s` skip, live spoken script drawer, and WAV download.

5. **GitHub Pages & Cloud Deployment Ready**
   - Configured with `base: './'` in `vite.config.ts` so compiled `dist/index.html` assets resolve properly on GitHub Pages subpaths (`https://<user>.github.io/<repo>/`) as well as Cloud Run and Firebase Hosting.
   - Includes `.github/workflows/deploy.yml` for automatic GitHub Pages builds on every push.

---

## Local Development & Testing

```bash
npm install
npm run dev
```

Run unit & security rule verification tests:
```bash
npx tsx --test src/utils/fileHelpers.test.ts firestore.rules.test.ts
```
