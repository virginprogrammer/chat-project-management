import { configureStore } from '@reduxjs/toolkit';
import projectsReducer from './projectsSlice';
import messagesReducer from './messagesSlice';
import authReducer from './authSlice';

export const store = configureStore({
  reducer: {
    projects: projectsReducer,
    messages: messagesReducer,
    auth: authReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
