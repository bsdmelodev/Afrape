export type EnrollmentRow = {
  id: number;
  studentId: number;
  classGroupId: number;
  studentName: string;
  classGroupName: string;
  status: string;
  enrolledAt: string;
  leftAt: string;
  createdAt: string;
};

export type Option = {
  id: number;
  label: string;
};
