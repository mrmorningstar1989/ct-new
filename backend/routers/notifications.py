"""Notification center - identifies students needing attention (overdue, low freq, near graduation)."""
from datetime import datetime, timezone, date, timedelta
from fastapi import APIRouter, Depends

from auth import require_admin
from db import db

router = APIRouter(prefix="/api/notifications", tags=["notifications"])

LOW_FREQ_THRESHOLD = 60  # % below this triggers alert
LOW_FREQ_WINDOW_DAYS = 30
UPCOMING_DAYS = 7  # invoices due in next 7 days
GRADUATION_MIN_DAYS = 180  # eligible if on belt more than 6 months


@router.get("/summary")
async def summary(user: dict = Depends(require_admin)):
    today = date.today()
    q = {"academy_id": user["academy_id"]}

    # 1. Overdue invoices with student info
    overdue_docs = await db.invoices.find({
        **q,
        "status": {"$ne": "paid"},
        "due_date": {"$lt": today.isoformat()},
    }).to_list(1000)
    overdue_list = []
    for i in overdue_docs:
        i.pop("_id", None)
        student = await db.students.find_one({"id": i["student_id"], "academy_id": user["academy_id"]}, {"_id": 0})
        if not student:
            continue
        try:
            days_late = (today - date.fromisoformat(i["due_date"])).days
        except Exception:
            days_late = 0
        overdue_list.append({
            "invoice_id": i["id"],
            "student_id": student["id"],
            "student_name": student.get("full_name"),
            "phone": student.get("whatsapp") or student.get("phone", ""),
            "competency": i.get("competency"),
            "due_date": i.get("due_date"),
            "value": i.get("final_value") or i.get("value", 0),
            "days_late": days_late,
        })
    overdue_list.sort(key=lambda x: x["days_late"], reverse=True)

    # 2. Upcoming (due in next 7 days, not paid)
    horizon = (today + timedelta(days=UPCOMING_DAYS)).isoformat()
    upcoming_docs = await db.invoices.find({
        **q,
        "status": {"$ne": "paid"},
        "due_date": {"$gte": today.isoformat(), "$lte": horizon},
    }).to_list(1000)
    upcoming_list = []
    for i in upcoming_docs:
        i.pop("_id", None)
        student = await db.students.find_one({"id": i["student_id"], "academy_id": user["academy_id"]}, {"_id": 0})
        if not student:
            continue
        try:
            days_until = (date.fromisoformat(i["due_date"]) - today).days
        except Exception:
            days_until = 0
        upcoming_list.append({
            "invoice_id": i["id"],
            "student_id": student["id"],
            "student_name": student.get("full_name"),
            "phone": student.get("whatsapp") or student.get("phone", ""),
            "competency": i.get("competency"),
            "due_date": i.get("due_date"),
            "value": i.get("final_value") or i.get("value", 0),
            "days_until": days_until,
        })
    upcoming_list.sort(key=lambda x: x["days_until"])

    # 3. Low frequency (last 30 days)
    window_start = (today - timedelta(days=LOW_FREQ_WINDOW_DAYS)).isoformat()
    students = await db.students.find({**q, "status": "active"}).to_list(2000)
    attendance_docs = await db.attendance.find({
        **q,
        "date": {"$gte": window_start},
    }).to_list(5000)

    low_freq = []
    for s in students:
        s.pop("_id", None)
        counts = {"present": 0, "absent": 0, "justified": 0, "trial": 0, "medical": 0}
        for att in attendance_docs:
            for r in att.get("records", []):
                if r.get("student_id") == s["id"]:
                    counts[r["status"]] = counts.get(r["status"], 0) + 1
        total = sum(counts.values())
        if total < 4:
            continue  # ignore students with almost no data
        freq = round((counts["present"] / total) * 100, 1)
        if freq < LOW_FREQ_THRESHOLD:
            low_freq.append({
                "student_id": s["id"],
                "student_name": s.get("full_name"),
                "phone": s.get("whatsapp") or s.get("phone", ""),
                "frequency_pct": freq,
                "present": counts["present"],
                "absent": counts["absent"],
                "total": total,
            })
    low_freq.sort(key=lambda x: x["frequency_pct"])

    # 4. Upcoming graduations: students on same belt more than N days
    grads = await db.graduations.find(q).to_list(5000)
    # Get latest per student+modality
    latest = {}
    for g in grads:
        g.pop("_id", None)
        key = (g["student_id"], g["modality_id"])
        if key not in latest or g["graduation_date"] > latest[key]["graduation_date"]:
            latest[key] = g

    upcoming_grads = []
    for (sid, mid), g in latest.items():
        try:
            days = (today - date.fromisoformat(g["graduation_date"])).days
        except Exception:
            days = 0
        if days < GRADUATION_MIN_DAYS:
            continue
        student = await db.students.find_one({"id": sid, "academy_id": user["academy_id"]}, {"_id": 0})
        modality = await db.modalities.find_one({"id": mid, "academy_id": user["academy_id"]}, {"_id": 0})
        if not student or not modality:
            continue
        upcoming_grads.append({
            "student_id": sid,
            "student_name": student.get("full_name"),
            "phone": student.get("whatsapp") or student.get("phone", ""),
            "modality_name": modality.get("name"),
            "belt_name": g.get("belt_name"),
            "days_on_belt": days,
        })
    upcoming_grads.sort(key=lambda x: x["days_on_belt"], reverse=True)

    return {
        "overdue": overdue_list,
        "upcoming_invoices": upcoming_list,
        "low_frequency": low_freq,
        "upcoming_graduations": upcoming_grads,
        "totals": {
            "overdue": len(overdue_list),
            "upcoming_invoices": len(upcoming_list),
            "low_frequency": len(low_freq),
            "upcoming_graduations": len(upcoming_grads),
        },
    }
