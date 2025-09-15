import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Model, ProviderModels } from '@common/types';
import { LlmProviderName } from '@common/agent';

import { useApi } from '@/context/ApiContext';

type ModelProviderContextType = {
  refresh: () => void;
  getModels: (provider: LlmProviderName) => Model[] | undefined;
  loading: boolean;
  error: string | null;
};

const ModelProviderContext = createContext<ModelProviderContextType | null>(null);

export const ModelProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const api = useApi();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerModels, setProviderModels] = useState<ProviderModels>({});

  const loadModels = useCallback(async () => {
    setProviderModels((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const data = await api.getProviderModels();
      setProviderModels({
        ...data,
      });
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to load models');
    } finally {
      setLoading(false);
    }
  }, [api]);

  const refresh = useCallback(() => {
    void loadModels();
  }, [loadModels]);

  const getModels = useCallback(
    (provider: LlmProviderName): Model[] | undefined => {
      return providerModels[provider];
    },
    [providerModels],
  );

  useEffect(() => {
    void loadModels();
  }, [loadModels]);

  useEffect(() => {
    return api.addProviderModelsUpdatedListener((data) => {
      setProviderModels({
        ...data,
      });
    });
  }, [api, loadModels]);

  return (
    <ModelProviderContext.Provider
      value={{
        ...providerModels,
        loading,
        error,
        refresh,
        getModels,
      }}
    >
      {children}
    </ModelProviderContext.Provider>
  );
};

export const useModels = (): ModelProviderContextType => {
  const context = useContext(ModelProviderContext);
  if (!context) {
    throw new Error('useModels must be used within a ModelProvider');
  }
  return context;
};
