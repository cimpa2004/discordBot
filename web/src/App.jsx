import { CircularProgress, Stack } from "@mui/material";
import { useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./hooks/useAuth";
import LoginPage from "./pages/LoginPage";
import SoundListPage from "./pages/SoundListPage";
import UploadPage from "./pages/UploadPage";

function ProtectedApp() {
  const [guildId, setGuildId] = useState("0");

  return (
    <Layout guildId={guildId} onGuildChange={setGuildId}>
      <Routes>
        <Route path="/" element={<Navigate to="/sounds" replace />} />
        <Route path="/sounds" element={<SoundListPage guildId={guildId} />} />
        <Route path="/upload" element={<UploadPage guildId={guildId} />} />
        <Route path="*" element={<Navigate to="/sounds" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <Stack sx={{ minHeight: "100vh" }} alignItems="center" justifyContent="center">
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={isAuthenticated ? <Navigate to="/sounds" replace /> : <LoginPage />} />
      <Route path="*" element={isAuthenticated ? <ProtectedApp /> : <Navigate to="/login" replace />} />
    </Routes>
  );
}

export default App;
