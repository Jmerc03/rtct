import { Link } from "react-router-dom";
import { logout } from "../auth";

export default function AwaitApproval() {
  return (
    <div style={wrap}>
      <div style={card}>
        <h2 style={{ margin: 0 }}>Awaiting Approval</h2>
        <p style={{ margin: 0, color: "#444", lineHeight: 1.5 }}>
          Your account has been created successfully, but an admin must approve
          it before you can access the dashboard.
        </p>
        <p style={{ margin: 0, color: "#666", lineHeight: 1.5 }}>
          Once your account has been approved, return to the login page and sign
          in again.
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Link to="/login" style={primaryLink}>
            Back to Login
          </Link>
          <button type="button" onClick={logout} style={secondaryButton}>
            Log Out
          </button>
        </div>
      </div>
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
  gap: 14,
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 20,
  width: "min(100%, 480px)",
  background: "#fff",
};

const primaryLink = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "10px 14px",
  borderRadius: 10,
  background: "#111827",
  color: "#fff",
  textDecoration: "none",
  fontWeight: 600,
};

const secondaryButton = {
  padding: "10px 14px",
  borderRadius: 10,
  border: "1px solid #d1d5db",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 600,
};
