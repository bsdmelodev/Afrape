export type GuardianRow = {
  id: number;
  name: string;
  cpf: string;
  email: string | null;
  phone: string | null;
  createdAt: string;
  students: {
    id: number;
    name: string;
    registrationNumber: string;
  }[];
};
