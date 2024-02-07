// userSlice.ts
import type {PayloadAction} from '@reduxjs/toolkit';
import {createSlice} from '@reduxjs/toolkit';
import {initialMembershipState, type MembershipState} from '../interface/membership';

interface UserState {
  membership: MembershipState;
  membershipLoading?: boolean;
}

const initialState: UserState = {
  membership: initialMembershipState,
  membershipLoading: false,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setMembership: (state, action: PayloadAction<MembershipState>) => {
      state.membership = action.payload;
    },
    setMembershipLoading: (state, action: PayloadAction<boolean>) => {
      state.membershipLoading = action.payload;
    },
    // 可以根据需要添加更多动作
  },
});

export const {setMembership, setMembershipLoading} = userSlice.actions;

export default userSlice.reducer;
