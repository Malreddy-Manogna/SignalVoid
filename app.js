// Firebase SDKs
import { MAPS_API_KEY } from "./config.js";

const mapScript = document.createElement("script");
mapScript.src = `https://maps.googleapis.com/maps/api/js?key=${MAPS_API_KEY}`;
document.head.appendChild(mapScript);
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  getDocs,
  Timestamp,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyA7GAt_iABDIG0ljjZgqmO4EYuPY5r5qIw",
  authDomain: "signalvoid-1580d.firebaseapp.com",
  projectId: "signalvoid-1580d",
  storageBucket: "signalvoid-1580d.appspot.com",
  messagingSenderId: "821196704722",
  appId: "1:821196704722:web:b2be83702d68f5684a560b"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let map, marker;
let currentGridId = null;

// 🔐 Anonymous login
signInAnonymously(auth).then(initLocation);

// 📍 Live location
function initLocation() {
  navigator.geolocation.watchPosition(pos => {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;

    currentGridId = gridFromLocation(lat, lng);

    if (!map) initMap(lat, lng);
    updateMarker(lat, lng);

    sendHeartbeat();
    detectSilence();
  });
}

// 🗺️ Initialize dark map
function initMap(lat, lng) {
  map = new google.maps.Map(document.getElementById("map"), {
    center: { lat, lng },
    zoom: 16,
    styles: darkMapStyle,
    disableDefaultUI: true
  });

  marker = new google.maps.Marker({
    map,
    position: { lat, lng },
    icon: {
      path: google.maps.SymbolPath.CIRCLE,
      scale: 9,
      fillColor: "#4285F4",
      fillOpacity: 1,
      strokeWeight: 2,
      strokeColor: "#ffffff"
    }
  });
}

// 🔵 Move marker
function updateMarker(lat, lng) {
  marker.setPosition({ lat, lng });
  map.setCenter({ lat, lng });
}

// 🧮 Grid logic
function gridFromLocation(lat, lng) {
  return `grid_${Math.floor(lat * 10)}_${Math.floor(lng * 10)}`;
}

// 💓 Heartbeat
async function sendHeartbeat() {
  await addDoc(collection(db, "heartbeats"), {
    gridId: currentGridId,
    timestamp: serverTimestamp()
  });
}

// 🧠 Silence detection
async function detectSilence() {
  const now = Timestamp.now();
  const fiveMinAgo = Timestamp.fromMillis(now.toMillis() - 2 * 60 * 1000);
  const tenMinAgo = Timestamp.fromMillis(now.toMillis() - 10 * 60 * 1000);

  // 1️⃣ Current grid query
  const q = query(
    collection(db, "heartbeats"),
    where("gridId", "==", currentGridId),
    where("timestamp", ">=", tenMinAgo)
  );

  const snap = await getDocs(q);

  let baseline = 0;
  let recent = 0;

  snap.forEach(doc => {
    baseline++;
    if (doc.data().timestamp.toMillis() >= fiveMinAgo.toMillis()) {
      recent++;
    }
  });

  // 2️⃣ Decide status
  let status = "baseline";
  let statusText = "Collecting baseline data";
  let explanation = "Gathering enough activity data to assess this area.";

  if (baseline >= 3) {
    if (recent === 0) {
      status = "silent";
      statusText = "🔴 Silent";
      explanation =
        "No recent activity detected here. Consider avoiding or staying alert.";
    } else if (recent / baseline < 0.6) {
      status = "reduced";
      statusText = "🟡 Reduced";
      explanation =
        "Activity has dropped compared to recent patterns. Stay cautious.";
    } else {
      status = "normal";
      statusText = "🟢 Normal";
      explanation =
        "Activity levels are consistent with recent patterns.";
    }
  }

  // 3️⃣ Confidence
  let confidence = "Low";
  if (baseline >= 5) confidence = "High";
  else if (baseline >= 3) confidence = "Medium";

  // 4️⃣ Update UI
  const bar = document.getElementById("statusBar");
  bar.className = status;
  bar.innerText = `Grid ${currentGridId} — ${statusText}`;

  document.getElementById("explanation").innerText = explanation;
  document.getElementById("metaInfo").innerText =
    `Last updated: ${new Date().toLocaleTimeString()} | Confidence: ${confidence}`;

  // 5️⃣ Nearby grids (simple logic)
  loadNearbyGrids(currentGridId);
}
async function loadNearbyGrids(gridId) {
  const parts = gridId.split("_");
  const baseLat = parseInt(parts[1]);
  const baseLng = parseInt(parts[2]);

  const nearby = [
    `grid_${baseLat}_${baseLng + 1}`,
    `grid_${baseLat + 1}_${baseLng}`,
    `grid_${baseLat}_${baseLng - 1}`
  ];

  const list = document.getElementById("nearbyList");
  list.innerHTML = "";

  for (let g of nearby) {
    const q = query(
      collection(db, "heartbeats"),
      where("gridId", "==", g)
    );

    const snap = await getDocs(q);

    let label = "⚪ No data";
    if (!snap.empty) label = "🟢 Active";

    const li = document.createElement("li");
    li.innerText = `${g} → ${label}`;
    list.appendChild(li);
  }
}


// 🎨 Update UI status
function updateStatus(baseline, recent) {
  const bar = document.getElementById("statusBar");

  if (baseline < 3) {
    bar.className = "baseline";
    bar.innerText = `Grid ${currentGridId} — Collecting baseline`;
  } else if (recent === 0) {
    bar.className = "silent";
    bar.innerText = `Grid ${currentGridId} — 🔴 Silent`;
  } else if (recent / baseline < 0.6) {
    bar.className = "reduced";
    bar.innerText = `Grid ${currentGridId} — 🟡 Reduced`;
  } else {
    bar.className = "normal";
    bar.innerText = `Grid ${currentGridId} — 🟢 Normal`;
  }
}

// 🌙 Dark map style
const darkMapStyle = [
  { elementType: "geometry", stylers: [{ color: "#0f1115" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#0f1115" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road", elementType: "geometry", stylers: [{ color: "#1c1f26" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#05080f" }] }
];
