import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder, TextEncoder } from 'util';

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "LLM File Companion" is now active!');

  const appendFileOrDirCmd = vscode.commands.registerCommand(
    'extension.appendFileToLLMDoc',
    async (fileUri: vscode.Uri) => {
      vscode.window.showInformationMessage('appendFileToLLMDoc invoked!');
      console.log('Command invoked with argument:', fileUri);

      if (!fileUri) {
        vscode.window.showWarningMessage('No file or directory provided to append.');
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        vscode.window.showErrorMessage(
          'You must have a workspace/folder open to use this extension.'
        );
        return;
      }

      try {
        const stat = await vscode.workspace.fs.stat(fileUri);
        let urisToRead: vscode.Uri[] = [];
        let isDirectory = false;

        if (stat.type === vscode.FileType.Directory) {
          isDirectory = true;
          urisToRead = await collectAllFilesInDirectory(fileUri);
        } else if (stat.type === vscode.FileType.File) {
          urisToRead = [fileUri];
        } else {
          vscode.window.showWarningMessage('Selected item is neither file nor folder.');
          return;
        }

        const docUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'LLM_doc.txt');
        let existingDoc = '';
        try {
          const existingBytes = await vscode.workspace.fs.readFile(docUri);
          existingDoc = new TextDecoder().decode(existingBytes);
        } catch {
          console.log('No existing LLM_doc.txt found; creating a new one.');
        }

        let appendedText = '';
        for (const uri of urisToRead) {
          try {
            const fileContentBytes = await vscode.workspace.fs.readFile(uri);
            const fileContent = new TextDecoder().decode(fileContentBytes);

            // Skip files that contain binary-like content
            if (isBinaryContent(fileContent)) {
              console.warn(`Skipping binary or unreadable file: ${uri.fsPath}`);
              continue;
            }

            const filePath = uri.fsPath;
            const relativePath = path.relative(workspaceFolders[0].uri.fsPath, filePath);
            const fileName = path.basename(filePath);

            appendedText +=
              `\n--- START FILE ---\n` +
              `Filename: ${fileName}\n` +
              `Path: ${relativePath}\n` +
              `--- FILE CONTENT ---\n` +
              fileContent +
              `\n--- END FILE ---\n`;
          } catch (err: any) {
            console.warn(`Skipping unreadable file: ${uri.fsPath}. Reason: ${err.message}`);
          }
        }

        if (!appendedText) {
          vscode.window.showWarningMessage('No valid text-based files to append.');
          return;
        }

        const newDocContent = existingDoc + appendedText;

        await vscode.workspace.fs.writeFile(
          docUri,
          new TextEncoder().encode(newDocContent)
        );

        await vscode.commands.executeCommand('vscode.open', docUri);

        if (isDirectory) {
          vscode.window.showInformationMessage(
            `Appended readable text-based files (${urisToRead.length}) from the directory to LLM_doc.txt`
          );
        } else {
          const fileName = path.basename(fileUri.fsPath);
          vscode.window.showInformationMessage(
            `Appended readable file "${fileName}" to LLM_doc.txt`
          );
        }
      } catch (err: any) {
        vscode.window.showErrorMessage(`Error appending: ${err.message}`);
      }
    }
  );

  const openDocCmd = vscode.commands.registerCommand('extension.openLLMDoc', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage(
        'No workspace open. Cannot open LLM_doc.txt.'
      );
      return;
    }

    const docUri = vscode.Uri.joinPath(workspaceFolders[0].uri, 'LLM_doc.txt');

    try {
      try {
        await vscode.workspace.fs.stat(docUri);
      } catch {
        await vscode.workspace.fs.writeFile(docUri, new Uint8Array());
      }

      await vscode.commands.executeCommand('vscode.open', docUri);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Could not open LLM_doc.txt: ${err.message}`);
    }
  });

  context.subscriptions.push(appendFileOrDirCmd, openDocCmd);
}

export function deactivate() {
  console.log('Extension "LLM File Companion" is now deactivated.');
}

async function collectAllFilesInDirectory(dirUri: vscode.Uri): Promise<vscode.Uri[]> {
  let results: vscode.Uri[] = [];
  const entries = await vscode.workspace.fs.readDirectory(dirUri);
  for (const [name, fileType] of entries) {
    const childUri = vscode.Uri.joinPath(dirUri, name);
    if (fileType === vscode.FileType.Directory) {
      const subFiles = await collectAllFilesInDirectory(childUri);
      results = results.concat(subFiles);
    } else if (fileType === vscode.FileType.File) {
      results.push(childUri);
    }
  }
  return results;
}

// Helper function to determine if content is binary
function isBinaryContent(content: string): boolean {
  const binaryThreshold = 0.1; // Allow up to 10% non-printable characters
  const length = content.length;
  let binaryCount = 0;

  for (const char of content) {
    if (char.charCodeAt(0) < 32 && !['\n', '\r', '\t'].includes(char)) {
      binaryCount++;
    }
  }

  return binaryCount / length > binaryThreshold;
}
