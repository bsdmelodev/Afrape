export type ClassSubjectRow = {
  id: number;
  classGroupId: number;
  classGroupName: string;
  classGroupYear: number;
  subjectId: number;
  subjectName: string;
  subjectCode: string | null;
  workloadMinutes: number | null;
  createdAt: string;
};

export type ClassGroupOption = {
  id: number;
  name: string;
  schoolYear: number;
};

export type SubjectOption = {
  id: number;
  name: string;
  code: string | null;
};
