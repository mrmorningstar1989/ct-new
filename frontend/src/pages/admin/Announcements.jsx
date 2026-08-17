import { useEffect, useState } from "react";
import { api, formatApiErrorDetail } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Bell } from "lucide-react";
import { toast } from "sonner";

export default function Announcements() {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", message: "", audience: "all" });

  const load = async () => { const { data } = await api.get("/announcements"); setItems(data); };
  useEffect(() => { load(); }, []);

  const submit = async () => {
    try {
      await api.post("/announcements", form);
      toast.success("Aviso publicado");
      setOpen(false); setForm({ title: "", message: "", audience: "all" });
      load();
    } catch (e) { toast.error(formatApiErrorDetail(e.response?.data?.detail)); }
  };

  const remove = async (a) => {
    if (!window.confirm("Excluir aviso?")) return;
    await api.delete(`/announcements/${a.id}`); toast.success("Removido"); load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-red-500 mb-1">Comunicação</div>
          <h1 className="font-heading text-4xl leading-none">AVISOS</h1>
        </div>
        <Button onClick={() => setOpen(true)} data-testid="add-announcement-button" className="bg-red-600 hover:bg-red-700 rounded-none">
          <Plus className="w-4 h-4 mr-2" /> Publicar Aviso
        </Button>
      </div>

      <div className="space-y-3">
        {items.length === 0 && <div className="text-zinc-500 py-8 text-center card-flat">Nenhum aviso publicado</div>}
        {items.map(a => (
          <div key={a.id} className="card-flat p-5" data-testid={`announcement-${a.id}`}>
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Bell className="w-4 h-4 text-red-500" />
                  <div className="font-heading text-xl">{a.title}</div>
                </div>
                <div className="text-sm text-zinc-400 mt-2 whitespace-pre-line">{a.message}</div>
                <div className="text-xs text-zinc-600 font-mono mt-3">
                  {new Date(a.created_at).toLocaleString("pt-BR")} · para {a.audience === "all" ? "todos" : a.audience}
                </div>
              </div>
              <button onClick={() => remove(a)} className="text-zinc-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[#121212] border-zinc-800 text-white rounded-none max-w-lg">
          <DialogHeader><DialogTitle className="font-heading text-2xl">NOVO AVISO</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Título</Label>
              <Input data-testid="announcement-title-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="mt-1.5 bg-transparent border-zinc-800 rounded-none" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Mensagem</Label>
              <Textarea data-testid="announcement-message-input" rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="mt-1.5 bg-transparent border-zinc-800 rounded-none" />
            </div>
            <div>
              <Label className="text-xs uppercase tracking-wider text-zinc-400">Público</Label>
              <Select value={form.audience} onValueChange={(v) => setForm({ ...form, audience: v })}>
                <SelectTrigger className="mt-1.5 bg-transparent border-zinc-800 rounded-none"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-[#121212] border-zinc-800 text-white rounded-none">
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="students">Alunos</SelectItem>
                  <SelectItem value="teachers">Professores</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} className="rounded-none border-zinc-700">Cancelar</Button>
            <Button onClick={submit} data-testid="save-announcement-button" className="bg-red-600 hover:bg-red-700 rounded-none">Publicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
