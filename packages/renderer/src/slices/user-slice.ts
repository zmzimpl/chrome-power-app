// userSlice.ts
import type {PayloadAction} from '@reduxjs/toolkit';
import {createSlice} from '@reduxjs/toolkit';
import {initialMembershipState, type MembershipState} from '../interface/membership';

interface UserState {
  membership: MembershipState;
}

const initialState: UserState = {
  membership: initialMembershipState,
};

const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setMembership: (state, action: PayloadAction<MembershipState>) => {
      state.membership = action.payload;
    },
    // 可以根据需要添加更多动作
  },
});

export const {setMembership} = userSlice.actions;

export default userSlice.reducer;
