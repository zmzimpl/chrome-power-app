// interfaces.ts
export interface MembershipState {
  userId: string;
  level: string;
  startAt: string;
  expiredAt: string;
  createdAt: string;
  windowsLimit?: number;
  windowsUsed?: number;
  agree?: boolean;
}

// 初始化状态
export const initialMembershipState: MembershipState = {
  userId: '',
  level: '',
  startAt: '',
  expiredAt: '',
  createdAt: '',
  windowsLimit: 10,
  windowsUsed: 0,
};
