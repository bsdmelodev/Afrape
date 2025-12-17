export type TermGradeRow = {
  id: number;
  enrollmentId: number;
  enrollmentLabel: string;
  studentName: string;
  classGroupName: string;
  classGroupYear: number;
  classSubjectId: number;
  classSubjectName: string;
  termId: number;
  termName: string;
  grade: number | null;
  absencesCount: number;
  attendancePercentage: number | null;
  isClosed: boolean;
  createdAt: string;
};

export type TermGradeEnrollmentOption = {
  id: number;
  label: string;
};

export type TermGradeClassSubjectOption = {
  id: number;
  label: string;
};

export type TermGradeTermOption = {
  id: number;
  label: string;
};
