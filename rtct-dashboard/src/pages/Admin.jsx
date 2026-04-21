import { useEffect, useState } from "react";
import {
  approveUser,
  listPendingUsers,
  makeUserAdmin,
  listAllUsers,
  revokeUserApproval,
  demoteUserToUser,
} from "../api";

function formatDate(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
}

function Badge({ children, tone = "default" }) {
  const toneStyles = {
    default: { background: "#f3f4f6", color: "#111827" },
    success: { background: "#dcfce7", color: "#166534" },
    warning: { background: "#fef3c7", color: "#92400e" },
    admin: { background: "#dbeafe", color: "#1d4ed8" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "3px 8px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        ...(toneStyles[tone] || toneStyles.default),
      }}
    >
      {children}
    </span>
  );
}

function UserCard({ user, children }) {
  return (
    <div style={card}>
      <div style={{ display: "grid", gap: 6 }}>
        <div
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <strong>{user.username || "(no username)"}</strong>
          <Badge tone={user.is_approved ? "success" : "warning"}>
            {user.is_approved ? "Approved" : "Pending"}
          </Badge>
          <Badge tone={user.role === "admin" ? "admin" : "default"}>
            {user.role}
          </Badge>
        </div>
        <span>Email: {user.email}</span>
        <span>Created: {formatDate(user.created_at)}</span>
      </div>

      <div
        style={{
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
          justifyContent: "flex-end",
        }}
      >
        {children}
      </div>
    </div>
  );
}

export default function AdminUsers() {
  const [pendingUsers, setPendingUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const [pending, all] = await Promise.all([
        listPendingUsers(),
        listAllUsers(),
      ]);
      setPendingUsers(Array.isArray(pending) ? pending : []);
      setAllUsers(Array.isArray(all) ? all : []);
    } catch (e) {
      setErr(e.message || "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  function replaceUserInAll(updated) {
    setAllUsers((curr) => curr.map((u) => (u.id === updated.id ? updated : u)));
    setPendingUsers((curr) => curr.filter((u) => u.id !== updated.id));
  }

  async function onApprove(id) {
    try {
      setErr("");
      setMsg("");
      const updated = await approveUser(id);
      replaceUserInAll(updated);
      setMsg("User approved.");
    } catch (e) {
      setErr(e.message || "Failed to approve user");
    }
  }

  async function onMakeAdmin(id) {
    try {
      setErr("");
      setMsg("");
      const updated = await makeUserAdmin(id);
      replaceUserInAll(updated);
      setMsg("User promoted to admin.");
    } catch (e) {
      setErr(e.message || "Failed to promote user");
    }
  }

  async function onRevokeApproval(id) {
    try {
      setErr("");
      setMsg("");
      const updated = await revokeUserApproval(id);
      setAllUsers((curr) =>
        curr.map((u) => (u.id === updated.id ? updated : u)),
      );
      setPendingUsers((curr) => {
        if (curr.some((u) => u.id === updated.id)) return curr;
        return [updated, ...curr];
      });
      setMsg("Approval revoked.");
    } catch (e) {
      setErr(e.message || "Failed to revoke approval");
    }
  }

  async function onDemote(id) {
    try {
      setErr("");
      setMsg("");
      const updated = await demoteUserToUser(id);
      setAllUsers((curr) =>
        curr.map((u) => (u.id === updated.id ? updated : u)),
      );
      setMsg("Admin demoted to user.");
    } catch (e) {
      setErr(e.message || "Failed to demote user");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div style={{ display: "grid", gap: 20 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "grid", gap: 4 }}>
          <h2 style={{ margin: 0 }}>User Management</h2>
          <span style={{ color: "#666", fontSize: 14 }}>
            Approve pending users, promote admins, and manage account access.
          </span>
        </div>
        <button onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Reload"}
        </button>
      </div>

      {err && <p style={{ color: "#b00", margin: 0 }}>{err}</p>}
      {msg && <p style={{ color: "#065f46", margin: 0 }}>{msg}</p>}

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 2 }}>
          <h3 style={{ margin: 0 }}>Pending Users</h3>
          <span style={{ color: "#666", fontSize: 14 }}>
            Users waiting for approval or admin promotion.
          </span>
        </div>

        {pendingUsers.length === 0 && !loading ? (
          <div style={emptyCard}>
            <p style={{ margin: 0 }}>No pending users.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {pendingUsers.map((u) => (
              <UserCard key={u.id} user={u}>
                <button onClick={() => onApprove(u.id)}>Approve</button>
                <button onClick={() => onMakeAdmin(u.id)}>Make Admin</button>
              </UserCard>
            ))}
          </div>
        )}
      </section>

      <section style={{ display: "grid", gap: 12 }}>
        <div style={{ display: "grid", gap: 2 }}>
          <h3 style={{ margin: 0 }}>All Users</h3>
          <span style={{ color: "#666", fontSize: 14 }}>
            Review existing users and manage roles or approval status.
          </span>
        </div>

        {allUsers.length === 0 && !loading ? (
          <div style={emptyCard}>
            <p style={{ margin: 0 }}>No users found.</p>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {allUsers.map((u) => (
              <UserCard key={u.id} user={u}>
                {!u.is_approved && (
                  <button onClick={() => onApprove(u.id)}>Approve</button>
                )}
                {u.role !== "admin" && (
                  <button onClick={() => onMakeAdmin(u.id)}>Make Admin</button>
                )}
                {u.role === "admin" && (
                  <button onClick={() => onDemote(u.id)}>Demote to User</button>
                )}
                {u.is_approved && (
                  <button onClick={() => onRevokeApproval(u.id)}>
                    Revoke Approval
                  </button>
                )}
              </UserCard>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

const card = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
};

const emptyCard = {
  border: "1px solid #eee",
  borderRadius: 12,
  padding: 16,
  background: "#fff",
};
