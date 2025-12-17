export type AssessmentRow = {
  id: number;
  classSubjectId: number;
  classSubjectName: string;
  classGroupName: string;
  classGroupYear: number;
  termId: number;
  termName: string;
  title: string;
  assessmentType: string;
  assessmentDate: string;
  weight: number;
  maxScore: number;
  isPublished: boolean;
  createdByTeacherId: number;
  createdByTeacherName: string;
  createdAt: string;
};

export type AssessmentClassSubjectOption = {
  id: number;
  label: string;
};

export type AssessmentTermOption = {
  id: number;
  name: string;
  schoolYear: number;
};

export type AssessmentTeacherOption = {
  id: number;
  name: string;
};
