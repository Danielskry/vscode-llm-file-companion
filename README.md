# vscode-llm-file-companion


[![VS Marketplace Version](https://badgen.net/vs-marketplace/v/Danielskry.llm-file-companion)](https://marketplace.visualstudio.com/items?itemName=Danielskry.llm-file-companion)
[![VS Marketplace Installs](https://badgen.net/vs-marketplace/i/Danielskry.llm-file-companion)](https://marketplace.visualstudio.com/items?itemName=Danielskry.llm-file-companion)

**vscode-llm-file-companion** is a Visual Studio Code extension that simplifies aggregating file contents into a single document for use with large language models (LLMs). It collects text-based files (like `.py`, `.md`, `.js`, `.html`, `.java`, etc.) along with metadata from your workspace and appends them into one document (`LLM_doc.txt` by default, but customizable). The extension automatically skips binary or non-readable files.

---

## Features

- **Aggregate Files into a Single Document**  
  Append readable text-based files into one document (defaults to `LLM_doc.txt`). 
- **Multi-Select Support**  
  Select any combination of files and directories in the Explorer and append them all at once.
- **Workspace Tree & Metadata**  
  Automatically regenerates a project overview (name, counts, tree structure) at the top of the document with configurable verbosity.
- **Gitignore / .llmignore Aware**  
  Automatically skips any files/folders ignored by your workspace `.gitignore` or custom `.llmignore`.
- **Skip Binary or Non-Readable Files**  
  Automatically detects and skips files with binary or non-printable content.  
- **Support for Multiple File Types**  
  Compatible with popular formats like `.py`, `.md`, `.js`, `.html`, `.java`, and more.  
- **Automatic Document Creation**  
  Automatically creates the configured output file at the root of your workspace if it doesn't already exist.  


---

## Example Workflow

1. Select one or more files/directories in your workspace (multi-select works via Ctrl/Cmd+click).  
2. Right-click the selection (or simply run the command from the palette with nothing selected to process the entire workspace).  
3. Choose **"Append File to LLM Doc"** to regenerate the project overview header and append readable content into your configured document.  

## Extension Settings

No configuration is required. The extension works automatically with your workspace files.  

---

## Release Notes

### **Version 1.0.0**
- Initial release with core features:
  - Basic file appending functionality.
  - Automatic skipping of binary and non-readable files.
  - Auto-creation of the configured document if it does not exist.
  - Enhanced error handling for unreadable files.
  - Improved notifications for skipped files.

---

## Installation

### From VS Code Marketplace:
1. Open Visual Studio Code.  
2. Go to the **Extensions View** by clicking the Extensions icon in the Activity Bar.  
3. Search for **LLM File Companion** and click **Install**.  

### From the Command Line:
Run the following command to install the extension:  
```bash
code --install-extension vscode-llm-file-companion
```

---

## Usage

### 1. Append File to LLM Doc
- Select one or many files/directories (or the entire workspace folder) in the Explorer, *or* run the command from the Command Palette with no selection to target the workspace root automatically.  
- Right-click and choose **"Append File to LLM Doc"** (or trigger it from the palette).  
- The project metadata + tree header is refreshed and readable files are appended to your configured document.  

### 2. Open LLM Doc
- Use the **"Open LLM Doc"** command to access the configured document where all aggregated content is stored.  

### 3. Refresh LLM Doc Overview
- Run **"Refresh LLM Doc Overview"** from the Command Palette to rebuild the metadata/tree header without appending any files.

## Configuration

Fine-tune the project overview by searching for **"LLM File Companion"** in VS Code settings or editing your settings JSON directly:

- `llmFileCompanion.output.filePath` - change the destination document (relative to the workspace or absolute).  
- `llmFileCompanion.projectOverview.enabled` - master switch for prepending the overview block.  
- `llmFileCompanion.projectOverview.includeMetadata` - toggle workspace metadata (name, path, counts, timestamp).  
- `llmFileCompanion.projectOverview.includeTree` - toggle the ASCII tree diagram.  
- `llmFileCompanion.projectOverview.template` - pick the overview style (full, metadata-only, tree-only, summary).  
- `llmFileCompanion.projectOverview.treeMaxDepth` - limit how deep the tree expands (set to `0` for unlimited; counts follow the same depth).  
- `llmFileCompanion.projectOverview.treeMaxEntriesPerDirectory` - cap how many items appear per directory before a `(+N more...)` summary line is shown.  
- `llmFileCompanion.projectOverview.excludedNames` - list of folder/file name patterns (supports `*` wildcards) to ignore in the tree (e.g., `.venv`, `dist`, `*.log`).  

Disable both metadata and tree to append raw file contents without any overview.

---

**Enjoy using vscode-llm-file-companion!**  
Feel free to share your feedback or report issues.  











