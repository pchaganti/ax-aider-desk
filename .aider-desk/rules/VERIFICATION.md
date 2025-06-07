## Verification Process

1.  **Lint and Type-Check Files:** After finalizing edits or writing new files, perform the following type-checking steps:
    - For main process files: `tsc --noEmit -p tsconfig.main.json`
    - For renderer process files: `tsc --noEmit -p tsconfig.renderer.json`
    - For common/shared files: `tsc --noEmit -p tsconfig.common.json`
    - Execute `eslint --fix` on all modified files to identify and automatically fix any linting errors.

2.  **Resolve Errors Iteratively:** Address all errors reported in the previous type-checking and linting steps. Repeat the type-checking and linting process until no errors remain.

3.  **Handle Irresolvable Issues:** If you are unable to resolve an issue after multiple attempts and find yourself in a repetitive loop, stop the process immediately. Clearly state the unresolved issue and ask the user for guidance on the next steps.

**Note:** Always use the `--noEmit` flag with `tsc` to perform type-checking without generating output files. Use the appropriate tsconfig.json file based on the module type being checked.
