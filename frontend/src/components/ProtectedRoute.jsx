import { Navigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = useAuth();
  if (user === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black text-[#9CA3AF]" data-testid="auth-loading">
        Loading…
      </div>
    );
  }
  if (user === false) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/app/chat" replace />;
  return children;
}
