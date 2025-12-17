export type StudentRow = {
  id: number;
  name: string;
  registrationNumber: string;
  birthDate: string;
  cpf: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  guardians: {
    guardianId: number;
    guardianName: string;
    guardianCpf: string | null;
    guardianPhone: string | null;
    relationship: string;
    isPrimary: boolean;
    isFinancial: boolean;
    livesWithStudent: boolean;
  }[];
};
