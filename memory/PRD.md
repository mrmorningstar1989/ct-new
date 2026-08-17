# CT Warrior - Sistema de Gestão de Academia de Artes Marciais

## Original Problem Statement
Sistema web completo, moderno, responsivo e profissional para gerenciamento de academias de artes marciais e lutas, com módulos integrados: alunos, professores, modalidades, turmas, matrículas, presença, graduação, financeiro, Área do Aluno, dashboards, relatórios e permissões. Suporte a múltiplas modalidades (Jiu-Jitsu, Muay Thai, Judô, Boxe, MMA etc) com sistema de graduação por modalidade.

## User Choices
- Autenticação: JWT customizado (email/senha), 3 perfis (Admin, Professor, Aluno)
- Cores: Vermelho, preto e branco (logo do CT)
- Idioma: Português (Brasil)
- Multiacademia: estrutura preparada (academy_id), 1 academia default no MVP
- Admin: brunodorettom@gmail.com

## Architecture
- **Backend**: FastAPI (Python 3), MongoDB (Motor async), JWT + bcrypt, routers modulares em `/app/backend/routers/`
- **Frontend**: React 19, React Router 7, Tailwind, shadcn/ui, Recharts, Sonner (toasts), react-qr-code
- **Estilo**: Dark theme "Performance Pro", Barlow Condensed (headings) + Manrope (body), sharp edges (rounded-none), vermelho #E50914

## User Personas
- **Administrador**: acesso total (dashboard, cadastros, financeiro, graduações, avisos)
- **Professor**: dashboard próprio, turmas atribuídas, chamada/presença
- **Aluno**: dashboard mobile, carteirinha digital com QR, financeiro, perfil

## Implemented (Feb 2026 - MVP)
- Autenticação JWT (login/logout/me/register) com cookies httpOnly + brute-force protection
- Seeding automático de admin, academia default, 3 modalidades (Jiu-Jitsu, Muay Thai, Boxe) com belt system, 4 planos
- Alunos CRUD com matrícula automática (CT00001...), busca, criação de login vinculado
- Professores CRUD com login
- Modalidades CRUD com sistema de graduação editável (cores, ordem, add/remove níveis)
- Turmas CRUD com dias da semana, horários, capacidade, vínculo com modalidade + professor
- Matrículas (aluno→modalidade→turma→plano) + geração automática de primeira mensalidade
- Planos CRUD (mensal, trimestral, semestral, anual, avulso)
- Financeiro: mensalidades, registro de pagamento com forma (PIX/dinheiro/etc), tab de inadimplência, botão WhatsApp
- Presença: chamada por turma+data com 5 estados (P/F/J/E/A) + "marcar todos presentes"
- Graduações: histórico visual por aluno, adicionar graduação com belt visual estilo BJJ (stripes vermelhas)
- Avisos internos com público (all/students/teachers)
- Dashboard Admin com KPIs, gráfico de receita 6 meses, alunos por modalidade
- Dashboard Professor com turmas e contagem de alunos
- Dashboard Aluno mobile com faixa atual, frequência %, próximo vencimento, avisos
- Carteirinha digital com QR Code, faixa visual e matrícula
- Layouts: AdminLayout (sidebar), TeacherLayout (sidebar), StudentLayout (bottom nav mobile-first)

## Prioritized Backlog (P1/P2)

### P1
- Contatos de emergência completos + upload de foto para aluno
- Página de configurações da academia (nome, CNPJ, logo)
- Calendário/eventos administrativo
- Relatórios com exportação PDF/CSV
- Multi-modalidade por aluno com faixa distinta por modalidade

### P2
- Notificações internas (mensalidade próxima, baixa frequência, próxima graduação)
- Integração WhatsApp/Email/SMS para notificações automáticas
- Controle de caixa diário (entradas/saídas) com abertura/fechamento
- Auditoria completa (audit_logs)
- QR Code check-in de presença via carteirinha
- Search global cross-entidades
- Recuperação de senha (forgot/reset password)
- SaaS multiacademia (isolamento por academy_id)

## Files Structure
- `/app/backend/server.py` - entry point
- `/app/backend/auth.py` - JWT + bcrypt helpers
- `/app/backend/db.py` - Mongo + seeding
- `/app/backend/models.py` - Pydantic models
- `/app/backend/routers/*.py` - 12 routers modulares
- `/app/frontend/src/App.js` - routes
- `/app/frontend/src/context/AuthContext.jsx` - auth state
- `/app/frontend/src/components/layout/` - AdminLayout, TeacherLayout, StudentLayout
- `/app/frontend/src/pages/admin|teacher|student/` - páginas por perfil
