"""End-to-end backend tests for CT Warrior Academy Management System.

Covers auth, RBAC, students, teachers, modalities, classes, plans, enrollments,
invoices, attendance, graduations, announcements and dashboards.
"""
import os
import uuid
from datetime import date

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://warrior-admin.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "brunodorettom@gmail.com"
ADMIN_PASSWORD = "admin123"


# ---------------- Fixtures ----------------
@pytest.fixture(scope="session")
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert data["role"] == "admin"
    return s


@pytest.fixture(scope="session")
def state():
    """Shared state across tests for created ids."""
    return {}


# ---------------- Auth ----------------
class TestAuth:
    def test_no_token_returns_401(self):
        r = requests.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_invalid_token_returns_401(self):
        r = requests.get(f"{API}/auth/me", headers={"Authorization": "Bearer invalid.jwt.here"})
        assert r.status_code == 401

    def test_login_wrong_password(self):
        r = requests.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_login_success_and_me(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        data = r.json()
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert "id" in data


# ---------------- Dashboard ----------------
class TestDashboard:
    def test_admin_dashboard(self, admin_session):
        r = admin_session.get(f"{API}/dashboard/admin")
        assert r.status_code == 200
        d = r.json()
        assert "kpis" in d and "students_by_modality" in d and "revenue_series" in d
        assert "total_students" in d["kpis"]


# ---------------- Modalities ----------------
class TestModalities:
    def test_list_seeded_modalities(self, admin_session, state):
        r = admin_session.get(f"{API}/modalities")
        assert r.status_code == 200
        mods = r.json()
        names = [m["name"] for m in mods]
        assert "Jiu-Jitsu" in names
        assert "Muay Thai" in names
        assert "Boxe" in names
        jj = next(m for m in mods if m["name"] == "Jiu-Jitsu")
        assert isinstance(jj.get("belt_system"), list) and len(jj["belt_system"]) >= 5
        state["modality_id"] = jj["id"]

    def test_create_modality(self, admin_session, state):
        r = admin_session.post(f"{API}/modalities", json={
            "name": "TEST_Karate",
            "description": "Teste",
            "belt_system": [{"order": 0, "name": "Branca", "color": "#FFFFFF"}],
        })
        assert r.status_code == 200
        state["test_modality_id"] = r.json()["id"]

    def test_update_modality_belt_system(self, admin_session, state):
        mid = state["test_modality_id"]
        new_belts = [
            {"order": 0, "name": "Branca", "color": "#FFF"},
            {"order": 1, "name": "Preta", "color": "#000"},
        ]
        r = admin_session.patch(f"{API}/modalities/{mid}", json={"belt_system": new_belts})
        assert r.status_code == 200
        assert len(r.json()["belt_system"]) == 2


# ---------------- Plans ----------------
class TestPlans:
    def test_list_seeded_plans(self, admin_session, state):
        r = admin_session.get(f"{API}/plans")
        assert r.status_code == 200
        plans = r.json()
        assert len(plans) >= 4
        monthly = next((p for p in plans if p["periodicity"] == "monthly"), None)
        assert monthly is not None
        state["plan_id"] = monthly["id"]

    def test_create_plan(self, admin_session):
        r = admin_session.post(f"{API}/plans", json={
            "name": "TEST_Plan", "value": 100.0, "periodicity": "monthly"
        })
        assert r.status_code == 200
        assert r.json()["value"] == 100.0


# ---------------- Students ----------------
class TestStudents:
    def test_create_student_with_login(self, admin_session, state):
        unique = uuid.uuid4().hex[:8]
        payload = {
            "full_name": f"TEST_Aluno {unique}",
            "email": f"aluno_{unique}@teste.com",
            "phone": "11999999999",
            "create_login": True,
            "password": "aluno123",
        }
        r = admin_session.post(f"{API}/students", json=payload)
        assert r.status_code == 200, r.text
        d = r.json()
        assert d["full_name"] == payload["full_name"]
        assert d["matricula"].startswith("CT") and len(d["matricula"]) == 7
        state["student_id"] = d["id"]
        state["student_email"] = payload["email"]
        state["student_password"] = payload["password"]
        state["student_matricula"] = d["matricula"]

    def test_get_student(self, admin_session, state):
        r = admin_session.get(f"{API}/students/{state['student_id']}")
        assert r.status_code == 200
        assert r.json()["id"] == state["student_id"]

    def test_search_students(self, admin_session, state):
        r = admin_session.get(f"{API}/students", params={"q": "TEST_"})
        assert r.status_code == 200
        assert any(s["id"] == state["student_id"] for s in r.json())

    def test_update_student(self, admin_session, state):
        r = admin_session.patch(f"{API}/students/{state['student_id']}", json={"city": "São Paulo"})
        assert r.status_code == 200
        assert r.json()["city"] == "São Paulo"


# ---------------- Teachers ----------------
class TestTeachers:
    def test_create_teacher(self, admin_session, state):
        unique = uuid.uuid4().hex[:8]
        r = admin_session.post(f"{API}/teachers", json={
            "full_name": f"TEST_Prof {unique}",
            "email": f"prof_{unique}@teste.com",
            "create_login": True,
            "password": "prof123",
        })
        assert r.status_code == 200
        state["teacher_id"] = r.json()["id"]

    def test_list_teachers(self, admin_session, state):
        r = admin_session.get(f"{API}/teachers")
        assert r.status_code == 200
        assert any(t["id"] == state["teacher_id"] for t in r.json())

    def test_update_teacher(self, admin_session, state):
        r = admin_session.patch(f"{API}/teachers/{state['teacher_id']}", json={"bio": "Faixa preta"})
        assert r.status_code == 200
        assert r.json()["bio"] == "Faixa preta"


# ---------------- Classes ----------------
class TestClasses:
    def test_create_class(self, admin_session, state):
        r = admin_session.post(f"{API}/classes", json={
            "name": "TEST_Kids Jiu",
            "modality_id": state["modality_id"],
            "teacher_id": state["teacher_id"],
            "weekdays": ["mon", "wed"],
            "start_time": "18:00",
            "end_time": "19:00",
            "capacity": 25,
        })
        assert r.status_code == 200
        state["class_id"] = r.json()["id"]

    def test_list_classes(self, admin_session, state):
        r = admin_session.get(f"{API}/classes")
        assert r.status_code == 200
        assert any(c["id"] == state["class_id"] for c in r.json())

    def test_class_students_empty(self, admin_session, state):
        r = admin_session.get(f"{API}/classes/{state['class_id']}/students")
        assert r.status_code == 200
        assert r.json() == []


# ---------------- Enrollment ----------------
class TestEnrollment:
    def test_create_enrollment_creates_invoice(self, admin_session, state):
        r = admin_session.post(f"{API}/enrollments", json={
            "student_id": state["student_id"],
            "modality_id": state["modality_id"],
            "class_id": state["class_id"],
            "plan_id": state["plan_id"],
        })
        assert r.status_code == 200
        state["enrollment_id"] = r.json()["id"]

        # verify invoice auto-created
        r = admin_session.get(f"{API}/invoices", params={"student_id": state["student_id"]})
        assert r.status_code == 200
        invoices = r.json()
        assert len(invoices) >= 1
        today = date.today()
        comp = f"{today.year:04d}-{today.month:02d}"
        current = [i for i in invoices if i["competency"] == comp]
        assert len(current) >= 1
        state["invoice_id"] = current[0]["id"]

    def test_class_students_after_enroll(self, admin_session, state):
        r = admin_session.get(f"{API}/classes/{state['class_id']}/students")
        assert r.status_code == 200
        assert any(s["id"] == state["student_id"] for s in r.json())


# ---------------- Invoice / Payment ----------------
class TestInvoices:
    def test_pay_invoice(self, admin_session, state):
        r = admin_session.post(f"{API}/invoices/{state['invoice_id']}/pay", json={"payment_method": "pix"})
        assert r.status_code == 200
        assert r.json()["status"] == "paid"

    def test_overdue_list(self, admin_session):
        r = admin_session.get(f"{API}/invoices/overdue/list")
        assert r.status_code == 200
        assert isinstance(r.json(), list)


# ---------------- Attendance ----------------
class TestAttendance:
    def test_register_attendance(self, admin_session, state):
        today_iso = date.today().isoformat()
        r = admin_session.post(f"{API}/attendance", json={
            "class_id": state["class_id"],
            "date": today_iso,
            "records": [{"student_id": state["student_id"], "status": "present"}],
        })
        assert r.status_code == 200
        state["attendance_date"] = today_iso

    def test_get_class_attendance(self, admin_session, state):
        r = admin_session.get(f"{API}/attendance/class/{state['class_id']}/date/{state['attendance_date']}")
        assert r.status_code == 200
        d = r.json()
        assert len(d["records"]) == 1
        assert d["records"][0]["status"] == "present"

    def test_student_attendance_summary(self, admin_session, state):
        r = admin_session.get(f"{API}/attendance/student/{state['student_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d["counts"]["present"] >= 1
        assert d["total"] >= 1


# ---------------- Graduation ----------------
class TestGraduation:
    def test_create_graduation(self, admin_session, state):
        r = admin_session.post(f"{API}/graduations", json={
            "student_id": state["student_id"],
            "modality_id": state["modality_id"],
            "belt_order": 0,
            "belt_name": "Branca",
            "belt_color": "#FFFFFF",
            "graduation_date": date.today().isoformat(),
        })
        assert r.status_code == 200
        state["graduation_id"] = r.json()["id"]

    def test_history(self, admin_session, state):
        r = admin_session.get(f"{API}/graduations/student/{state['student_id']}")
        assert r.status_code == 200
        assert len(r.json()) >= 1

    def test_current_belt(self, admin_session, state):
        r = admin_session.get(f"{API}/graduations/student/{state['student_id']}/current/{state['modality_id']}")
        assert r.status_code == 200
        d = r.json()
        assert d is not None
        assert d["belt_name"] == "Branca"
        assert "days_on_belt" in d


# ---------------- Announcements ----------------
class TestAnnouncements:
    def test_create_and_list_announcement(self, admin_session, state):
        r = admin_session.post(f"{API}/announcements", json={
            "title": "TEST_Aviso", "message": "Testando avisos", "audience": "all",
        })
        assert r.status_code == 200
        state["announcement_id"] = r.json()["id"]

        r2 = admin_session.get(f"{API}/announcements")
        assert r2.status_code == 200
        assert any(a["id"] == state["announcement_id"] for a in r2.json())


# ---------------- Student login + RBAC ----------------
class TestStudentRBAC:
    def test_student_can_login(self, state):
        s = requests.Session()
        s.headers.update({"Content-Type": "application/json"})
        r = s.post(f"{API}/auth/login", json={
            "email": state["student_email"],
            "password": state["student_password"],
        })
        assert r.status_code == 200, r.text
        assert r.json()["role"] == "student"
        state["student_session"] = s

    def test_student_cannot_create_student(self, state):
        s = state["student_session"]
        r = s.post(f"{API}/students", json={"full_name": "hack"})
        assert r.status_code == 403

    def test_student_can_get_self(self, state):
        s = state["student_session"]
        r = s.get(f"{API}/students/{state['student_id']}")
        assert r.status_code == 200

    def test_student_cannot_get_other(self, admin_session, state):
        # Create another student
        unique = uuid.uuid4().hex[:8]
        r = admin_session.post(f"{API}/students", json={
            "full_name": f"TEST_Outro {unique}",
            "email": f"outro_{unique}@teste.com",
        })
        other_id = r.json()["id"]
        s = state["student_session"]
        r2 = s.get(f"{API}/students/{other_id}")
        assert r2.status_code == 403

    def test_student_dashboard(self, state):
        s = state["student_session"]
        r = s.get(f"{API}/dashboard/student")
        assert r.status_code == 200
        d = r.json()
        assert d.get("student", {}).get("id") == state["student_id"]
        assert "enrollments" in d
        assert "attendance" in d
        assert "next_invoice" in d


# ---------------- Cleanup ----------------
class TestCleanup:
    def test_cleanup(self, admin_session, state):
        for path in [
            ("announcements", state.get("announcement_id")),
            ("graduations", state.get("graduation_id")),
            ("enrollments", state.get("enrollment_id")),
            ("classes", state.get("class_id")),
            ("teachers", state.get("teacher_id")),
            ("students", state.get("student_id")),
            ("modalities", state.get("test_modality_id")),
        ]:
            resource, _id = path
            if _id:
                admin_session.delete(f"{API}/{resource}/{_id}")
