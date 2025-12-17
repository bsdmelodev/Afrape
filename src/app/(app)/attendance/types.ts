export type AttendanceRow = {
  id: number;
  classSubjectId: number;
  classSubjectName: string;
  classGroupName: string;
  classGroupYear: number;
  termId: number | null;
  termName: string | null;
  sessionDate: string;
  lessonNumber: number | null;
  startsAt: string | null;
  endsAt: string | null;
  content: string | null;
  teacherId: number;
  teacherName: string;
  teacherEmail?: string | null;
  teacherCpf?: string | null;
  teacherPhone?: string | null;
  createdAt: string;
};

export type AttendanceClassSubjectOption = {
  id: number;
  label: string;
};

export type AttendanceTermOption = {
  id: number;
  name: string;
  schoolYear: number;
};

export type AttendanceTeacherOption = {
  id: number;
  name: string;
  email?: string | null;
};
