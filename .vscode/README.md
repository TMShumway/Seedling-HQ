# VS Code Setup for Seedling HQ

This project uses Yarn PnP (Plug'n'Play) which requires special configuration for VS Code to work properly.

## Required Setup

1. **Install Recommended Extensions**: 
   When you open this workspace, VS Code should prompt you to install recommended extensions. Click "Install" to install them all, especially:
   - `ZipFS` (arcanis.vscode-zipfs) - Required for Yarn PnP support
   - `TypeScript Importer` (ms-vscode.vscode-typescript-next)

2. **Select TypeScript Version**:
   - Open any `.ts` file
   - Press `Ctrl+Shift+P` (or `Cmd+Shift+P` on Mac)
   - Type "TypeScript: Select TypeScript Version"
   - Choose "Use Workspace Version" (should show the version from `.yarn/sdks/typescript`)

3. **Reload VS Code**:
   After installing extensions and selecting the TypeScript version, reload the window:
   - `Ctrl+Shift+P` → "Developer: Reload Window"

## Troubleshooting

If you're still seeing TypeScript errors in the IDE:

1. **Check TypeScript Version**: Make sure you're using the workspace TypeScript version, not the globally installed one
2. **Restart TypeScript Server**: `Ctrl+Shift+P` → "TypeScript: Restart TS Server"
3. **Check Output Panel**: View → Output → Select "TypeScript" from dropdown to see detailed error messages
4. **Regenerate SDKs**: If needed, run `yarn dlx @yarnpkg/sdks vscode` from the project root

## How This Works

- `.yarn/sdks/` contains TypeScript language server wrappers that work with Yarn PnP
- `.vscode/settings.json` configures VS Code to use these SDKs
- The ZipFS extension allows VS Code to read files from Yarn's compressed cache
