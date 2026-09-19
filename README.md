# NoteShareHub — Vercel + Firebase Full Stack

NoteShareHub is a responsive student note-sharing website. Vercel hosts the frontend and Firebase provides Authentication, Firestore and Cloud Storage.

## Important design choice

Browsing and searching are public. The login/register modal appears only when a visitor tries to use a protected community service:

- Upload notes
- Like a note
- Bookmark a note
- Download a note
- Open My Notes / Bookmarks
- Manage or delete their own uploads

Images are **not converted into PDFs**. PNG/JPEG/WebP files are resized and compressed in the browser and stored individually. Uploaded PDFs remain PDFs.

## Repository structure

```text
NoteShareHub/
├── index.html
├── styles.css
├── app.js
├── package.json
├── vercel.json
├── firebase.json
├── firebase/
│   ├── firestore.rules
│   └── storage.rules
└── README.md
```

## 1. Create Firebase project

1. Open Firebase Console.
2. Create a project.
3. Add a Web App.
4. Copy the web app configuration.
5. Enable Authentication → Sign-in method → Email/Password.
6. Enable Google if you want Google login.
7. Create Firestore Database.
8. Enable Cloud Storage.

Firebase Authentication supports email/password and federated providers such as Google. Keep access control in Firebase Security Rules. See the official Firebase documentation linked below.

## 2. Add Firebase config

Open `app.js` and replace:

```js
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

with the config from Firebase Console.

Firebase web configuration values are intended to identify the Firebase project; database and storage access must be protected by Security Rules.

## 3. Deploy Firebase rules

Install Firebase CLI if needed, then:

```bash
firebase login
firebase use YOUR_PROJECT_ID
firebase deploy --only firestore:rules,storage
```

Or copy the contents of the two rule files into Firebase Console → Firestore → Rules and Storage → Rules.

## 4. Upload to GitHub

Create a new GitHub repository and upload the **contents of this folder**, not the ZIP itself.

Recommended repository name:

`notesharehub`

Commit message:

`Build NoteShareHub full-stack Vercel Firebase app`

The files must be at repository root. Do not create an extra folder such as:

`notesharehub/NoteShareHub/...`

The root should contain `index.html`, `app.js`, `styles.css`, `firebase.json`, etc.

## 5. Deploy on Vercel

1. Open Vercel.
2. Add New Project.
3. Import the GitHub repository.
4. Framework Preset: **Other**.
5. Build Command: leave empty.
6. Output Directory: leave default / root for this static project.
7. Deploy.

## 6. Firebase authorized domains

After Vercel gives you a URL, add the Vercel domain under Firebase Authentication → Settings → Authorized domains.

For Google sign-in, also enable Google under Authentication → Sign-in method.

## Features included

- Public home page and explore page
- Real Firestore-backed notes
- Search and metadata filters
- Email/password registration and login
- Google sign-in
- Password reset
- Login modal only when a protected service is used
- Image/PDF uploads
- Client-side image resizing/compression
- Multiple files per note
- Direct image viewer with zoom, fit-width and fullscreen
- PDF viewer
- Likes with duplicate prevention
- Bookmarks
- Download tracking
- My Notes page
- Delete your own notes and stored files
- Dark mode
- Mobile navigation
- Drag-and-drop upload
- Upload progress
- Firebase Storage and Firestore security rules

## Storage model

Firestore stores metadata and file descriptors. The actual images/PDFs are stored in Firebase Cloud Storage.

Storage path:

`notes/{userId}/{noteId}/{fileName}`

This avoids placing large binary files directly in Firestore.

## Important production notes

The current search loads the latest 100 notes and filters them in the browser. For a large public platform, move search to a dedicated search service or a carefully indexed Firestore query strategy.

Before public launch, also consider Firebase App Check, stronger abuse/rate limits, moderation/admin tools, reports, pagination, email verification and automated security-rule tests.
