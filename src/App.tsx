import { Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import EnhancedChatPage from './pages/chat/EnhancedChatPage';
import EnhancedAdminPage from './pages/admin/EnhancedAdminPage';
import AuthPage from './pages/auth/AuthPage';

function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Navigate to="/auth" replace />} />
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/chat" element={<EnhancedChatPage />} />
        <Route path="/admin" element={<EnhancedAdminPage />} />
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}

export default App;
