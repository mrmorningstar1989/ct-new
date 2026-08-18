import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import { Toaster } from "sonner";

import ProtectedRoute from "@/components/ProtectedRoute";
import AdminLayout from "@/components/layout/AdminLayout";
import TeacherLayout from "@/components/layout/TeacherLayout";
import StudentLayout from "@/components/layout/StudentLayout";

import Login from "@/pages/Login";
import AdminDashboard from "@/pages/admin/Dashboard";
import Students from "@/pages/admin/Students";
import Teachers from "@/pages/admin/Teachers";
import Modalities from "@/pages/admin/Modalities";
import Classes from "@/pages/admin/Classes";
import Enrollments from "@/pages/admin/Enrollments";
import AttendancePage from "@/pages/admin/Attendance";
import Graduations from "@/pages/admin/Graduations";
import Plans from "@/pages/admin/Plans";
import Financial from "@/pages/admin/Financial";
import Announcements from "@/pages/admin/Announcements";
import Notifications from "@/pages/admin/Notifications";
import CalendarPage from "@/pages/admin/Calendar";
import Settings from "@/pages/admin/Settings";

import TeacherDashboard from "@/pages/teacher/Dashboard";
import TeacherClasses from "@/pages/teacher/Classes";
import TeacherAttendance from "@/pages/teacher/Attendance";

import StudentDashboard from "@/pages/student/Dashboard";
import StudentDigitalId from "@/pages/student/DigitalId";
import StudentFinancial from "@/pages/student/Financial";
import StudentProfile from "@/pages/student/Profile";

function App() {
  return (
    <div className="App">
      <AuthProvider>
        <BrowserRouter>
          <Toaster theme="dark" position="top-right" richColors closeButton />
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute roles={["admin"]}>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="alunos" element={<Students />} />
              <Route path="professores" element={<Teachers />} />
              <Route path="modalidades" element={<Modalities />} />
              <Route path="turmas" element={<Classes />} />
              <Route path="matriculas" element={<Enrollments />} />
              <Route path="presenca" element={<AttendancePage />} />
              <Route path="graduacoes" element={<Graduations />} />
              <Route path="planos" element={<Plans />} />
              <Route path="financeiro" element={<Financial />} />
              <Route path="avisos" element={<Announcements />} />
              <Route path="notificacoes" element={<Notifications />} />
              <Route path="calendario" element={<CalendarPage />} />
              <Route path="configuracoes" element={<Settings />} />
            </Route>

            <Route
              path="/professor"
              element={
                <ProtectedRoute roles={["teacher"]}>
                  <TeacherLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<TeacherDashboard />} />
              <Route path="turmas" element={<TeacherClasses />} />
              <Route path="chamada" element={<TeacherAttendance />} />
            </Route>

            <Route
              path="/aluno"
              element={
                <ProtectedRoute roles={["student"]}>
                  <StudentLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<StudentDashboard />} />
              <Route path="carteirinha" element={<StudentDigitalId />} />
              <Route path="financeiro" element={<StudentFinancial />} />
              <Route path="perfil" element={<StudentProfile />} />
            </Route>

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  );
}

export default App;
