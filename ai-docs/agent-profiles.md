# Product Requirements Document: Agent Profiles Feature

## 1. Introduction

This document outlines the requirements for the Agent Profiles feature in AiderDesk. Currently, all agent configuration settings (enabled MCP servers, tool usage flags, LLM provider, etc.) are stored as a single global configuration. This makes it difficult for users to quickly switch between different agent setups optimized for various tasks (e.g., code generation vs. general Q&A). The Agent Profiles feature will allow users to define, save, and easily switch between multiple distinct agent configurations.

## 2. Goals

*   Enable users to save and manage multiple agent configurations as named profiles.
*   Allow users to quickly switch between saved agent profiles from the main application UI.
*   Provide a dedicated interface for creating, editing, and deleting agent profiles.
*   Ensure a clear separation between global MCP server definitions and profile-specific settings (which servers are enabled, tool approvals, etc.).

## 3. User Stories

*   As a user, I want to create different agent profiles (e.g., "Coding Profile", "Research Profile") with specific settings so I can easily switch my agent's behavior.
*   As a user, I want to select an agent profile from a list to make it the active configuration.
*   As a user, I want to see the name of the currently active agent profile in the UI.
*   As a user, I want to edit the settings of an existing agent profile, including which global MCP servers are enabled, tool usage flags, LLM settings, etc.
*   As a user, I want to delete agent profiles that I no longer need (except for the "Default" profile).
*   As a user, I want to see a summary of the active profile's settings (like enabled servers and flags) from the main UI.
*   As a user, when editing an agent profile, I want to easily access the global settings for adding or configuring MCP servers.

## 4. Requirements

### 4.1. Functional Requirements

*   **Profile Management:**
    *   The application SHALL allow users to create new Agent Profiles with a unique name.
    *   The application SHALL allow users to delete existing Agent Profiles (with the exception of the "Default" profile).
    *   The application SHALL allow users to edit the settings of any saved Agent Profile.
    *   The application SHALL persist Agent Profiles across application sessions.
    *   A "Default" profile SHALL exist and it cannot be deleted. Its ID should be a well-known constant or deterministically generated.
*   **Profile Configuration:**
    *   Each Agent Profile SHALL store the following configuration settings:
        *   `id`: string (UUID, unique identifier)
        *   `name`: string
        *   `provider`: `LlmProviderName` (Active LLM provider name for this profile)
        *   `model`: `string` (Active LLM model for this profile)
        *   `maxIterations`: number
        *   `maxTokens`: number
        *   `minTimeBetweenToolCalls`: number (in milliseconds)
        *   `customInstructions`: string
        *   `includeContextFiles`: boolean
        *   `includeRepoMap`: boolean
        *   `usePowerTools`: boolean
        *   `useAiderTools`: boolean
        *   `enabledServers`: `string[]` (Which global servers are enabled in this profile, referencing keys from the global `mcpServers` map)
        *   `toolApprovals`: `Record<string, ToolApprovalState>` (Profile-specific tool approval states for tools belonging to global MCP servers).
    *   The definition of MCP servers (`mcpServers`: `Record<string, McpServerConfig>`) SHALL remain a global setting in `SettingsData`, not stored within individual profiles.
*   **Profile Selection:**
    *   The application SHALL allow users to select one Agent Profile as the currently active profile via `activeAgentProfileId` in `SettingsData`.
    *   All agent operations SHALL use the settings from the currently active profile.
    *   If the `activeAgentProfileId` in settings refers to a profile that no longer exists, the application SHALL fallback to using the "Default" profile.
*   **User Interface - Agent Selector (`AgentSelector.tsx`):**
    *   The component SHALL display the name of the currently active Agent Profile.
    *   Clicking the component SHALL open a popup/dropdown.
    *   The popup header SHALL display the name of the currently active profile and an indicator (e.g., arrow).
    *   Clicking the indicator in the popup header SHALL toggle the visibility of a detailed view for the *currently active* profile, showing its enabled/disabled global MCP servers and the state of `includeContextFiles`, `includeRepoMap`, `usePowerTools`, `useAiderTools` flags.
    *   The popup SHALL list all available Agent Profiles.
    *   Clicking a profile name in the list SHALL set it as the active profile (`activeAgentProfileId`) and close the popup.
    *   Each profile listed SHALL have an "edit" icon/button that opens the `AgentProfilesDialog` for that specific profile.
*   **User Interface - Agent Profiles Dialog (New Component `AgentProfilesDialog.tsx`):**
    *   A modal dialog SHALL be created for managing Agent Profiles.
    *   The dialog SHALL have a layout with a sidebar on the left listing all saved profiles.
    *   The sidebar SHALL include buttons/options to "Create New Profile" and "Delete Profile" (for the selected profile; "Default" profile cannot be deleted).
    *   Selecting a profile in the sidebar SHALL display its editable configuration settings in the main content area.
    *   The main content area SHALL include input fields/controls for all profile-specific settings listed in "Profile Configuration" above (LLM settings, iterations, tokens, instructions, tool usage flags).
    *   The main content area SHALL display the list of *globally defined* MCP servers (from `settings.mcpServers`). For each global server, it SHALL allow the user to toggle its inclusion in the current profile's `enabledServers` list.
    *   For each global server listed, the dialog SHALL display and allow editing the tool approval states (`toolApprovals`) *for the currently edited profile*. This will likely reuse the `McpServerItem` component logic.
    *   The dialog SHALL NOT provide functionality to add, edit, or delete the global MCP server configurations (command, args, env).
    *   The dialog SHALL include a button or link (e.g., "Manage Global Servers") that opens the main `SettingsDialog` with the Agent tab pre-selected, allowing users to manage the global `mcpServers` list.
    *   The dialog SHALL have "Save" and "Cancel" buttons to apply or discard changes to the edited profile.
*   **User Interface - Agent Settings (`AgentSettings.tsx`):**
    *   This component SHALL be simplified to primarily manage the global `mcpServers` list (add, edit, remove server configurations).
    *   Profile-specific settings UI elements SHALL be removed from `AgentSettings.tsx` and moved to `AgentProfilesDialog.tsx`.
*   **User Interface - Settings Dialog (`SettingsDialog.tsx`):**
    *   The Agent tab in the main `SettingsDialog` SHALL be updated to reflect the simplified `AgentSettings.tsx` content and potentially include a button to open the `AgentProfilesDialog`.
*   **Migration:**
    *   Upon the first launch after this feature is implemented, if `agentProfiles` is not present or empty in `SettingsData`:
        *   The application SHALL automatically create a "Default" Agent Profile.
        *   The "Default" profile's `id` SHALL be a newly generated UUID.
        *   The "Default" profile's `name` SHALL be "Default".
        *   The settings for this "Default" profile SHALL be migrated from the existing global `agentConfig` (e.g., `providers` becomes `provider`, `disabledServers` logic is inverted for `enabledServers`).
        *   This "Default" profile SHALL be added to `agentProfiles`.
        *   `activeAgentProfileId` SHALL be set to the ID of this new "Default" profile.
        *   The old `agentConfig` field in `SettingsData` SHALL be marked for removal or removed.

### 4.2. Non-Functional Requirements

*   Switching between profiles SHALL be fast and not require application restart.
*   The UI should clearly indicate which profile is active.
*   The profile management interface should be intuitive and easy to navigate.
*   Profile IDs (UUIDs) must be unique.

## 5. Data Model (Proposed Changes to `src/common/types.ts`)

```typescript
// Existing global MCP server config remains
export interface McpServerConfig {
  command: string;
  args: string[];
  env?: Readonly<Record<string, string>>;
}

// New AgentProfile interface
export interface AgentProfile {
  id: string; // Unique identifier (UUID)
  name: string;
  provider: LlmProvider | null; // Active LLM provider and its config for this profile
  maxIterations: number;
  maxTokens: number;
  minTimeBetweenToolCalls: number; // in milliseconds
  toolApprovals: Record<string, ToolApprovalState>; // Tool approvals are profile-specific
  includeContextFiles: boolean;
  includeRepoMap: boolean;
  usePowerTools: boolean;
  useAiderTools: boolean;
  customInstructions: string;
  enabledServers: string[]; // Keys of global McpServerConfig entries that are enabled for this profile
}

// Updated SettingsData interface
export interface SettingsData {
  // ... other existing settings (onboardingFinished, language, etc.)
  agentProfiles: AgentProfile[]; // Array of all saved profiles
  activeAgentProfileId: string | null; // ID of the currently active profile (or null if none, though should default)
  mcpServers: Record<string, McpServerConfig>; // Global MCP server definitions
  // The old agentConfig field will be removed or deprecated after migration
  // agentConfig?: AgentConfig; // To be removed after migration
  // ... other existing settings (aider, models, etc.)
}

// The existing AgentConfig interface will be removed.
// All its fields have moved into AgentProfile or are global (mcpServers).
```

## 6. Open Questions / Future Considerations

*   Consider adding profile duplication ("Clone Profile") functionality.
*   Consider export/import functionality for profiles.
*   Define a constant for the "Default" profile name if it needs to be programmatically referenced (e.g., for i18n or fallback logic).
```
