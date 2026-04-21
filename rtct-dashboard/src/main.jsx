import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import NavBar from "./components/NavBar";
import Alerts from "./pages/Alerts";
import K8 from "./pages/K8";
import AdminUsers from "./pages/Admin";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import AwaitApproval from "./pages/Await";
import Profile from "./pages/Profile";
import { isAuthed, me, currentUser } from "./auth";
import { useEffect } from "react";

function Protected({ children }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;

  const user = currentUser();
  if (!user?.is_approved) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  return children;
}

function AdminProtected({ children }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;

  const user = currentUser();
  if (!user?.is_approved) {
    return <Navigate to="/awaiting-approval" replace />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/alerts" replace />;
  }

  return children;
}

function Layout() {
  useEffect(() => {
    if (isAuthed()) {
      me().catch((err) => {
        const msg = err?.message || "";
        if (msg.toLowerCase().includes("approval")) {
          window.location.href = "/awaiting-approval";
          return;
        }
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      });
    }
  }, []);
  return (
    <>
      <NavBar />
      <main style={{ paddingTop: 8 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/alerts" replace />} />
          <Route
            path="/alerts"
            element={
              <Protected>
                <Alerts />
              </Protected>
            }
          />
          <Route
            path="/k8"
            element={
              <Protected>
                <K8 />
              </Protected>
            }
          />
          <Route
            path="/admin/users"
            element={
              <AdminProtected>
                <AdminUsers />
              </AdminProtected>
            }
          />
          <Route
            path="/profile"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
          <Route path="/awaiting-approval" element={<AwaitApproval />} />
          <Route
            path="*"
            element={
              <div style={{ padding: 16 }}>
                <h2>Not Found</h2>
              </div>
            }
          />
        </Routes>
      </main>
    </>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Layout />
  </BrowserRouter>,
);
