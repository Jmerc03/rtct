import { useState } from "react";
import { login, isAuthed, currentUser } from "../auth";
import { Navigate, useNavigate, Link } from "react-router-dom";

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  if (isAuthed()) {
    const user = currentUser();
    return (
      <Navigate
        to={user?.is_approved ? "/alerts" : "/awaiting-approval"}
        replace
      />
    );
  }

  const onSubmit = async (e) => {
    e.preventDefault();
    try {
      await login({ email, password });
      nav("/alerts");
    } catch (e) {
      const msg = e.message || "Login failed";

      if (msg.toLowerCase().includes("approval")) {
        nav("/awaiting-approval");
      } else {
        setErr(msg);
      }
    }
  };

  return (
    <div style={wrap}>
      <form onSubmit={onSubmit} style={card}>
        <h2>Log in</h2>
        {err && <p style={{ color: "#b00" }}>{err}</p>}

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

        <button type="submit">Log in</button>

        <p>
          No account? <Link to="/signup">Sign up</Link>
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
