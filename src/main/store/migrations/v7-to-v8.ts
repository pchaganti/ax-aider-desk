import { AgentProfile, SettingsData } from '@common/types';

export const migrateV7ToV8 = (settings: SettingsData): SettingsData => {
  const updatedAgentProfiles: AgentProfile[] = settings.agentProfiles.map((profile) => {
    // Add temperature field with default value of 0.7 if it doesn't exist
    return {
      ...profile,
      temperature: profile.temperature ?? 0.1,
    };
  });

  return {
    ...settings,
    agentProfiles: updatedAgentProfiles,
  };
};
