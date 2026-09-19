import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signOut, GoogleAuthProvider, signInWithPopup, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getFirestore, collection, getDocs, getDoc, doc, query, orderBy, limit, where, addDoc, setDoc, deleteDoc, updateDoc, increment, serverTimestamp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-storage.js";

/* Replace these values with Firebase Console > Project settings > Your apps > Web app. */
const firebaseConfig = {
  apiKey: "YOUR_FIREBASE_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const configured = !Object.values(firebaseConfig).some(v => String(v).startsWith("YOUR_"));
let auth, db, storage, currentUser = null, authMode = "login", selectedFiles = [];
if (configured) {
  const firebaseApp = initializeApp(firebaseConfig);
  auth = getAuth(firebaseApp); db = getFirestore(firebaseApp); storage = getStorage(firebaseApp);
}

const $ = id => document.getElementById(id);
const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
const toast = msg => { $("toast").textContent = msg; $("toast").classList.add("show"); clearTimeout(window.__toast); window.__toast = setTimeout(() => $("toast").classList.remove("show"), 2600); };
const requireAuth = (message = "Please sign in to use this feature.") => { if (currentUser) return true; openAuth(message); return false; };

function openAuth(message = "") { $("authStatus").textContent = message; if (!$('authDialog').open) $('authDialog').showModal(); }
function setAuthMode(mode) {
  authMode = mode;
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("nameField").classList.toggle("hidden", mode !== "register");
  $("authSubmit").textContent = mode === "login" ? "Login" : "Create account";
  $("authHeading").textContent = mode === "login" ? "Your study library awaits." : "Create your study account.";
  $("authSwitchText").textContent = mode === "login" ? "New here? Create an account above." : "Already have an account? Switch to Login above.";
  $("authStatus").textContent = "";
}

async function authenticate(event) {
  event.preventDefault();
  if (!auth) return $("authStatus").textContent = "Connect your Firebase configuration in app.js first.";
  const email = $("authEmail").value.trim(), password = $("authPassword").value;
  $("authStatus").textContent = "Working…";
  try {
    if (authMode === "login") {
      await signInWithEmailAndPassword(auth, email, password);
      toast("Welcome back!");
    } else {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      const name = $("authName").value.trim() || "Student";
      await updateProfile(cred.user, { displayName: name });
      await setDoc(doc(db, "profiles", cred.user.uid), { username: name, email, createdAt: serverTimestamp() }, { merge: true });
      toast("Account created successfully!");
    }
    $("authDialog").close();
  } catch (error) {
    $("authStatus").textContent = friendlyAuthError(error);
  }
}
function friendlyAuthError(error) {
  const map = { "auth/invalid-credential":"Email or password is incorrect.", "auth/email-already-in-use":"An account already exists with this email.", "auth/weak-password":"Use a password with at least 6 characters.", "auth/invalid-email":"Please enter a valid email address.", "auth/popup-closed-by-user":"Google sign-in was cancelled." };
  return map[error.code] || error.message.replace(/^Firebase:\s*/i, "");
}

async function googleLogin() {
  if (!auth) return $("authStatus").textContent = "Connect your Firebase configuration first.";
  try { await signInWithPopup(auth, new GoogleAuthProvider()); $("authDialog").close(); toast("Signed in with Google!"); }
  catch (e) { $("authStatus").textContent = friendlyAuthError(e); }
}

async function resetPassword() {
  if (!auth) return;
  const email = $("authEmail").value.trim();
  if (!email) return $("authStatus").textContent = "Enter your email first.";
  try { await sendPasswordResetEmail(auth, email); $("authStatus").textContent = "Password reset email sent. Check your inbox."; }
  catch (e) { $("authStatus").textContent = friendlyAuthError(e); }
}

function noteSearchMatch(note, term, grade, subject, chapter, topic) {
  const hay = [note.title, note.subject, note.chapter, note.topic, note.description, ...(note.tags || [])].join(" ").toLowerCase();
  return (!term || hay.includes(term)) && (!grade || String(note.grade).toLowerCase() === grade) && (!subject || String(note.subject || "").toLowerCase().includes(subject)) && (!chapter || String(note.chapter || "").toLowerCase().includes(chapter)) && (!topic || String(note.topic || "").toLowerCase().includes(topic));
}

async function fetchNotes() {
  if (!db) return [];
  const snap = await getDocs(query(collection(db, "notes"), orderBy("createdAt", "desc"), limit(100)));
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function noteCard(note, mine = false) {
  const first = note.files?.[0];
  const image = first?.type?.startsWith("image/") ? `<img class="note-thumb" src="${esc(first.url)}" alt="${esc(note.title)}" loading="lazy">` : `<div class="pdf-thumb">PDF</div>`;
  return `<article class="note"><div class="note-media">${image}</div><div><h3>${esc(note.title)}</h3><div class="meta">${esc(note.grade)} · ${esc(note.subject)} · ${esc(note.chapter)}</div><p>${esc(note.description || "No description provided.")}</p><div>${(note.tags || []).slice(0,5).map(t=>`<span class="tag">${esc(t)}</span>`).join("")}</div><div class="meta">👁 ${note.views||0} · ❤️ ${note.likes||0} · ⬇ ${note.downloads||0}</div></div><div class="note-actions"><button class="btn" data-view="${note.id}">View</button><button class="btn" data-like="${note.id}">♥ Like</button><button class="btn" data-book="${note.id}">🔖 Save</button>${mine?`<button class="btn danger" data-delete="${note.id}">Delete</button>`:""}</div></article>`;
}
function renderNotes(notes, target, mine = false) {
  $(target).innerHTML = notes.length ? notes.map(n => noteCard(n,mine)).join("") : `<div class="empty-state"><strong>No notes found</strong><span>Try another search or upload the first note.</span></div>`;
  document.querySelectorAll(`#${target} [data-view]`).forEach(b => b.onclick = () => viewNote(b.dataset.view));
  document.querySelectorAll(`#${target} [data-like]`).forEach(b => b.onclick = () => likeNote(b.dataset.like));
  document.querySelectorAll(`#${target} [data-book]`).forEach(b => b.onclick = () => toggleBookmark(b.dataset.book));
  document.querySelectorAll(`#${target} [data-delete]`).forEach(b => b.onclick = () => deleteNote(b.dataset.delete));
}

async function loadNotes() {
  try {
    const notes = await fetchNotes();
    const term = $("searchInput").value.trim().toLowerCase();
    const grade = $("gradeFilter").value.trim().toLowerCase();
    const subject = $("subjectFilter").value.trim().toLowerCase();
    const chapter = $("chapterFilter").value.trim().toLowerCase();
    const topic = $("topicFilter").value.trim().toLowerCase();
    const filtered = notes.filter(n => noteSearchMatch(n,term,grade,subject,chapter,topic));
    renderNotes(filtered,"notesGrid"); $("resultCount").textContent = `${filtered.length} note${filtered.length===1?"":"s"} shown`;
    $("heroCount").textContent = notes.length;
  } catch(e) { console.error(e); $("notesGrid").innerHTML = `<div class="empty-state"><strong>Could not load notes</strong><span>Check your Firebase Firestore configuration and security rules.</span></div>`; }
}

async function viewNote(id) {
  if (!db) return;
  const snap = await getDoc(doc(db,"notes",id)); if (!snap.exists()) return toast("This note no longer exists.");
  const note = {id:snap.id,...snap.data()};
  await updateDoc(doc(db,"notes",id), { views: increment(1) });
  const files = note.files || [];
  $("viewerBody").innerHTML = `<div class="viewer-title"><span class="eyebrow">${esc(note.subject)}</span><h2>${esc(note.title)}</h2><p class="meta">${esc(note.grade)} · ${esc(note.chapter)} · ${esc(note.uploaderName || "Student")}</p><p>${esc(note.description || "")}</p></div><div class="viewer-toolbar"><button id="zoomOut">−</button><button id="zoomReset">100%</button><button id="zoomIn">+</button><button id="fitWidth">Fit width</button><button id="fullscreenViewer">Fullscreen</button><button id="downloadAll">Download</button></div><div class="viewer-canvas" id="viewerCanvas"></div><p class="viewer-caption">${files.length} file${files.length===1?"":"s"} · ${note.views+1||1} views</p>`;
  const canvas = $("viewerCanvas"); let scale = 1;
  files.forEach((f,i) => {
    const wrap = document.createElement("div"); wrap.className="viewer-file";
    if (f.type === "application/pdf") wrap.innerHTML = `<iframe src="${f.url}" title="${esc(f.name)}"></iframe>`;
    else wrap.innerHTML = `<img src="${esc(f.url)}" alt="${esc(f.name)}" loading="lazy">`;
    canvas.appendChild(wrap);
  });
  const apply = () => { canvas.querySelectorAll("img").forEach(img => img.style.width = `${Math.max(25,scale*100)}%`); $("zoomReset").textContent = `${Math.round(scale*100)}%`; };
  $("zoomIn").onclick=()=>{scale=Math.min(4,scale+.25);apply()}; $("zoomOut").onclick=()=>{scale=Math.max(.25,scale-.25);apply()}; $("zoomReset").onclick=()=>{scale=1;apply()}; $("fitWidth").onclick=()=>{scale=1;canvas.querySelectorAll("img").forEach(img=>img.style.width="100%");$("zoomReset").textContent="Fit"};
  $("fullscreenViewer").onclick=()=>canvas.requestFullscreen?.(); $("downloadAll").onclick=async()=>{if(!requireAuth("Sign in to download notes."))return; await Promise.all(files.map(f=>{const a=document.createElement("a");a.href=f.url;a.download=f.name||"note";a.target="_blank";a.click()})); await updateDoc(doc(db,"notes",id),{downloads:increment(files.length)});toast("Download started.")};
  canvas.onwheel = e => { if(!e.ctrlKey) return; e.preventDefault(); scale += e.deltaY < 0 ? .15 : -.15; scale=Math.max(.25,Math.min(4,scale)); apply(); };
  $("viewerDialog").showModal();
}

async function likeNote(id) {
  if (!requireAuth("Sign in to like notes.")) return;
  const key = `${currentUser.uid}_${id}`, likeRef=doc(db,"note_likes",key), existing=await getDoc(likeRef);
  if (existing.exists()) return toast("You already liked this note.");
  await setDoc(likeRef,{userId:currentUser.uid,noteId:id,createdAt:serverTimestamp()}); await updateDoc(doc(db,"notes",id),{likes:increment(1)}); toast("Liked!"); loadNotes();
}
async function toggleBookmark(id) {
  if (!requireAuth("Sign in to save bookmarks.")) return;
  const key=`${currentUser.uid}_${id}`, r=doc(db,"bookmarks",key), existing=await getDoc(r);
  if(existing.exists()){await deleteDoc(r);toast("Bookmark removed.")}else{await setDoc(r,{userId:currentUser.uid,noteId:id,createdAt:serverTimestamp()});toast("Saved to bookmarks.")}
  loadBookmarks();
}
async function loadBookmarks() {
  if(!currentUser||!db) { $("bookmarkGrid").innerHTML='<div class="empty-state"><strong>Sign in to see your bookmarks</strong><span>Your public browsing does not require an account.</span></div>'; return; }
  try{const snap=await getDocs(query(collection(db,"bookmarks"),where("userId","==",currentUser.uid)));const notes=[];for(const b of snap.docs){const n=await getDoc(doc(db,"notes",b.data().noteId));if(n.exists())notes.push({id:n.id,...n.data()})}renderNotes(notes,"bookmarkGrid")}catch(e){console.error(e)}
}
async function loadMyNotes() {
  if(!currentUser||!db){$("myNotesGrid").innerHTML='<div class="empty-state"><strong>Sign in to manage uploads</strong><span>Your own uploads will appear here.</span></div>';return;}
  try{const snap=await getDocs(query(collection(db,"notes"),where("userId","==",currentUser.uid),orderBy("createdAt","desc")));renderNotes(snap.docs.map(d=>({id:d.id,...d.data()})),"myNotesGrid",true)}catch(e){console.error(e);$("myNotesGrid").innerHTML='<div class="empty-state"><strong>Could not load your uploads</strong><span>If Firestore asks for an index, use the link shown in the browser console.</span></div>'}
}
async function deleteNote(id) {
  if(!requireAuth("Sign in to manage your uploads."))return;
  if(!confirm("Delete this note and all of its stored files? This cannot be undone."))return;
  const snap=await getDoc(doc(db,"notes",id)); if(!snap.exists())return toast("Note already deleted."); const note=snap.data();
  if(note.userId!==currentUser.uid)return toast("You can only delete your own uploads.");
  try{for(const f of note.files||[]){if(f.path)try{await deleteObject(ref(storage,f.path))}catch(err){console.warn("File cleanup failed",err)}}await deleteDoc(doc(db,"notes",id));toast("Note deleted.");loadNotes();loadMyNotes();}catch(e){console.error(e);toast("Could not delete this note.")}
}

async function compressImage(file) {
  const bitmap = await createImageBitmap(file);
  const max = 1800; const ratio = Math.min(1,max/Math.max(bitmap.width,bitmap.height));
  const canvas=document.createElement("canvas"); canvas.width=Math.max(1,Math.round(bitmap.width*ratio)); canvas.height=Math.max(1,Math.round(bitmap.height*ratio));
  const ctx=canvas.getContext("2d"); ctx.fillStyle="#fff"; ctx.fillRect(0,0,canvas.width,canvas.height); ctx.drawImage(bitmap,0,0,canvas.width,canvas.height); bitmap.close();
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,"image/jpeg",.72));
  return new File([blob],file.name.replace(/\.(png|jpe?g|webp)$/i,".jpg"),{type:"image/jpeg",lastModified:Date.now()});
}
async function uploadFiles() {
  if(!requireAuth("Sign in to publish notes."))return;
  const files=selectedFiles;if(!files.length)return $("uploadStatus").textContent="Choose at least one PDF or image.";
  const grade=$("uploadGrade").value, subject=$("uploadSubject").value.trim(), chapter=$("uploadChapter").value.trim(); if(!grade||!subject||!chapter)return $("uploadStatus").textContent="Grade, subject and chapter are required.";
  $("publishBtn").disabled=true; $("progressWrap").style.display="flex"; $("uploadStatus").textContent="Preparing files…";
  try{
    const noteId=crypto.randomUUID(), processed=[];
    for(let i=0;i<files.length;i++){
      let f=files[i]; if(f.size>20*1024*1024)throw new Error(`${f.name} is larger than 20 MB.`); if(!["application/pdf","image/png","image/jpeg","image/webp"].includes(f.type))throw new Error("Only PDF, PNG, JPEG and WebP files are allowed.");
      if(f.type.startsWith("image/")){f=await compressImage(f);}
      const safe=f.name.replace(/[^a-zA-Z0-9._-]/g,"_"); const storagePath=`notes/${currentUser.uid}/${noteId}/${Date.now()}-${safe}`; const r=ref(storage,storagePath); const task=uploadBytesResumable(r,f,{contentType:f.type,customMetadata:{owner:currentUser.uid,noteId}});
      await new Promise((resolve,reject)=>{task.on("state_changed",s=>{const pct=((i+s.bytesTransferred/s.totalBytes)/files.length)*100;$("progressBar").style.width=`${pct}%`;$("progressText").textContent=`${Math.round(pct)}%`},reject,resolve)});
      processed.push({url:await getDownloadURL(r),type:f.type,name:f.name,path:storagePath,size:f.size});
    }
    await setDoc(doc(db,"notes",noteId),{title:$("uploadTopic").value.trim()||`${subject} — ${chapter}`,grade,subject,chapter,topic:$("uploadTopic").value.trim(),description:$("uploadDescription").value.trim(),tags:$("uploadTags").value.split(",").map(x=>x.trim()).filter(Boolean).slice(0,20),files:processed,fileType:processed.length===1?processed[0].type:"mixed",userId:currentUser.uid,uploaderName:currentUser.displayName||currentUser.email?.split("@")[0]||"Student",views:0,likes:0,downloads:0,createdAt:serverTimestamp()});
    $("uploadForm").reset();selectedFiles=[];renderSelectedFiles();$("uploadStatus").textContent="Published successfully!";toast("Your notes are now live.");loadNotes();loadMyNotes();location.hash="#my-notes";
  }catch(e){console.error(e);$("uploadStatus").textContent=e.message||"Upload failed."}finally{$("publishBtn").disabled=false;setTimeout(()=>{$("progressWrap").style.display="none"},800)}
}
function renderSelectedFiles(){
  $("selectedFiles").textContent=selectedFiles.length?`${selectedFiles.length} file${selectedFiles.length===1?"":"s"} selected.`:"No files selected.";
  $("uploadPreview").innerHTML=selectedFiles.map((f,i)=>f.type.startsWith("image/")?`<div class="preview-card"><img src="${URL.createObjectURL(f)}" alt=""><span>${esc(f.name)}</span></div>`:`<div class="preview-card"><div class="pdf-thumb">PDF</div><span>${esc(f.name)}</span></div>`).join("");
}
function chooseService(element){element.preventDefault();const service=element.currentTarget.dataset.service;if(!requireAuth(`Sign in to ${service.replace("-"," ")} .`))return;location.hash=`#${service}`;}

$("authBtn").onclick=()=>currentUser?signOut(auth):openAuth();$("closeAuth").onclick=()=>$("authDialog").close();$("loginTab").onclick=()=>setAuthMode("login");$("registerTab").onclick=()=>setAuthMode("register");$("authForm").onsubmit=authenticate;$("googleBtn").onclick=googleLogin;$("forgotBtn").onclick=resetPassword;
$("uploadForm").addEventListener("submit",e=>{e.preventDefault();uploadFiles()});$("chooseFiles").onclick=()=>$("uploadFiles").click();$("uploadFiles").onchange=e=>{selectedFiles=[...e.target.files];renderSelectedFiles()};$("dropzone").ondragover=e=>{e.preventDefault();$("dropzone").classList.add("drag")};$("dropzone").ondragleave=()=>$("dropzone").classList.remove("drag");$("dropzone").ondrop=e=>{e.preventDefault();$("dropzone").classList.remove("drag");selectedFiles=[...e.dataTransfer.files].filter(f=>f.type.startsWith("image/")||f.type==="application/pdf");renderSelectedFiles()};
$("closeViewer").onclick=()=>$("viewerDialog").close();$("refreshBtn").onclick=loadNotes;["searchInput","gradeFilter","subjectFilter","chapterFilter","topicFilter"].forEach(id=>$(id).addEventListener("input",loadNotes));$("clearFilters").onclick=()=>{["searchInput","subjectFilter","chapterFilter","topicFilter"].forEach(id=>$(id).value="");$("gradeFilter").value="";loadNotes()};$("themeBtn").onclick=()=>{document.body.classList.toggle("dark");localStorage.nshTheme=document.body.classList.contains("dark")?"dark":"light"};if(localStorage.nshTheme==="dark")document.body.classList.add("dark");$("mobileMenu").onclick=()=>$("mainNav").classList.toggle("open");document.querySelectorAll("[data-service]").forEach(el=>el.addEventListener("click",chooseService));

if(auth)onAuthStateChanged(auth,user=>{currentUser=user;$("authBtn").textContent=user?`Logout (${user.displayName||user.email.split("@")[0]})`:"Login / Sign up";loadBookmarks();loadMyNotes()});else{toast("Add your Firebase web config to connect the app.");loadBookmarks();loadMyNotes()}
loadNotes();
