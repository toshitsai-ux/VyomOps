import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "./firebase";
import LandingPage from "../components/ui/landing-page";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Report from "./pages/Report";
import Monitor from "./pages/Monitor";
import PrivateRoute from "./components/PrivateRoute";

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken();
          localStorage.setItem("vyomops_token", token);
          localStorage.setItem("vyomops_uid", currentUser.uid);
        } catch (err) {
          console.error("Error setting active session telemetry token:", err);
        }
      } else {
        localStorage.removeItem("vyomops_token");
        localStorage.removeItem("vyomops_uid");
      }
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen deep-space-bg text-white font-mono flex items-center justify-center">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-cyber-cyan border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-zinc-400">CONNECTING VYOMOPS CHANNELS...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Routes>
        {/* Sacred Unchanged Landing Route */}
        <Route path="/" element={<LandingPage />} />
        
        {/* Authentication Terminals */}
        <Route path="/login" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/register" element={user ? <Navigate to="/dashboard" /> : <Register />} />
        
        {/* Core Tactical Hub */}
        <Route path="/dashboard" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
        <Route path="/report" element={<Report />} />
        <Route path="/monitor" element={<PrivateRoute><Monitor /></PrivateRoute>} />
        
        {/* Retired routes redirect safely */}
        <Route path="/orbital" element={<Navigate to="/monitor" />} />
        <Route path="/analysis/new" element={<Navigate to="/monitor" />} />
        <Route path="/analysis/:id" element={<Navigate to="/monitor" />} />
        
        {/* Fallback Ingress Route redirects to root */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  );
}
