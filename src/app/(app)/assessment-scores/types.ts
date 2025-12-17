export type ScoreRow = {
  assessmentId: number;
  enrollmentId: number;
  assessmentTitle: string;
  assessmentDate: string;
  classGroupName: string;
  classGroupYear: number;
  subjectName: string;
  studentName: string;
  registrationNumber: string | null;
  score: number | null;
  isAbsent: boolean;
  isExcused: boolean;
  notes: string | null;
  createdAt: string;
};

export type AssessmentOption = {
  id: number;
  label: string;
};

export type EnrollmentOption = {
  id: number;
  label: string;
};
