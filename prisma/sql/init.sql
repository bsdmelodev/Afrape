-- =========================================================
-- Script inicial - Gestão Escolar
-- Módulos: Usuários/Grupos/Permissões, Alunos/Responsáveis, Professores,
--          Estrutura (Turmas/Disciplinas), Matrículas, Notas e Frequência (por aula)
-- Banco: PostgreSQL
-- IDs: INT autoincrement (IDENTITY)
-- =========================================================

-- =========================
-- GRUPOS (ROLES)
-- =========================
create table user_groups (
  id int generated always as identity primary key,
  name varchar(80) not null unique,
  description text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

-- =========================
-- USUÁRIOS
-- =========================
create table users (
  id int generated always as identity primary key,
  group_id int not null,
  name varchar(150) not null,
  email varchar(180) not null unique,
  password_hash varchar(255) not null,
  avatar_url varchar(255),
  cpf varchar(11) not null unique,
  phone varchar(30),
  is_active boolean not null default true,
  last_login_at timestamp null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint fk_users_group
    foreign key (group_id) references user_groups(id)
    on delete restrict
);

create index ix_users_group_id on users(group_id);

-- =========================
-- PERMISSÕES
-- =========================
create table permissions (
  id int generated always as identity primary key,
  code varchar(120) not null unique,  -- ex: 'students.read'
  description text
);

-- =========================
-- GRUPO x PERMISSÃO
-- =========================
create table group_permissions (
  group_id int not null,
  permission_id int not null,
  primary key (group_id, permission_id),
  constraint fk_gp_group
    foreign key (group_id) references user_groups(id)
    on delete cascade,
  constraint fk_gp_permission
    foreign key (permission_id) references permissions(id)
    on delete cascade
);

create index ix_group_permissions_permission_id on group_permissions(permission_id);

-- =========================
-- ALUNOS
-- =========================
create sequence if not exists student_registration_seq;

create table students (
  id int generated always as identity primary key,
  registration_number varchar(30) not null unique default lpad(nextval('student_registration_seq')::text, 8, '0'), -- matrícula interna gerada
  name varchar(150) not null,
  birth_date date,
  cpf varchar(11) not null unique, -- obrigatório; somente dígitos
  email varchar(180),
  phone varchar(30),
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

-- =========================
-- RESPONSÁVEIS
-- =========================
create table guardians (
  id int generated always as identity primary key,
  name varchar(150) not null,
  cpf varchar(11) not null unique, -- manter apenas dígitos
  email varchar(180),
  phone varchar(30),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

-- =========================
-- ALUNO x RESPONSÁVEL (N:N)
-- =========================
create table student_guardians (
  student_id int not null,
  guardian_id int not null,
  relationship varchar(40) not null, -- ex: 'mãe', 'pai', 'avó', 'tio', 'responsável legal'
  is_primary boolean not null default false,     -- contato principal
  is_financial boolean not null default false,   -- responsável financeiro
  lives_with_student boolean not null default false,
  notes text,

  primary key (student_id, guardian_id),

  constraint fk_sg_student
    foreign key (student_id) references students(id)
    on delete cascade,

  constraint fk_sg_guardian
    foreign key (guardian_id) references guardians(id)
    on delete restrict
);

create index ix_student_guardians_guardian_id on student_guardians(guardian_id);

-- Opcional: garantir apenas 1 responsável principal por aluno
create unique index ux_student_one_primary_guardian
on student_guardians(student_id)
where is_primary = true;

-- =========================
-- PROFESSORES (1:1 com USERS)
-- =========================
create table teachers (
  id int generated always as identity primary key,
  user_id int not null unique,
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  constraint fk_teachers_user
    foreign key (user_id) references users(id)
    on delete restrict
);

-- =========================
-- DISCIPLINAS
-- =========================
create table subjects (
  id int generated always as identity primary key,
  name varchar(120) not null,
  code varchar(30) unique,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index ix_subjects_name on subjects(name);

-- =========================
-- TURMAS
-- =========================
create table class_groups (
  id int generated always as identity primary key,
  name varchar(60) not null,         -- ex: "6ºA"
  school_year int not null,          -- ex: 2025 (podemos normalizar depois)
  shift smallint,                    -- 1=manhã,2=tarde,3=noite,4=integral
  is_active boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint ux_class_groups unique (school_year, name)
);

create index ix_class_groups_year on class_groups(school_year);

-- =========================
-- MATRÍCULAS / ENTURMAÇÃO (ALUNO NA TURMA)
-- =========================
create table enrollments (
  id int generated always as identity primary key,
  student_id int not null,
  class_group_id int not null,
  status varchar(20) not null default 'active', -- active/transferred/cancelled/completed
  enrolled_at date not null default current_date,
  left_at date null,

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  constraint fk_enr_student
    foreign key (student_id) references students(id) on delete restrict,

  constraint fk_enr_class
    foreign key (class_group_id) references class_groups(id) on delete restrict
);

create index ix_enrollments_student_id on enrollments(student_id);
create index ix_enrollments_class_group_id on enrollments(class_group_id);

-- =========================
-- TURMA x DISCIPLINA (COMPONENTE CURRICULAR)
-- =========================
create table class_subjects (
  id int generated always as identity primary key,
  class_group_id int not null,
  subject_id int not null,
  workload_minutes int null, -- opcional

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  constraint fk_cs_class
    foreign key (class_group_id) references class_groups(id) on delete cascade,

  constraint fk_cs_subject
    foreign key (subject_id) references subjects(id) on delete restrict,

  constraint ux_class_subject unique (class_group_id, subject_id)
);

create index ix_class_subjects_class_group_id on class_subjects(class_group_id);
create index ix_class_subjects_subject_id on class_subjects(subject_id);

-- =========================
-- PROFESSOR x COMPONENTE (permite co-docência/substituição)
-- =========================
create table teacher_assignments (
  id int generated always as identity primary key,
  class_subject_id int not null,
  teacher_id int not null,
  role smallint not null default 1, -- 1=main,2=assistant,3=substitute
  starts_at date null,
  ends_at date null,

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  constraint fk_ta_class_subject
    foreign key (class_subject_id) references class_subjects(id) on delete cascade,

  constraint fk_ta_teacher
    foreign key (teacher_id) references teachers(id) on delete restrict
);

create index ix_teacher_assignments_class_subject_id on teacher_assignments(class_subject_id);
create index ix_teacher_assignments_teacher_id on teacher_assignments(teacher_id);

-- =========================
-- PERÍODOS (BIMESTRE/TRIMESTRE/SEMESTRE)
-- =========================
create table academic_terms (
  id int generated always as identity primary key,
  school_year int not null,                 -- ex: 2025
  name varchar(40) not null,                -- ex: '1º Bimestre'
  term_order smallint not null,             -- 1,2,3,4...
  starts_at date not null,
  ends_at date not null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  constraint ux_academic_terms unique (school_year, term_order),
  constraint ck_academic_terms_dates check (starts_at <= ends_at)
);

create index ix_academic_terms_year on academic_terms(school_year);

-- =========================
-- FREQUÊNCIA (POR AULA)
-- =========================
create table attendance_sessions (
  id int generated always as identity primary key,
  class_subject_id int not null,
  term_id int null,

  session_date date not null,
  lesson_number smallint null,             -- opcional: 1ª aula, 2ª aula...
  starts_at time null,
  ends_at time null,

  content text null,                       -- conteúdo/assunto
  launched_by_teacher_id int not null,

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  constraint fk_as_class_subject
    foreign key (class_subject_id) references class_subjects(id) on delete cascade,

  constraint fk_as_term
    foreign key (term_id) references academic_terms(id) on delete restrict,

  constraint fk_as_teacher
    foreign key (launched_by_teacher_id) references teachers(id) on delete restrict,

  constraint ck_as_time check (starts_at is null or ends_at is null or starts_at < ends_at)
);

-- Evita duplicar a mesma aula no mesmo dia; trata NULL como "0"
create unique index ux_attendance_sessions_unique
on attendance_sessions(class_subject_id, session_date, coalesce(lesson_number, 0));

create index ix_attendance_sessions_class_subject on attendance_sessions(class_subject_id);
create index ix_attendance_sessions_date on attendance_sessions(session_date);

create table attendance_records (
  attendance_session_id int not null,
  enrollment_id int not null,

  status varchar(12) not null,             -- present/absent/late/excused
  minutes_late smallint null,
  notes text null,

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  primary key (attendance_session_id, enrollment_id),

  constraint fk_ar_session
    foreign key (attendance_session_id) references attendance_sessions(id) on delete cascade,

  constraint fk_ar_enrollment
    foreign key (enrollment_id) references enrollments(id) on delete restrict,

  constraint ck_ar_status check (status in ('present','absent','late','excused')),
  constraint ck_ar_minutes_late check (minutes_late is null or minutes_late >= 0)
);

create index ix_attendance_records_enrollment on attendance_records(enrollment_id);

-- =========================
-- NOTAS (POR AVALIAÇÕES)
-- =========================
create table assessments (
  id int generated always as identity primary key,
  class_subject_id int not null,
  term_id int not null,

  title varchar(120) not null,
  assessment_type varchar(20) not null,     -- exam/quiz/homework/project/other
  assessment_date date not null,

  weight numeric(6,3) not null default 1,   -- peso
  max_score numeric(6,2) not null default 10,

  is_published boolean not null default false,
  created_by_teacher_id int not null,

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  constraint fk_a_class_subject
    foreign key (class_subject_id) references class_subjects(id) on delete cascade,

  constraint fk_a_term
    foreign key (term_id) references academic_terms(id) on delete restrict,

  constraint fk_a_teacher
    foreign key (created_by_teacher_id) references teachers(id) on delete restrict,

  constraint ck_a_type check (assessment_type in ('exam','quiz','homework','project','other')),
  constraint ck_a_weight check (weight > 0),
  constraint ck_a_max_score check (max_score > 0)
);

create index ix_assessments_class_subject on assessments(class_subject_id);
create index ix_assessments_term on assessments(term_id);

create table assessment_scores (
  assessment_id int not null,
  enrollment_id int not null,

  score numeric(6,2) null,                  -- pode ser null enquanto não lançado
  is_absent boolean not null default false, -- faltou na avaliação
  is_excused boolean not null default false,
  notes text null,

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  primary key (assessment_id, enrollment_id),

  constraint fk_ascore_assessment
    foreign key (assessment_id) references assessments(id) on delete cascade,

  constraint fk_ascore_enrollment
    foreign key (enrollment_id) references enrollments(id) on delete restrict,

  constraint ck_ascore_score check (score is null or score >= 0)
);

create index ix_assessment_scores_enrollment on assessment_scores(enrollment_id);

-- =========================
-- FECHAMENTO DO PERÍODO (CONSOLIDADO)
-- =========================
create table term_grades (
  id int generated always as identity primary key,
  enrollment_id int not null,
  class_subject_id int not null,
  term_id int not null,

  grade numeric(6,2) null,                  -- nota final do período
  absences_count int not null default 0,    -- faltas consolidadas no período (opcional)
  attendance_percentage numeric(5,2) null,  -- 0..100 (opcional)

  is_closed boolean not null default false,
  closed_at timestamp null,
  closed_by_user_id int null,               -- usuário que fechou (coordenação/secretaria)

  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),

  constraint fk_tg_enrollment
    foreign key (enrollment_id) references enrollments(id) on delete restrict,

  constraint fk_tg_class_subject
    foreign key (class_subject_id) references class_subjects(id) on delete restrict,

  constraint fk_tg_term
    foreign key (term_id) references academic_terms(id) on delete restrict,

  constraint fk_tg_closed_by_user
    foreign key (closed_by_user_id) references users(id) on delete set null,

  constraint ux_term_grades unique (enrollment_id, class_subject_id, term_id),
  constraint ck_tg_absences check (absences_count >= 0),
  constraint ck_tg_att_pct check (attendance_percentage is null or (attendance_percentage >= 0 and attendance_percentage <= 100))
);

create index ix_term_grades_term on term_grades(term_id);
create index ix_term_grades_class_subject on term_grades(class_subject_id);

-- =========================
-- ESCOLA (DADOS INSTITUCIONAIS)
-- =========================
create table if not exists school (
  id int generated always as identity primary key,
  name varchar(150) not null,
  cnpj varchar(18),
  ie varchar(50),
  address text,
  city varchar(100),
  state varchar(10),
  zip varchar(20),
  phone varchar(30),
  email varchar(180),
  website varchar(200),
  logo_url varchar(255),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

-- =========================
-- SEEDS PADRÃO (permissões, grupos, vínculos, admin e escola modelo)
-- =========================
insert into permissions (code, description) values
  ('students.read', 'Visualizar alunos'),
  ('students.write', 'Criar/editar/excluir alunos'),
  ('guardians.read', 'Visualizar responsáveis'),
  ('guardians.write', 'Criar/editar/excluir responsáveis'),
  ('class_groups.read', 'Visualizar turmas'),
  ('class_groups.write', 'Criar/editar/excluir turmas'),
  ('subjects.read', 'Visualizar disciplinas'),
  ('subjects.write', 'Criar/editar/excluir disciplinas'),
  ('enrollments.read', 'Visualizar matrículas'),
  ('enrollments.write', 'Criar/editar/excluir matrículas'),
  ('teachers.read', 'Visualizar professores'),
  ('teachers.write', 'Criar/editar/excluir professores'),
  ('class_subjects.read', 'Visualizar componentes de turma'),
  ('class_subjects.write', 'Criar/editar/excluir componentes de turma'),
  ('teacher_assignments.read', 'Visualizar alocações de professores'),
  ('teacher_assignments.write', 'Criar/editar/excluir alocações de professores'),
  ('academic_terms.read', 'Visualizar períodos acadêmicos'),
  ('academic_terms.write', 'Criar/editar/excluir períodos acadêmicos'),
  ('attendance.read', 'Visualizar frequência'),
  ('attendance.write', 'Registrar/editar frequência'),
  ('assessments.read', 'Visualizar avaliações'),
  ('assessments.write', 'Criar/editar/excluir avaliações'),
  ('term_grades.read', 'Visualizar fechamento de notas'),
  ('term_grades.write', 'Registrar/editar fechamento de notas'),
  ('users.read', 'Visualizar usuários'),
  ('users.write', 'Criar/editar/excluir usuários'),
  ('groups.read', 'Visualizar grupos'),
  ('groups.write', 'Criar/editar/excluir grupos'),
  ('permissions.read', 'Visualizar permissões'),
  ('permissions.write', 'Criar/editar/excluir permissões'),
  ('school.read', 'Visualizar dados da escola'),
  ('school.write', 'Criar/editar dados da escola'),
  ('settings.read', 'Visualizar configurações'),
  ('settings.write', 'Executar ações administrativas em configurações')
on conflict (code) do update set description = excluded.description;

insert into user_groups (name, description) values
  ('Admin', 'Acesso completo ao sistema'),
  ('Secretaria', 'Gestão acadêmica e de matrículas'),
  ('Professor', 'Lançamento de frequência e avaliações')
on conflict (name) do update set description = excluded.description;

-- Admin recebe todas as permissões
insert into group_permissions (group_id, permission_id)
select g.id, p.id
from user_groups g
cross join permissions p
where g.name = 'Admin'
on conflict do nothing;

-- Secretaria
with perms as (
  select id from permissions where code in (
    'students.read','students.write','guardians.read','guardians.write',
    'class_groups.read','class_groups.write','subjects.read','subjects.write',
    'enrollments.read','enrollments.write','term_grades.read'
  )
), grp as (select id from user_groups where name = 'Secretaria')
insert into group_permissions (group_id, permission_id)
select grp.id, perms.id from grp cross join perms
on conflict do nothing;

-- Professor
with perms as (
  select id from permissions where code in (
    'students.read','class_groups.read','subjects.read',
    'attendance.write','assessments.write','term_grades.read'
  )
), grp as (select id from user_groups where name = 'Professor')
insert into group_permissions (group_id, permission_id)
select grp.id, perms.id from grp cross join perms
on conflict do nothing;

-- Admin padrão
with grp as (select id from user_groups where name = 'Admin')
insert into users (group_id, name, email, password_hash, is_active, cpf)
select grp.id, 'Administrador', 'admin@escola.local', '$2b$10$WKfjgQbkHq4KaKJkvsrYx.0IkIx2FFd8KIpECk4AiNiY3C3Vo4SS2', true, '00000000000'
from grp
where not exists (select 1 from users where email = 'admin@escola.local');

-- Escola modelo (opcional)
insert into school (name)
select 'Escola Modelo'
where not exists (select 1 from school);
