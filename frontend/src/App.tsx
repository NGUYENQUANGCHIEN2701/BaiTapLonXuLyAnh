import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { PageLoader } from "./components/ui";
import { useAuth } from "./lib/auth";
import Dashboard from "./pages/Dashboard";
import ExamLayout from "./pages/exam/ExamLayout";
import Grade from "./pages/exam/Grade";
import Keys from "./pages/exam/Keys";
import Overview from "./pages/exam/Overview";
import Results from "./pages/exam/Results";
import Sheets from "./pages/exam/Sheets";
import Stats from "./pages/exam/Stats";
import Students from "./pages/exam/Students";
import Exams from "./pages/Exams";
import Lab from "./pages/Lab";
import Login from "./pages/Login";
import Review from "./pages/Review";
import Users from "./pages/Users";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const loc = useLocation();
  if (user === undefined) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="exams" element={<Exams />} />
        <Route path="exams/:examId" element={<ExamLayout />}>
          <Route index element={<Overview />} />
          <Route path="keys" element={<Keys />} />
          <Route path="students" element={<Students />} />
          <Route path="sheets" element={<Sheets />} />
          <Route path="grade" element={<Grade />} />
          <Route path="results" element={<Results />} />
          <Route path="stats" element={<Stats />} />
        </Route>
        <Route path="submissions/:subId" element={<Review />} />
        <Route path="lab" element={<Lab />} />
        <Route path="users" element={<Users />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
