import { useEffect, useState } from "react";
import QRCode from "react-qr-code";
import { api } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { getAcademy } from "@/lib/academy";
import BeltDisplay from "@/components/BeltDisplay";

export default function StudentDigitalId() {
  const { user } = useAuth();
  const [student, setStudent] = useState(null);
  const [belts, setBelts] = useState([]);
  const [academy, setAcademy] = useState({});

  useEffect(() => {
    if (!user?.linked_id) return;
    (async () => {
      const [s, ac] = await Promise.all([
        api.get(`/students/${user.linked_id}`),
        getAcademy(),
      ]);
      setStudent(s.data);
      setAcademy(ac || {});
      const enroll = await api.get("/enrollments");
      const results = [];
      for (const e of enroll.data) {
        if (e.modality_id) {
          try {
            const b = await api.get(`/graduations/student/${user.linked_id}/current/${e.modality_id}`);
            if (b.data) {
              const m = await api.get(`/modalities/${e.modality_id}`);
              results.push({ ...b.data, modality: m.data });
            }
          } catch {}
        }
      }
      setBelts(results);
    })();
  }, [user]);

  if (!student) return <div className="p-6 text-zinc-400">Carregando...</div>;

  const qrValue = JSON.stringify({ id: student.id, mat: student.matricula });

  return (
    <div className="p-5">
      <div className="text-[10px] uppercase tracking-widest text-red-500 mb-1">Identificação</div>
      <h1 className="font-heading text-4xl leading-none mb-6">CARTEIRINHA</h1>

      <div className="relative bg-black border border-red-600 max-w-sm mx-auto overflow-hidden" data-testid="digital-id-card">
        {/* Top red bar */}
        <div className="h-1.5 bg-red-600" />

        <div className="p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              {academy.logo_url ? (
                <img src={academy.logo_url} alt="Logo" className="w-10 h-10 object-contain bg-white p-1 mb-3" />
              ) : (
                <div className="w-10 h-10 bg-red-600 flex items-center justify-center mb-3">
                  <span className="font-heading text-white text-2xl leading-none">{(academy.name || "W")[0].toUpperCase()}</span>
                </div>
              )}
              <div className="font-heading text-xl leading-none">{(academy.name || "ZENKAIOS").toUpperCase()}</div>
              <div className="text-[9px] uppercase tracking-widest text-zinc-500 mt-1">Digital ID</div>
            </div>
            <div className="text-right">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500">Matrícula</div>
              <div className="font-mono text-sm text-white mt-1">{student.matricula}</div>
            </div>
          </div>

          <div className="mb-6">
            <div className="text-[9px] uppercase tracking-widest text-zinc-500">Aluno</div>
            <div className="font-heading text-2xl leading-tight mt-1">{student.full_name.toUpperCase()}</div>
          </div>

          {belts.length > 0 && (
            <div className="mb-6 space-y-3">
              {belts.map((b, i) => (
                <div key={i}>
                  <div className="text-[9px] uppercase tracking-widest text-zinc-500 mb-1.5">{b.modality?.name}</div>
                  <BeltDisplay color={b.belt_color} stripes={b.stripes} size="sm" />
                </div>
              ))}
            </div>
          )}

          <div className="bg-white p-3 flex items-center justify-center">
            <QRCode value={qrValue} size={140} bgColor="#ffffff" fgColor="#000000" level="M" />
          </div>

          <div className="mt-4 text-[9px] uppercase tracking-widest text-zinc-500 text-center font-mono">
            {student.id.slice(0, 8)} · Autêntico
          </div>
        </div>

        <div className="h-1.5 bg-red-600" />
      </div>
    </div>
  );
}
