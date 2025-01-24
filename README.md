# vscode-llm-file-companion

vscode-llm-file-companion is a Visual Studio Code extension that allows you to effortlessly append file contents into a single document, making it easy to aggregate context for feeding into large language models (LLMs). It allows you to collect text-based files (like `.py`, `.md`, `.js`, `.html`, `.java`, etc.) with metadata from your workspace and append them into an `LLM_doc.txt` file for documentation, processing, or further manipulation in LLMs. The extension skips binary or non-readable files.

## Features
    - **Append Files to LLM Document:** Select files or directories and append readable text-based files into a single document (`LLM_doc.txt`).
    - **Skip Non-Readable/Binary Files:** Automatically skips files that are binary or contain non-printable characters.
    - **Support for Multiple File Types:** Supports `.py`, `.md`, `.js`, `.html`, `.java`, and other text-based file formats.
    - **Workspace Integration:** Works directly within your VS Code workspace, appending files from any folder within the workspace.
    - **Automatic Creation of `LLM_doc.txt`:** If the LLM_doc.txt file doesn’t already exist, it will be created automatically at root.

## Example Workflow:
    - Right-click on a file or directory within your workspace.
    - Choose "Append File to LLM Doc" from the context menu.
    - The contents of readable files are appended into a new or existing `LLM_doc.txt` file.

## Requirements
    - **VS Code 1.50+:** This extension is designed to work with recent versions of Visual Studio Code.
    - **Workspace/Folders:** A workspace must be open in VS Code to use the extension.

## Extension Settings

Currently, there are no specific settings to configure for this extension. The extension works automatically with your workspace files.

## Release Notes
**1.0.0**
    - Initial release with basic file appending functionality.
    - Support for skipping binary and non-readable files.
    - Automatically creates LLM_doc.txt if it does not exist.
    - Improved error handling for unreadable files.
    - Enhanced message notifications for skipped files.

## Installation
    - Open VS Code.
    - Go to the Extensions view by clicking the Extensions icon in the Activity Bar on the side of the window.
    - Search for vscode-llm-file-companion and click Install.

Alternatively, you can install the extension from the terminal:

code --install-extension vscode-llm-file-companion

## How to Use
### 1. Append File to LLM Doc
    - Right-click a file or directory in your workspace.
    - Select Append File to LLM Doc from the context menu.
    - The content of readable files will be appended to a LLM_doc.txt document located in your workspace.

### 2. Open LLM Doc
    - Run the Open LLM Doc command to open the LLM_doc.txt file, where all appended file contents are stored.

**Enjoy using vscode-llm-file-companion!**
