"""Dashboard aggregations."""
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends

from ..auth import require_admin, get_current_user
from ..db import db

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/admin")
async def admin_dashboard(user: dict = Depends(require_admin)):
    q = {"academy_id": user["academy_id"]}

    total_students = await db.students.count_documents(q)
    active_students = await db.students.count_documents({**q, "status": "active"})
    inactive_students = await db.students.count_documents({**q, "status": {"$ne": "active"}})
    total_teachers = await db.teachers.count_documents(q)
    total_modalities = await db.modalities.count_documents(q)
    total_classes = await db.classes.count_documents(q)

    # New students this month
    today = date.today()
    month_start = date(today.year, today.month, 1).isoformat()
    new_this_month = await db.students.count_documents({
        **q, "created_at": {"$gte": month_start}
    })

    # Financial (this month)
    competency = f"{today.year:04d}-{today.month:02d}"
    invoices_month = await db.invoices.find({**q, "competency": competency}).to_list(1000)
    revenue_received = sum(i.get("amount_paid", 0) for i in invoices_month if i.get("status") == "paid")
    revenue_pending = sum(i.get("final_value", 0) for i in invoices_month if i.get("status") != "paid")

    # Overdue
    overdue_docs = await db.invoices.find({
        **q, "status": {"$ne": "paid"}, "due_date": {"$lt": today.isoformat()}
    }).to_list(1000)
    overdue_total = sum(i.get("final_value", 0) for i in overdue_docs)
    overdue_count = len(overdue_docs)

    # Attendance today
    today_iso = today.isoformat()
    att_today = await db.attendance.find({**q, "date": today_iso}).to_list(500)
    present_today = 0
    for a in att_today:
        for r in a.get("records", []):
            if r.get("status") == "present":
                present_today += 1

    # Students by modality
    modalities = await db.modalities.find(q).to_list(500)
    students_by_modality = []
    for m in modalities:
        c = await db.enrollments.count_documents({**q, "modality_id": m["id"], "status": "active"})
        students_by_modality.append({"name": m["name"], "count": c})

    # Revenue last 6 months
    revenue_series = []
    for i in range(5, -1, -1):
        month = (today.replace(day=1) - timedelta(days=i * 30)).replace(day=1)
        comp = f"{month.year:04d}-{month.month:02d}"
        invs = await db.invoices.find({**q, "competency": comp, "status": "paid"}).to_list(1000)
        total = sum(inv.get("amount_paid", 0) for inv in invs)
        revenue_series.append({"month": comp, "value": total})

    return {
        "kpis": {
            "total_students": total_students,
            "active_students": active_students,
            "inactive_students": inactive_students,
            "new_this_month": new_this_month,
            "total_teachers": total_teachers,
            "total_modalities": total_modalities,
            "total_classes": total_classes,
            "present_today": present_today,
            "revenue_received": revenue_received,
            "revenue_pending": revenue_pending,
            "overdue_total": overdue_total,
            "overdue_count": overdue_count,
        },
        "students_by_modality": students_by_modality,
        "revenue_series": revenue_series,
    }


@router.get("/teacher")
async def teacher_dashboard(user: dict = Depends(get_current_user)):
    if user["role"] not in ("teacher", "admin"):
        return {"classes": [], "students_count": 0}
    teacher_id = user.get("linked_id") if user["role"] == "teacher" else None

    query = {"academy_id": user["academy_id"]}
    if teacher_id:
        query["teacher_id"] = teacher_id

    classes = await db.classes.find(query).to_list(500)
    for c in classes:
        c.pop("_id", None)
        # Count students
        c["student_count"] = await db.enrollments.count_documents({
            "academy_id": user["academy_id"], "class_id": c["id"], "status": "active"
        })

    total_students = 0
    for c in classes:
        total_students += c["student_count"]

    return {
        "classes": classes,
        "total_classes": len(classes),
        "total_students": total_students,
    }


@router.get("/student")
async def student_dashboard(user: dict = Depends(get_current_user)):
    if user["role"] != "student":
        return {}
    student_id = user.get("linked_id")
    if not student_id:
        return {}

    academy_id = user["academy_id"]
    student = await db.students.find_one({"id": student_id, "academy_id": academy_id})
    if not student:
        return {}
    student.pop("_id", None)

    enrollments = await db.enrollments.find({"academy_id": academy_id, "student_id": student_id, "status": "active"}).to_list(50)
    for e in enrollments:
        e.pop("_id", None)
        if e.get("modality_id"):
            m = await db.modalities.find_one({"id": e["modality_id"], "academy_id": academy_id}, {"_id": 0})
            e["modality"] = m
        if e.get("class_id"):
            c = await db.classes.find_one({"id": e["class_id"], "academy_id": academy_id}, {"_id": 0})
            e["class"] = c
        if e.get("plan_id"):
            p = await db.plans.find_one({"id": e["plan_id"], "academy_id": academy_id}, {"_id": 0})
            e["plan"] = p

    # Attendance summary
    docs = await db.attendance.find({"academy_id": academy_id}).to_list(2000)
    counts = {"present": 0, "absent": 0, "justified": 0, "trial": 0, "medical": 0}
    for att in docs:
        for r in att.get("records", []):
            if r.get("student_id") == student_id:
                counts[r["status"]] = counts.get(r["status"], 0) + 1
    total = sum(counts.values())
    freq = round((counts["present"] / total) * 100, 1) if total > 0 else 0

    # Financial - next invoice
    invs = await db.invoices.find({"academy_id": academy_id, "student_id": student_id, "status": {"$ne": "paid"}}).sort("due_date", 1).to_list(10)
    next_invoice = None
    if invs:
        invs[0].pop("_id", None)
        next_invoice = invs[0]

    return {
        "student": student,
        "enrollments": enrollments,
        "attendance": {"counts": counts, "total": total, "frequency_pct": freq},
        "next_invoice": next_invoice,
    }

