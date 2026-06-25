import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Chat from "@/pages/Chat";
import MailPage from "@/pages/Mail";
import Directory from "@/pages/Directory";
import Profile from "@/pages/Profile";
import Admin from "@/pages/Admin";
import { Toaster } from "sonner";

function App() {
  return (
    <LanguageProvider>
      <AuthProvider>
        <BrowserRouter>
          <Toaster
            position="top-center"
            theme="dark"
            toastOptions={{
              style: {
                background: "#0A0A0A",
                border: "1px solid #262626",
                color: "#F3F4F6",
                borderRadius: "2px",
              },
            }}
          />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="chat" replace />} />
              <Route path="chat" element={<Chat />} />
              <Route path="mail" element={<MailPage />} />
              <Route path="directory" element={<Directory />} />
              <Route path="profile" element={<Profile />} />
              <Route
                path="admin"
                element={
                  <ProtectedRoute adminOnly>
                    <Admin />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </LanguageProvider>
  );
}

export default App;
