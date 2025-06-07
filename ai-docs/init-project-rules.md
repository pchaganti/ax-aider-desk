# /init Command Feature Specification

## Overview

This document specifies the implementation of the `/init` command feature that allows users to initialize a PROJECT.md rule file with project information. The command is restricted to Agent mode only and provides guided setup for project-specific rules.

## Requirements

### 1. Command Availability
- The `/init` command MUST only be available in Agent mode
- When the prompt field is in any mode other than Agent, the command MUST show a chip with text "Only in Agent mode"
- If executed in non-Agent mode, it MUST show an error notification instructing the user to switch to Agent mode first

### 2. Command Description
- The command description SHOULD be "Initializes PROJECT.md rule file with project information" or similar

### 3. Command Execution Flow
When executed in Agent mode, the `/init` command MUST:

1. Call `window.api.initProjectRulesFile` which will call `project.initRulesFile`
2. Inside the function, call `runAgent` with the `INIT_PROJECT_RULES_AGENT_PROFILE`, but replace `provider` and `model` properties with the active profile values
3. After the run completes, check if the file `.aider-desk/rules/PROJECT.md` has been created
4. If the file exists, ask the question "Do you want to add this file as Aider's read-only context file for the future (into .aider.conf.yml)?"
5. If the answer is yes, update or create `.aider.conf.yml` in project baseDir and add `- .aider-desk/rules/PROJECT.md` into the `read:` section using the `yaml` npm library

## Technical Implementation

### Files to Modify/Create

#### 1. Frontend (Renderer Process)
- **PromptField.tsx**: Add `/init` command handling with mode restriction
- **Translation files**: Add new translation keys for command description and error messages

#### 2. Backend (Main Process)
- **project.ts**: Add `initProjectRulesFile` method
- **preload/index.ts and preload/index.d.ts**: Add `initProjectRulesFile` to the API interface

#### 3. Agent Integration
- Use existing `INIT_PROJECT_RULES_AGENT_PROFILE` from `src/common/agent.ts`
- Merge active profile's provider and model settings

#### 4. File Management
- Check for `.aider-desk/rules/PROJECT.md` existence
- Use `yaml` npm library for `.aider.conf.yml` manipulation
- Handle both creation and updating of the YAML file

### Implementation Details

#### Command Validation
```typescript
// In PromptField.tsx executeCommand function
case '/init': {
  if (mode !== 'agent') {
    showErrorNotification(t('promptField.initCommandAgentModeOnly'));
    return;
  }
  prepareForNextPrompt();
  window.api.initProjectRulesFile(baseDir);
  break;
}
```

#### Mode Restriction UI
- Add chip display logic when command is typed but mode is not Agent
- Use existing chip component pattern from the codebase

#### API Method Signature
```typescript
// In preload/index.ts
initProjectRulesFile: (baseDir: string) => Promise<void>
```

#### Project Method Implementation
```typescript
// In project.ts
async initProjectRulesFile(): Promise<void> {
  // 1. Get active agent profile
  // 2. Create modified INIT_PROJECT_RULES_AGENT_PROFILE with active provider/model
  // 3. Call runAgent with the modified profile
  // 4. Check for PROJECT.md file creation
  // 5. Ask question about adding to .aider.conf.yml
  // 6. Handle YAML file update if confirmed
}
```

#### YAML File Handling
- Use `yaml` npm library to parse/stringify `.aider.conf.yml`
- Add to `read:` section array, creating the section if it doesn't exist
- Handle file creation if `.aider.conf.yml` doesn't exist

Usage example:
```
# file.yml
YAML:
  - A human-readable data serialization language
  - https://en.wikipedia.org/wiki/YAML
yaml:
  - A complete JavaScript implementation
  - https://www.npmjs.com/package/yaml
```
```
import fs from 'fs'
import YAML from 'yaml'

YAML.parse('3.14159')
// 3.14159

YAML.parse('[ true, false, maybe, null ]\n')
// [ true, false, 'maybe', null ]

const file = fs.readFileSync('./file.yml', 'utf8')
YAML.parse(file)
// { YAML:
//   [ 'A human-readable data serialization language',
//     'https://en.wikipedia.org/wiki/YAML' ],
//   yaml:
//   [ 'A complete JavaScript implementation',
//     'https://www.npmjs.com/package/yaml' ] }
```
```
import YAML from 'yaml'

YAML.stringify(3.14159)
// '3.14159\n'

YAML.stringify([true, false, 'maybe', null])
// `- true
// - false
// - maybe
// - null
// `

YAML.stringify({ number: 3, plain: 'string', block: 'two\nlines\n' })
// `number: 3
// plain: string
// block: |
//   two
//   lines
// `
```

### Translation Keys
Add to `src/common/locales/en.json` and `src/common/locales/zh.json`:
```json
{
  "commands": {
    "init": {
      "description": "Initializes PROJECT.md rule file with project information",
      "agentModeOnly": "Only in Agent mode"
    }
  },
  "promptField": {
    "initCommandAgentModeOnly": "The /init command is only available in Agent mode. Please switch to Agent mode first."
  },
  "project": {
    "addProjectRulesToAider": "Do you want to add this file as read-only file for Aider (in .aider.conf.yml)?"
  }
}
```

### Error Handling
- Handle cases where agent run fails
- Handle file system errors when creating/updating files
- Provide meaningful error messages to the user
- Gracefully handle YAML parsing errors

### Dependencies
- Ensure `yaml` npm package is available

