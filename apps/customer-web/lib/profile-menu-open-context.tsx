'use client';

import { createContext, useContext } from 'react';

const ProfileMenuOpenContext = createContext(false);

export const ProfileMenuOpenProvider = ProfileMenuOpenContext.Provider;

export function useProfileMenuOpen(): boolean {
  return useContext(ProfileMenuOpenContext);
}
