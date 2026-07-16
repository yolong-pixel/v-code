import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

const MAX_FILE_BYTES = 700 * 1024;
const LOCAL_KEY_PREFIX = "sharedboard:";

const nicknameInput = document.getElementById("nicknameInput");
const roomCodeInput = document.getElementById("roomCodeInput");
const joinRoomBtn = document.getElementById("joinRoomBtn");
const connectionStatus = document.getElementById("connectionStatus");
const postForm = document.getElementById("postForm");
const linkFields = document.getElementById("linkFields");
const fileFields = document.getElementById("fileFields");
const linkUrlInput = document.getElementById("linkUrlInput");
const fileInput = document.getElementById("fileInput");
const captionInput = document.getElementById("captionInput");
const board = document.getElementById("board");
const boardEmpty = document.getElementById("boardEmpty");

let currentRoom = localStorage.getItem("sharedboard:lastRoom") || "";
let unsubscribe = null;
let firestoreApi = null; // { db, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp }

nicknameInput.value = localStorage.getItem("sharedboard:nickname") || "";
roomCodeInput.value = currentRoom;

nicknameInput.addEventListener("change", () => {
  localStorage.setItem("sharedboard:nickname", nicknameInput.value.trim());
});

document.querySelectorAll('input[name="postType"]').forEach((radio) => {
  radio.addEventListener("change", (e) => {
    const isFile = e.target.value === "file";
    fileFields.hidden = !isFile;
    linkFields.hidden = isFile;
  });
});

async function initFirebase() {
  const { initializeApp } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js"
  );
  const {
    getFirestore,
    collection,
    addDoc,
    onSnapshot,
    query,
    orderBy,
    deleteDoc,
    doc,
    serverTimestamp,
  } = await import(
    "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js"
  );
  const app = initializeApp(firebaseConfig);
  const db = getFirestore(app);
  firestoreApi = { db, collection, addDoc, onSnapshot, query, orderBy, deleteDoc, doc, serverTimestamp };
}

function setStatus(text, cls) {
  connectionStatus.textContent = text;
  connectionStatus.className = "status-badge" + (cls ? " " + cls : "");
}

function localKey(room) {
  return LOCAL_KEY_PREFIX + room;
}

function loadLocalPosts(room) {
  try {
    return JSON.parse(localStorage.getItem(localKey(room)) || "[]");
  } catch {
    return [];
  }
}

function saveLocalPosts(room, posts) {
  localStorage.setItem(localKey(room), JSON.stringify(posts));
}

function joinRoom(room) {
  room = room.trim();
  if (!room) {
    alert("반 코드를 입력해주세요.");
    return;
  }
  currentRoom = room;
  localStorage.setItem("sharedboard:lastRoom", room);

  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }

  if (isFirebaseConfigured) {
    setStatus("연결 중...", "");
    startFirestoreListener(room);
  } else {
    setStatus("로컬 모드 (이 브라우저만)", "local");
    renderPosts(loadLocalPosts(room));
  }
}

async function startFirestoreListener(room) {
  if (!firestoreApi) {
    try {
      await initFirebase();
    } catch (err) {
      console.error(err);
      setStatus("Firebase 연결 실패 - 로컬 모드", "local");
      renderPosts(loadLocalPosts(room));
      return;
    }
  }
  const { db, collection, query, orderBy, onSnapshot } = firestoreApi;
  const postsQuery = query(
    collection(db, "rooms", room, "posts"),
    orderBy("createdAt", "asc")
  );
  unsubscribe = onSnapshot(
    postsQuery,
    (snapshot) => {
      setStatus("실시간 공유 중 (" + room + ")", "ok");
      const posts = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
      renderPosts(posts);
    },
    (err) => {
      console.error(err);
      setStatus("Firebase 오류 - 로컬 모드", "local");
      renderPosts(loadLocalPosts(room));
    }
  );
}

joinRoomBtn.addEventListener("click", () => joinRoom(roomCodeInput.value));
roomCodeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") joinRoom(roomCodeInput.value);
});

function timeAgo(ms) {
  if (!ms) return "";
  const diff = Math.floor((Date.now() - ms) / 1000);
  if (diff < 60) return "방금 전";
  if (diff < 3600) return Math.floor(diff / 60) + "분 전";
  if (diff < 86400) return Math.floor(diff / 3600) + "시간 전";
  return Math.floor(diff / 86400) + "일 전";
}

function getMillis(post) {
  if (typeof post.createdAt === "number") return post.createdAt;
  if (post.createdAt && typeof post.createdAt.toMillis === "function") {
    return post.createdAt.toMillis();
  }
  return 0;
}

function renderPosts(posts) {
  board.innerHTML = "";
  boardEmpty.hidden = posts.length > 0;
  const sorted = [...posts].sort((a, b) => getMillis(a) - getMillis(b));
  for (const post of sorted) {
    board.appendChild(renderCard(post));
  }
}

function renderCard(post) {
  const card = document.createElement("div");
  card.className = "card";

  const header = document.createElement("div");
  header.className = "card-header";
  const author = document.createElement("span");
  author.className = "author";
  author.textContent = post.author || "익명";
  const time = document.createElement("span");
  time.textContent = timeAgo(getMillis(post));
  const delBtn = document.createElement("button");
  delBtn.className = "card-delete";
  delBtn.textContent = "🗑";
  delBtn.title = "삭제";
  delBtn.addEventListener("click", () => deletePost(post.id));
  header.append(author, time, delBtn);
  card.appendChild(header);

  if (post.type === "file") {
    if (post.fileType && post.fileType.startsWith("image/")) {
      const img = document.createElement("img");
      img.className = "card-thumb";
      img.src = post.fileData;
      img.alt = post.fileName || "업로드 이미지";
      card.appendChild(img);
    } else {
      const link = document.createElement("a");
      link.className = "file-chip";
      link.href = post.fileData;
      link.download = post.fileName || "download";
      link.textContent = "📎 " + (post.fileName || "파일 다운로드");
      card.appendChild(link);
    }
  } else if (post.type === "link") {
    const link = document.createElement("a");
    link.className = "link-chip";
    link.href = post.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    let hostname = post.url;
    try {
      hostname = new URL(post.url).hostname;
    } catch {}
    link.textContent = "🔗 " + hostname;
    card.appendChild(link);
  }

  if (post.caption) {
    const caption = document.createElement("div");
    caption.className = "caption";
    caption.textContent = post.caption;
    card.appendChild(caption);
  }

  return card;
}

async function deletePost(id) {
  if (!confirm("이 게시물을 삭제할까요?")) return;
  if (isFirebaseConfigured && firestoreApi) {
    const { db, doc, deleteDoc } = firestoreApi;
    await deleteDoc(doc(db, "rooms", currentRoom, "posts", id));
  } else {
    const posts = loadLocalPosts(currentRoom).filter((p) => p.id !== id);
    saveLocalPosts(currentRoom, posts);
    renderPosts(posts);
  }
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

postForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  if (!currentRoom) {
    alert("먼저 반 코드를 입력하고 입장해주세요.");
    return;
  }

  const author = nicknameInput.value.trim() || "익명";
  const type = document.querySelector('input[name="postType"]:checked').value;
  const caption = captionInput.value.trim();

  let post = { author, type, caption };

  if (type === "link") {
    const url = linkUrlInput.value.trim();
    if (!url) {
      alert("링크를 입력해주세요.");
      return;
    }
    try {
      new URL(url);
    } catch {
      alert("올바른 링크 형식이 아니에요. (예: https://example.com)");
      return;
    }
    post.url = url;
  } else {
    const file = fileInput.files[0];
    if (!file) {
      alert("파일을 선택해주세요.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      alert("파일이 너무 커요 (700KB 이하). 큰 파일은 링크로 공유해주세요.");
      return;
    }
    post.fileName = file.name;
    post.fileType = file.type;
    post.fileData = await readFileAsDataURL(file);
  }

  await submitPost(post);
  postForm.reset();
  linkFields.hidden = false;
  fileFields.hidden = true;
  document.querySelector('input[name="postType"][value="link"]').checked = true;
});

async function submitPost(post) {
  if (isFirebaseConfigured && firestoreApi) {
    const { db, collection, addDoc, serverTimestamp } = firestoreApi;
    await addDoc(collection(db, "rooms", currentRoom, "posts"), {
      ...post,
      createdAt: serverTimestamp(),
    });
  } else {
    const posts = loadLocalPosts(currentRoom);
    posts.push({ ...post, id: crypto.randomUUID(), createdAt: Date.now() });
    saveLocalPosts(currentRoom, posts);
    renderPosts(posts);
  }
}

if (!isFirebaseConfigured) {
  setStatus("로컬 모드 (Firebase 미설정)", "local");
} else {
  setStatus("Firebase 준비됨", "");
}

if (currentRoom) {
  joinRoom(currentRoom);
}
