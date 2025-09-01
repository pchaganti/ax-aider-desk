import { createContext, useMemo, ReactNode, useContext } from 'react';
import { ApplicationAPI } from '@common/api';

import { BrowserApi } from '@/api/browser-api';

export const ApiContext = createContext<ApplicationAPI | undefined>(undefined);

export const ApiProvider = ({ children }: { children: ReactNode }) => {
  const api = useMemo<ApplicationAPI>(() => {
    if (window.api) {
      return window.api;
    }
    return new BrowserApi();
  }, []);

  return <ApiContext.Provider value={api}>{children}</ApiContext.Provider>;
};

export const useApi = (): ApplicationAPI => {
  const api = useContext(ApiContext);
  if (!api) {
    throw new Error('useApi must be used within an ApiProvider');
  }
  return api;
};
