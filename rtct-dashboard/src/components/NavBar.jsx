import { Link, NavLink, useNavigate } from "react-router-dom";
import { isAuthed, currentUser } from "../auth";

export default function NavBar() {
  const nav = useNavigate();
  const user = currentUser();

  return (
    <header style={wrap}>
      <Link to="/" style={brand}>
        <img src="/logo.svg" alt="logo" style={logo} />
        <span style={{ fontWeight: 700, color: "#fff" }}>RTCT</span>
      </Link>

      <nav style={tabs}>
        <Tab to="/k8">K8</Tab>
        <Tab to="/alerts">Alerts</Tab>
      </nav>

      <div style={right}>
        {isAuthed() ? (
          <>
            <button
              onClick={() => nav("/profile")}
              style={avatarBtn}
              title="Profile"
            >
              <Avatar
                email={user?.email}
                username={user?.username}
                photoUrl={user?.photoUrl}
              />
            </button>
          </>
        ) : (
          <>
            <NavLink to="/login" style={btn}>
              Log in
            </NavLink>
            <NavLink to="/signup" style={btnOutline}>
              Sign up
            </NavLink>
          </>
        )}
      </div>
    </header>
  );
}

function Tab({ to, children }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        padding: "8px 12px",
        borderRadius: 8,
        textDecoration: "none",
        color: isActive ? "#111" : "#ffffffff",
        background: isActive ? "#eaeaea" : "transparent",
      })}
    >
      {children}
    </NavLink>
  );
}

function Avatar({ photoUrl, username, email }) {
  if (photoUrl) return <img src={photoUrl} alt="profile" style={avatarImg} />;
  const text = (username || email || "?").slice(0, 1).toUpperCase();
  return <div style={avatarFallback}>{text}</div>;
}

const avatarBtn = {
  border: "none",
  background: "transparent",
  padding: 0,
  cursor: "pointer",
};
const avatarImg = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  objectFit: "cover",
};
const avatarFallback = {
  width: 32,
  height: 32,
  borderRadius: "50%",
  background: "#111",
  color: "#fff",
  display: "grid",
  placeItems: "center",
  fontSize: 14,
  fontWeight: 700,
};

const wrap = {
  height: 64,
  display: "flex",
  alignItems: "center",
  gap: 16,
  padding: "0 16px",
  borderBottom: "1px solid #eee",
  background: "#500000",
  position: "sticky",
  top: 0,
  zIndex: 50,
};
const brand = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  textDecoration: "none",
  color: "#111",
};
const logo = { width: 42, height: 64, objectFit: "cover", borderRadius: 6 };
const tabs = { display: "flex", gap: 8 };
const right = {
  marginLeft: "auto",
  display: "flex",
  gap: 8,
  alignItems: "center",
};
const btn = {
  padding: "8px 12px",
  borderRadius: 8,
  background: "#111",
  color: "#fff",
  textDecoration: "none",
};
const btnOutline = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #ffffffff",
  background: "transparent",
  color: "#ffffffff",
  textDecoration: "none",
};
const profileLink = {
  textDecoration: "none",
  color: "#ffffffff",
  fontWeight: 600,
};
