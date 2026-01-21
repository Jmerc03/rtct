import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./index.css";
import NavBar from "./components/NavBar";
import Alerts from "./pages/Alerts";
import K8 from "./pages/K8";
import Login from "./pages/Login";
import SignUp from "./pages/SignUp";
import Profile from "./pages/Profile";
import { isAuthed, me } from "./auth";
import { useEffect } from "react";

function Protected({ children }) {
  if (!isAuthed()) return <Navigate to="/login" replace />;
  return children;
}

function Layout() {
  useEffect(() => {
    if (isAuthed())
      me().catch(() => {
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        window.location.href = "/login";
      });
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
            path="/profile"
            element={
              <Protected>
                <Profile />
              </Protected>
            }
          />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<SignUp />} />
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
  </BrowserRouter>
);
