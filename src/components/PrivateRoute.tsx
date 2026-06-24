import React from "react";
import { Navigate } from "react-router-dom";

export default function PrivateRoute({ children }: { children: React.ReactNode }) {
  const token = localStorage.getItem("vyomops_token");
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
}
