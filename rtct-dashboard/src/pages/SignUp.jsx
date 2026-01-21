import { useState } from "react";
import { signup, isAuthed } from "../auth";
import { Navigate, useNavigate, Link } from "react-router-dom";

export default function SignUp() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (isAuthed()) return <Navigate to="/alerts" replace />;

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await signup({ email, username, password, photoUrl });
      nav("/alerts");
    } catch (e) {
      setErr(e.message || "Sign up failed");
    }
  };

  return (
    <div style={wrap}>
      <form onSubmit={onSubmit} style={card}>
        <h2>Sign up</h2>
        {err && <p style={{ color: "#b00" }}>{err}</p>}

        <label>Username</label>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="your handle"
          required
        />

        <label>Email</label>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          type="email"
          required
        />

        <label>Password</label>
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          required
        />

        <label>Photo URL (optional)</label>
        <input
          value={photoUrl}
          onChange={(e) => setPhotoUrl(e.target.value)}
          placeholder="https://..."
        />

        <button type="submit">Create account</button>
        <p>
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </form>
    </div>
  );
}

const wrap = {
  display: "grid",
  placeItems: "center",
  minHeight: "70vh",
  padding: 16,
};
const card = {
  display: "grid",
  gap: 8,
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  width: 320,
  background: "#fff",
};
