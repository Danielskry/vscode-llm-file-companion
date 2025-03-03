# vscode-llm-file-companion


[![VS Marketplace Version](https://badgen.net/vs-marketplace/v/Danielskry.llm-file-companion)](https://marketplace.visualstudio.com/items?itemName=Danielskry.llm-file-companion)
[![VS Marketplace Installs](https://badgen.net/vs-marketplace/i/Danielskry.llm-file-companion)](https://marketplace.visualstudio.com/items?itemName=Danielskry.llm-file-companion)

**vscode-llm-file-companion** is a Visual Studio Code extension that simplifies aggregating file contents into a single document for use with large language models (LLMs). It collects text-based files (like `.py`, `.md`, `.js`, `.html`, `.java`, etc.) along with metadata from your workspace and appends them into an `LLM_doc.txt` file. The extension automatically skips binary or non-readable files.

---

## Features

- **Aggregate Files into a Single Document**  
  Append readable text-based files into `LLM_doc.txt`. 
- **Skip Binary or Non-Readable Files**  
  Automatically detects and skips files with binary or non-printable content.  
- **Support for Multiple File Types**  
  Compatible with popular formats like `.py`, `.md`, `.js`, `.html`, `.java`, and more.  
- **Automatic Creation of `LLM_doc.txt`**  
  Automatically creates the `LLM_doc.txt` file at the root of your workspace if it doesn’t already exist.  

---

## Example Workflow

1. Right-click on a file or directory within your workspace.  
2. Select **"Append File to LLM Doc"** from the context menu.  
3. The contents of readable files will be appended to a new or existing `LLM_doc.txt` file.  

## Extension Settings

No configuration is required. The extension works automatically with your workspace files.  

---

## Release Notes

### **Version 1.0.0**
- Initial release with core features:
  - Basic file appending functionality.
  - Automatic skipping of binary and non-readable files.
  - Auto-creation of `LLM_doc.txt` if it does not exist.
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
- Right-click a file or directory in your workspace.  
- Select **"Append File to LLM Doc"** from the context menu.  
- The content of readable files will be appended to `LLM_doc.txt`.  

### 2. Open LLM Doc
- Use the **"Open LLM Doc"** command to access the `LLM_doc.txt` file where all aggregated content is stored.  

---

**Enjoy using vscode-llm-file-companion!**  
Feel free to share your feedback or report issues.  
