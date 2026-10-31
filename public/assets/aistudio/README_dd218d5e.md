# StudyVault - Personal Study Notes & Document Storage

StudyVault is a modern, responsive personal digital library and cloud document storage web application built with **React**, **TypeScript**, **Tailwind CSS**, and **Firebase** (Cloud Firestore, Firebase Cloud Storage, and Firebase Authentication).

---

## 1. Features

### 📁 Unlimited Folder & Subject Hierarchy
- Organize materials subject-wise (e.g. *M.Pharm*, *B.Pharm*), chapter-wise (e.g. *Pharmaceutics*, *Drug Delivery System*), and unit-wise (*Unit 1 - Preformulation*, *Unit 2 - Modified Release*).
- Create, rename, move, and color-tag folders.
- Interactive breadcrumb navigation (`My Library > M.Pharm > Pharmaceutics > Unit 1`).
- Expandable folder tree in the left sidebar.

### 📄 Multi-Format Document Management
- Supports **PDF**, **DOC/DOCX**, **PPT/PPTX**, **XLS/XLSX**, **Images (PNG, JPG, JPEG)**, and **TXT**.
- Multi-file drag-and-drop uploads directly into any open folder.
- Real-time upload progress indicators (0% to 100%).
- Star/favorite notes and folders for quick access.
- Move files between folders, rename, download original files.
- Bulk selection to delete, move, or star multiple documents.

### 🔍 Integrated PDF Viewer & Document Previews
- Open PDFs directly inside the website without downloading.
- Zoom in / Zoom out (50% to 250%) and zoom reset.
- 90° Clockwise document rotation.
- Full-screen reader mode (`requestFullscreen`).
- Download original PDF button and "Open in new tab" link.
- Image zoom, pan, and text document syntax viewer.

### ⚡ Global Search System
- Instant live search across all folder names, subjects, chapter titles, document names, and PDFs.
- Click any search result to jump straight to the file or folder.

### 🛡️ Authentication & Cloud Security
- Firebase Authentication with Google Sign-in and Email/Password support.
- Zero-trust Firestore Security Rules enforcing Attribute-Based Access Control (`resource.data.userId == request.auth.uid`).
- Strict user data isolation: each student can only view, query, and modify their own documents.

### 💾 Data Safety, Quota Meter & JSON Backup
- Dynamic storage quota meter (tracks bytes used vs. Firebase Spark free tier).
- Categorized storage breakdown (PDFs, Docs, Slides, Sheets, Images).
- **One-click JSON Library Backup**: download a complete local snapshot of your catalog.
- **JSON Backup Restore**: upload a backup to restore folders and notes metadata.
- Recycle Bin (Trash) with individual restore and permanent empty trash options.

---

## 2. Project Architecture

```
├── firebase-applet-config.json    # Firebase project credentials & database IDs
├── firebase-blueprint.json        # Data schema intermediate representation
├── firestore.rules                # Hardened Firestore ABAC security rules
├── security_spec.md               # Threat model & security specifications
├── src/
│   ├── components/
│   │   ├── auth/AuthModal.tsx                  # Google & Email/Password sign-in
│   │   ├── dashboard/DashboardView.tsx         # Welcome banner, metrics & quick access
│   │   ├── layout/Navbar.tsx                   # Search, theme toggle, new actions & user menu
│   │   ├── layout/Sidebar.tsx                  # Navigation links & expandable folder tree
│   │   ├── library/LibraryView.tsx             # Breadcrumbs, grid/list view, drag-and-drop
│   │   ├── modals/
│   │   │   ├── CreateFolderModal.tsx           # Subject & subfolder creation with color picker
│   │   │   ├── UploadModal.tsx                 # Multi-file uploader with progress bars
│   │   │   ├── RenameModal.tsx                 # Folder & file rename
│   │   │   ├── MoveModal.tsx                   # Destination picker for single/bulk moves
│   │   │   └── ConfirmDeleteModal.tsx          # Safe trash & permanent deletion dialog
│   │   ├── settings/SettingsBackupView.tsx     # Quota breakdown, JSON export & restore
│   │   ├── trash/TrashView.tsx                 # Recycle bin & restore management
│   │   └── viewer/
│   │       ├── PdfViewerModal.tsx              # Integrated PDF viewer with zoom & fullscreen
│   │       └── DocPreviewModal.tsx             # Image, text, and office document previews
│   ├── context/
│   │   ├── AuthContext.tsx                     # Auth provider & guest scholar mode
│   │   └── LibraryContext.tsx                  # Real-time Firestore sync & Storage uploads
│   ├── lib/
│   │   └── firebase.ts                         # Firebase SDK init & error handling
│   ├── types/index.ts                          # TypeScript models & schemas
│   └── utils/
│       ├── fileHelpers.ts                      # Byte formatting, breadcrumbs & categories
│       └── fileHelpers.test.ts                 # Unit tests (node:test)
```

---

## 3. Local Setup Instructions

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Verify Firebase Configuration:**
   Ensure `firebase-applet-config.json` contains your Firebase project credentials:
   ```json
   {
     "projectId": "your-project-id",
     "appId": "your-app-id",
     "apiKey": "your-api-key",
     "authDomain": "your-project-id.firebaseapp.com",
     "firestoreDatabaseId": "your-database-id",
     "storageBucket": "your-project-id.firebasestorage.app"
   }
   ```

3. **Start the development server:**
   ```bash
   npm run dev
   ```
   Open `http://localhost:3000` in your web browser.

4. **Run unit tests:**
   ```bash
   npx tsx --test src/utils/fileHelpers.test.ts
   ```

---

## 4. Online Deployment Instructions

### Deploying to Firebase Hosting
1. Install the Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```
2. Login and initialize hosting:
   ```bash
   firebase login
   firebase init hosting
   ```
   - Set public directory to `dist`
   - Configure as single-page app: `Yes`
3. Build and deploy:
   ```bash
   npm run build
   firebase deploy --only hosting,firestore:rules
   ```

### Deploying to Cloud Run / Vercel / Netlify
1. Run `npm run build` to generate production assets in `/dist`.
2. Push your repository to GitHub or Google Cloud Build.
3. Configure environment variables and deploy.
