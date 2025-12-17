export type UserRow = {
  id: number;
  name: string;
  email: string;
  groupId: number;
  groupName: string;
  isActive: boolean;
  cpf?: string | null;
  phone?: string | null;
  createdAt: string;
  lastLoginAt: string;
  avatarUrl?: string | null;
};

export type GroupOption = {
  id: number;
  name: string;
};
