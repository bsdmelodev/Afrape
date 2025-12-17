export type TeacherRow = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userCpf: string | null;
  userPhone: string | null;
  isActive: boolean;
  createdAt: string;
};

export type UserOption = {
  id: number;
  name: string;
  email: string;
  cpf: string | null;
  phone: string | null;
  teacherId: number | null;
};
