# Gestão Escolar — Next.js (App Router) + Prisma + RBAC

Painel administrativo completo com Tailwind/shadcn, Prisma (PostgreSQL em Docker), autenticação via JWT em cookie httpOnly e RBAC usando `users`, `user_groups`, `permissions`, `group_permissions`. Suporta upload local (avatar/logo) e matrícula interna automática.

## Stack
- Next.js App Router (TypeScript) + TailwindCSS + shadcn/ui
- Prisma Client (pg) + PostgreSQL
- Zod + React Hook Form + @tanstack/react-table
- Auth: bcryptjs + jose (JWT httpOnly) + server actions

## Pré-requisitos
- Node 18+ (testado com 20/24) e NPM
- Docker + Docker Compose (PostgreSQL sobe no serviço `db`)

## Variáveis de ambiente
Copie `.env.example` para `.env.dev` (dev) ou `.env.prod` (prod) e preencha:
```
DATABASE_URL=postgresql://brunodb_owner:senhasegura@db:5432/brunodb?sslmode=disable
AUTH_SECRET=gere_uma_string_longa_e_unica
# DIRECT_URL=postgresql://brunodb_owner:senhasegura@db:5432/brunodb?sslmode=disable
```

## Setup rápido (dev com Docker)
```bash
docker compose -f docker-compose.dev.yml build --no-cache app
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml exec app npx prisma db execute --file prisma/sql/init.sql
docker compose -f docker-compose.dev.yml exec app npx prisma generate
docker compose -f docker-compose.dev.yml exec app npm run seed
docker compose -f docker-compose.dev.yml logs -f app
docker compose -f docker-compose.dev.yml down   # parar/remover containers dev
```
Admin inicial (criado pelo `init.sql`): `admin@escola.local` / `Admin@123456`.

## Produção (build/start via Docker)
```bash
docker compose -f docker-compose.prod.yml build --no-cache app
docker compose -f docker-compose.prod.yml up -d
docker compose -f docker-compose.prod.yml exec app npx prisma db execute --file prisma/sql/init.sql
docker compose -f docker-compose.prod.yml exec app npx prisma generate
docker compose -f docker-compose.prod.yml exec app npm run seed
docker compose -f docker-compose.prod.yml logs -f app
docker compose -f docker-compose.prod.yml down   # parar/remover containers prod
```

Observação: garanta escrita em `public/uploads` ou adapte `/api/upload/avatar` e `/api/upload/logo`. Prisma Studio é opcional e típico de dev (porta 5555).

## Funcionalidades
- Login por e-mail/senha; sessão em cookie httpOnly; menu de usuário com avatar, perfil e logout.
- RBAC aplicado na UI (links/botões) e no servidor (server actions/rotas).
- Matrícula interna do aluno gerada automaticamente (`student_registration_seq`, 8 dígitos).
- Upload de avatar e logo (até 5MB; jpeg/png/webp/gif) em `public/uploads`.
- Tela de Escola (logo/nome/contatos) — logo/nome aparecem na sidebar/header.
- CRUDs completos com validação, paginação e mensagens de FK:
  - Alunos, Responsáveis, Turmas, Disciplinas, Matrículas
  - Usuários (com avatar), Grupos (vinculação de permissões), Permissões
  - Turma x Disciplina, Professores, Prof. x Componente, Períodos, Frequência (sessões), Avaliações
  - Notas por avaliação (`assessment_scores`) e Fechamento (`term_grades`), com botão de recalcular.
- Busca/paginação: `?q=` para filtros (nome/código/CPF/ano etc) + `?page=`.
- Responsividade: tabelas em desktop, cards em mobile; botões “novo/editar/excluir” só aparecem para quem tem `.write`.
- Health check: `/api/health` (`SELECT 1`).

## Dados de exemplo e reset
- `/settings` (permite `settings.write`):
  - **Popular banco**: cria escola, grupos/permissions, 2 usuários secretaria, 5 usuários/professores + professores, 5 turmas, 10 disciplinas, 30 responsáveis, 10 alunos (até 3 responsáveis cada), matrículas, turma x disciplina (2 por turma), alocações de professor, períodos, sessões/presenças, avaliações/notas, fechamentos por período.
  - **Resetar banco**: trunca tabelas, recria permissões/grupos e o admin padrão (`admin@escola.local` / `Admin@123456`).
  - Ambas exibem toasts de sucesso/erro.

## Estrutura rápida
- `prisma/sql/init.sql` — Script canônico do banco (NÃO alterar; inclui `school`).
- `prisma/schema.prisma` — Modelos mapeando o SQL (sem migrations).
- `prisma/seed.ts` — Permissões, grupos e usuário admin.
- `src/lib/` — `env`, `prisma`, `auth`, `session`, `current-user`, `rbac`, `formatters`, `action-utils`.
- `src/app/` — App Router (login, (app) protegido, CRUDs, uploads, settings).
- `src/components/` — shadcn/ui (button, card, form, table, dialog, dropdown, select, textarea, badge, separator, sheet, toast, popover, switch, avatar etc).

## Permissões seedadas
- `.read` e `.write` para: students, guardians, class_groups, subjects, enrollments, teachers, class_subjects, teacher_assignments, academic_terms, attendance, assessments, term_grades, users, groups, permissions, school, settings.
- Grupos: Admin (tudo), Secretaria (cadastros principais), Professor (leituras + frequência/avaliações).

## Rotas úteis
- `/login`, `/dashboard`
- `/students`, `/guardians`, `/class-groups`, `/subjects`, `/enrollments`
- `/teachers`, `/class-subjects`, `/teacher-assignments`, `/academic-terms`
- `/attendance`, `/assessments`, `/assessment-scores`, `/term-grades`
- `/users`, `/groups`, `/permissions`
- `/school`, `/settings`

## Passo a passo de cadastro (recomendado)
1. **Login** com o admin inicial e troque a senha em Perfil, se desejar.
2. **Configurações › Escola**: preencha nome, contatos e logo (opcional).
3. **Permissões/Grupos** (se necessário): já vêm seedados; ajuste se quiser perfis customizados.
4. **Usuários**: crie usuários e atribua grupos (Admin/Secretaria/Professor). Avatar é opcional.
5. **Responsáveis**: cadastre responsáveis com CPF único e telefone; eles serão vinculados aos alunos.
6. **Alunos**: cadastre o aluno, busque/vincule pelo CPF do responsável (pelo menos um). Matrícula interna é gerada automaticamente.
7. **Turmas**: cadastre turmas (ano letivo, turno numérico 1/2/3/4).
8. **Disciplinas**: cadastre os componentes curriculares.
9. **Matrículas**: matricule os alunos nas turmas.
10. **Turma x Disciplina**: associe disciplinas às turmas.
11. **Professores**: crie professores usando usuários do grupo Professor.
12. **Prof. x Componente**: aloque professores nas turmas/disciplinas (defina o papel 1=Titular, 2=Apoio, 3=Substituto).
13. **Períodos (Academic Terms)**: cadastre bimestres/trimestres/semestres para o ano.
14. **Frequência (Sessions)**: crie sessões de aula por turma/componente/período; lance presença em `attendance_records`.
15. **Avaliações**: cadastre avaliações por turma/componente/período/professor.
16. **Notas por avaliação**: lance notas/ausências em `assessment_scores`.
17. **Fechamento**: consolide notas/faltas em `term_grades` (ou use recalcular).
18. **Dashboard**: acompanhe visão geral; RBAC controla o que cada perfil enxerga/edita.

## Scripts
- `npm run dev` — desenvolvimento
- `npm run lint` — ESLint

## Observações
- Prisma Client apenas no servidor.
- Não commitar `.env.dev`/`.env.prod`.
- Cookies: `session` httpOnly, sameSite=lax (secure em produção).
