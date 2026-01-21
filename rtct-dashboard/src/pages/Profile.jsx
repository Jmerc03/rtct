import {
  currentUser,
  isAuthed,
  logout,
  token,
  updateProfileLocal,
} from "../auth";
import { Navigate, useNavigate } from "react-router-dom";
import { useState } from "react";

const API =
  import.meta.env?.VITE_API_URL?.trim?.() ||
  `${window.location.origin.replace(/\/+$/, "")}/api`;

async function saveServer(patch) {
  const res = await fetch(`${API}/users/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token()}`,
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to save profile");
  return res.json();
}

function Avatar({ photoUrl, username, email, size = 64 }) {
  const base = {
    width: size,
    height: size,
    borderRadius: "50%",
    objectFit: "cover",
  };
  if (photoUrl) return <img src={photoUrl} alt="profile" style={base} />;
  const text = (username || email || "?").slice(0, 1).toUpperCase();
  return (
    <div
      style={{
        ...base,
        display: "grid",
        placeItems: "center",
        background: "#111",
        color: "#fff",
        fontWeight: 700,
      }}
    >
      {text}
    </div>
  );
}

export default function Profile() {
  if (!isAuthed()) return <Navigate to="/login" replace />;

  const user = currentUser();
  const [username, setUsername] = useState(user.username || "");
  const [photoUrl, setPhotoUrl] = useState(user.photoUrl || "");
  const [saved, setSaved] = useState("");

  const nav = useNavigate();
  const onLogout = () => {
    logout();
    nav("/login");
  };

  const onSave = async (e) => {
    e.preventDefault();
    try {
      const updated = await saveServer({ username, photoUrl });
      updateProfileLocal({
        username: updated.username,
        photoUrl: updated.photo_url,
      });
      setSaved("Saved!");
      setTimeout(() => setSaved(""), 1200);
    } catch (err) {
      alert(err.message || "Failed to save profile");
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Profile</h2>

      <div
        style={{
          border: "1px solid #eee",
          borderRadius: 12,
          padding: 16,
          maxWidth: 520,
          background: "#fff",
          display: "grid",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Avatar photoUrl={photoUrl} username={username} email={user.email} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 18 }}>
              {username || "Unnamed"}
            </div>
            <div style={{ color: "#555" }}>{user?.email}</div>
          </div>
        </div>

        <form onSubmit={onSave} style={{ display: "grid", gap: 8 }}>
          <label>Username</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="your handle"
          />

          <label>Photo URL</label>
          <input
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            placeholder="https://..."
          />

          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button type="submit">Save</button>
            {saved && <span style={{ color: "#0a0" }}>{saved}</span>}
          </div>
        </form>

        <div>
          <p>
            <b>Role:</b> Operator
          </p>
          <button
            onClick={onLogout}
            style={{
              background: "#c00",
              color: "#fff",
              border: "none",
              padding: "8px 12px",
              borderRadius: 8,
              marginTop: 12,
              cursor: "pointer",
            }}
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
