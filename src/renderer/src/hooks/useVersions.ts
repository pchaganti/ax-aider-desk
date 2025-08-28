import { VersionsInfo } from '@common/types';
import { useCallback, useEffect, useState } from 'react';

export const useVersions = () => {
  const [versions, setVersions] = useState<VersionsInfo | null>(null);

  const loadVersions = useCallback(async (forceRefresh = false) => {
    setVersions(null);

    try {
      setVersions({
        ...(await window.api.getVersions(forceRefresh)),
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch versions:', error);
      // Optionally set versions to indicate an error or keep them null
      setVersions({ aiderDeskCurrentVersion: 'Error', aiderCurrentVersion: 'Error' });
    }
  }, []);

  const checkForUpdates = useCallback(async () => loadVersions(true), [loadVersions]);

  useEffect(() => {
    void loadVersions();

    const removeListener = window.api.addVersionsInfoUpdatedListener((_event, data) => {
      setVersions(data);
    });

    return () => {
      removeListener();
    };
  }, [loadVersions]);

  return { versions, checkForUpdates };
};
