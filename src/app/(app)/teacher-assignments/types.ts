export type AssignmentRow = {
  id: number;
  classSubjectId: number;
  classSubjectName: string;
  classGroupName: string;
  classGroupYear: number;
  teacherId: number;
  teacherName: string;
  teacherEmail: string | null;
  role: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
};

export type AssignmentClassSubjectOption = {
  id: number;
  label: string;
};

export type AssignmentTeacherOption = {
  id: number;
  name: string;
  email: string | null;
};
