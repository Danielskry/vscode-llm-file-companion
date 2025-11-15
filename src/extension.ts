import * as vscode from 'vscode';
import * as path from 'path';
import { TextDecoder, TextEncoder } from 'util';
import ignore = require('ignore');

const PROJECT_OVERVIEW_START = '--- PROJECT OVERVIEW START ---';
const PROJECT_OVERVIEW_END = '--- PROJECT OVERVIEW END ---';
const DEFAULT_TREE_EXCLUSIONS = [
  'node_modules',
  '.git',
  '.vscode',
  'out',
  '.venv',
  'dist',
  'build',
  '__pycache__',
  '.idea',
  '.cache',
  '.next',
  '.turbo',
  '.DS_Store'
];

type OverviewTemplateMode = 'full' | 'metadataOnly' | 'treeOnly' | 'summary';

interface ProjectOverviewOptions {
  enabled: boolean;
  includeMetadata: boolean;
  includeTree: boolean;
  treeMaxDepth: number;
  treeMaxEntriesPerDirectory: number;
  excludedNames: string[];
  templateMode: OverviewTemplateMode;
}

interface ResolvedProjectOverviewOptions extends ProjectOverviewOptions {
  exclusionMatchers: RegExp[];
}

interface TreeBuildResult {
  lines: string[];
  fileCount: number;
  directoryCount: number;
  extensionCounts: Record<string, number>;
  excludedEntries: number;
}

type IgnoreMatcher = ReturnType<typeof ignore>;

interface PathFilterContext {
  rootPath: string;
  gitIgnore?: IgnoreMatcher;
  llmIgnore?: IgnoreMatcher;
  stats: {
    gitIgnored: number;
    llmIgnored: number;
  };
}

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "LLM File Companion" is now active!');

  const appendFileOrDirCmd = vscode.commands.registerCommand(
    'extension.appendFileToLLMDoc',
    async (fileUri: vscode.Uri, selectedUris?: vscode.Uri[]) => {
      await runAppendWorkflow({ fileUri, selectedUris, overviewOnly: false });
    }
  );

  const refreshOverviewCmd = vscode.commands.registerCommand(
    'extension.refreshLLMDocOverview',
    async () => {
      await runAppendWorkflow({ overviewOnly: true });
    }
  );

  const openDocCmd = vscode.commands.registerCommand('extension.openLLMDoc', async () => {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      vscode.window.showErrorMessage(
        'No workspace open. Cannot open the output document.'
      );
      return;
    }

    const docUri = getOutputDocumentUri(workspaceFolders[0].uri);

    try {
      try {
        await vscode.workspace.fs.stat(docUri);
      } catch {
        await vscode.workspace.fs.writeFile(docUri, new Uint8Array());
      }

      await vscode.commands.executeCommand('vscode.open', docUri);
    } catch (err: any) {
      vscode.window.showErrorMessage(`Could not open output document: ${err.message}`);
    }
  });

  context.subscriptions.push(appendFileOrDirCmd, refreshOverviewCmd, openDocCmd);
}

export function deactivate() {
  console.log('Extension "LLM File Companion" is now deactivated.');
}

async function runAppendWorkflow(params: {
  fileUri?: vscode.Uri;
  selectedUris?: vscode.Uri[];
  overviewOnly: boolean;
}): Promise<void> {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders) {
    vscode.window.showErrorMessage(
      'You must have a workspace/folder open to use this extension.'
    );
    return;
  }

  const workspaceRoot = workspaceFolders[0].uri;
  const progressTitle = params.overviewOnly
    ? 'LLM File Companion: Refreshing project overview...'
    : 'LLM File Companion: Appending selection...';

  try {
    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: progressTitle,
        cancellable: true
      },
      async (progress, token) => {
        await processAppendWorkflow({
          workspaceRoot,
          fileUri: params.fileUri,
          selectedUris: params.selectedUris,
          overviewOnly: params.overviewOnly,
          progress,
          token
        });
      }
    );
  } catch (err: any) {
    if (err instanceof vscode.CancellationError) {
      vscode.window.showInformationMessage('LLM File Companion: Operation cancelled.');
      return;
    }
    vscode.window.showErrorMessage(`Error appending: ${err?.message ?? err}`);
  }
}

interface AppendWorkflowArgs {
  workspaceRoot: vscode.Uri;
  fileUri?: vscode.Uri;
  selectedUris?: vscode.Uri[];
  overviewOnly: boolean;
  progress: vscode.Progress<{ message?: string; increment?: number }>;
  token: vscode.CancellationToken;
}

interface AppendWorkflowStats {
  appendedFiles: number;
  directoriesTouched: number;
  defaultedToWorkspace: boolean;
  binarySkipped: number;
}

async function processAppendWorkflow({
  workspaceRoot,
  fileUri,
  selectedUris,
  overviewOnly,
  progress,
  token
}: AppendWorkflowArgs): Promise<void> {
  const overviewOptions = resolveProjectOverviewOptions();
  const shouldPrependOverview =
    overviewOptions.enabled &&
    (overviewOptions.includeMetadata ||
      overviewOptions.includeTree ||
      overviewOptions.templateMode === 'summary');

  if (overviewOnly && !shouldPrependOverview) {
    vscode.window.showWarningMessage(
      'Project overview generation is disabled via settings.'
    );
    return;
  }

  const pathFilters = await buildPathFilterContext(workspaceRoot);
  const stats: AppendWorkflowStats = {
    appendedFiles: 0,
    directoriesTouched: 0,
    defaultedToWorkspace: false,
    binarySkipped: 0
  };

  let selectionTargets: vscode.Uri[] = [];
  if (!overviewOnly) {
    const candidates: vscode.Uri[] = [];
    if (selectedUris && selectedUris.length > 0) {
      candidates.push(...selectedUris);
    }
    if (fileUri) {
      candidates.push(fileUri);
    }
    selectionTargets = getUniqueSelection(candidates);

    if (selectionTargets.length === 0) {
      selectionTargets = [workspaceRoot];
      stats.defaultedToWorkspace = true;
    }
  }

  progress.report({ message: overviewOnly ? 'Preparing overview...' : 'Collecting files...' });

  let urisToRead: vscode.Uri[] = [];
  if (!overviewOnly) {
    urisToRead = await collectFilesFromSelection(
      selectionTargets,
      pathFilters,
      stats,
      progress,
      token
    );
  }

  if (urisToRead.length === 0 && !shouldPrependOverview) {
    vscode.window.showWarningMessage('No files found to append from the selected resources.');
    return;
  }

  const docUri = getOutputDocumentUri(workspaceRoot);
  const docDisplayName = path.basename(docUri.fsPath);

  progress.report({ message: 'Reading existing document...' });
  let existingDoc = '';
  try {
    const existingBytes = await vscode.workspace.fs.readFile(docUri);
    existingDoc = new TextDecoder().decode(existingBytes);
  } catch {
    console.log(`No existing ${docDisplayName} found; creating a new one.`);
  }

  const docWithoutOverview = stripExistingProjectOverview(existingDoc);
  let appendedText = '';

  if (!overviewOnly) {
    progress.report({ message: 'Reading selected files...' });
    for (const uri of urisToRead) {
      if (token.isCancellationRequested) {
        throw new vscode.CancellationError();
      }
      try {
        const fileContentBytes = await vscode.workspace.fs.readFile(uri);
        const fileContent = new TextDecoder().decode(fileContentBytes);

        if (isBinaryContent(fileContent)) {
          stats.binarySkipped++;
          console.warn(`Skipping binary or unreadable file: ${uri.fsPath}`);
          continue;
        }

        const filePath = uri.fsPath;
        const relativePath = path.relative(workspaceRoot.fsPath, filePath);
        const fileName = path.basename(filePath);

        appendedText +=
          `\n--- START FILE ---\n` +
          `Filename: ${fileName}\n` +
          `Path: ${relativePath}\n` +
          `--- FILE CONTENT ---\n` +
          fileContent +
          `\n--- END FILE ---\n`;
        stats.appendedFiles++;
      } catch (err: any) {
        console.warn(`Skipping unreadable file: ${uri.fsPath}. Reason: ${err.message}`);
      }
    }
  }

  const projectOverview = shouldPrependOverview
    ? await generateProjectOverview(workspaceRoot, overviewOptions, pathFilters, token)
    : '';

  if (!appendedText && !projectOverview) {
    vscode.window.showWarningMessage('No valid text-based files to append.');
    return;
  }

  const docBody = docWithoutOverview + appendedText;
  const normalizedDocBody =
    docBody && !docBody.startsWith('\n') ? `\n${docBody}` : docBody;
  const newDocContent = projectOverview ? projectOverview + (normalizedDocBody || '') : docBody;

  progress.report({ message: 'Writing document...' });
  await vscode.workspace.fs.writeFile(docUri, new TextEncoder().encode(newDocContent));
  await vscode.commands.executeCommand('vscode.open', docUri);

  const skipSummary = buildSkipSummary(pathFilters, stats);

  if (overviewOnly) {
    vscode.window.showInformationMessage(
      `Project overview refreshed in ${docDisplayName}${skipSummary ? ` ${skipSummary}` : ''}`
    );
    return;
  }

  if (stats.appendedFiles > 0) {
    const selectionMsg =
      stats.directoriesTouched > 0 || selectionTargets.length > 1 || stats.defaultedToWorkspace
        ? `from ${stats.defaultedToWorkspace ? 'the workspace root' : `${selectionTargets.length} selection(s)`}`
        : `for "${path.basename(urisToRead[0].fsPath)}"`;
    vscode.window.showInformationMessage(
      `Appended ${stats.appendedFiles} readable file(s) ${selectionMsg} to ${docDisplayName}${
        skipSummary ? ` ${skipSummary}` : ''
      }`
    );
  } else if (urisToRead.length > 0) {
    vscode.window.showInformationMessage(
      `Generated project overview, but all selected files were skipped (binary or unreadable).${
        skipSummary ? ` ${skipSummary}` : ''
      }`
    );
  } else {
    vscode.window.showInformationMessage(
      `Generated project overview for the workspace.${skipSummary ? ` ${skipSummary}` : ''}`
    );
  }
}
async function collectAllFilesInDirectory(
  dirUri: vscode.Uri,
  filters: PathFilterContext,
  token?: vscode.CancellationToken
): Promise<vscode.Uri[]> {
  if (token?.isCancellationRequested) {
    throw new vscode.CancellationError();
  }

  let results: vscode.Uri[] = [];
  const entries = await vscode.workspace.fs.readDirectory(dirUri);
  for (const [name, fileType] of entries) {
    if (token?.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    const childUri = vscode.Uri.joinPath(dirUri, name);
    if (shouldSkipPath(childUri.fsPath, filters)) {
      continue;
    }

    if (fileType === vscode.FileType.Directory) {
      const subFiles = await collectAllFilesInDirectory(childUri, filters, token);
      results = results.concat(subFiles);
    } else if (fileType === vscode.FileType.File) {
      results.push(childUri);
    }
  }
  return results;
}

async function collectFilesFromSelection(
  selectionTargets: vscode.Uri[],
  filters: PathFilterContext,
  stats: AppendWorkflowStats,
  progress: vscode.Progress<{ message?: string; increment?: number }>,
  token: vscode.CancellationToken
): Promise<vscode.Uri[]> {
  if (selectionTargets.length === 0) {
    return [];
  }

  let results: vscode.Uri[] = [];
  const uniqueTargets = getUniqueSelection(selectionTargets);

  for (let index = 0; index < uniqueTargets.length; index++) {
    if (token.isCancellationRequested) {
      throw new vscode.CancellationError();
    }
    const target = uniqueTargets[index];
    progress.report({
      message: `Collecting files (${index + 1}/${uniqueTargets.length})...`
    });

    if (shouldSkipPath(target.fsPath, filters)) {
      continue;
    }

    const stat = await vscode.workspace.fs.stat(target);
    if (stat.type === vscode.FileType.Directory) {
      stats.directoriesTouched++;
      const directoryFiles = await collectAllFilesInDirectory(target, filters, token);
      results = results.concat(directoryFiles);
    } else if (stat.type === vscode.FileType.File) {
      results.push(target);
    } else {
      console.warn(`Skipping item that is neither file nor directory: ${target.fsPath}`);
    }
  }

  return getUniqueSelection(results);
}

function getUniqueSelection(uris: vscode.Uri[]): vscode.Uri[] {
  const deduped: vscode.Uri[] = [];
  const seen = new Set<string>();

  for (const uri of uris) {
    if (!uri) {
      continue;
    }

    const normalizedPath = path.normalize(uri.fsPath);
    const key = process.platform === 'win32' ? normalizedPath.toLowerCase() : normalizedPath;

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    deduped.push(uri);
  }

  return deduped;
}

async function generateProjectOverview(
  rootUri: vscode.Uri,
  options: ResolvedProjectOverviewOptions,
  filters: PathFilterContext,
  token?: vscode.CancellationToken
): Promise<string> {
  if (!options.enabled) {
    return '';
  }

  const treeData = await buildWorkspaceTree(rootUri, options, filters, token);
  const workspaceName = path.basename(rootUri.fsPath) || rootUri.fsPath;
  const metadataLines: string[] = [PROJECT_OVERVIEW_START];
  const includeMetadata =
    options.includeMetadata && options.templateMode !== 'treeOnly';
  const includeTree = options.includeTree && options.templateMode !== 'metadataOnly';

  if (includeMetadata) {
    metadataLines.push(`Workspace Name: ${workspaceName}`);
    metadataLines.push(`Root Path: ${rootUri.fsPath}`);
    metadataLines.push(`Generated: ${new Date().toISOString()}`);
    metadataLines.push(`Total Directories: ${treeData.directoryCount}`);
    metadataLines.push(`Total Files: ${treeData.fileCount}`);
  }

  if (options.templateMode === 'summary' && includeMetadata) {
    const summaryLines = buildExtensionSummaryLines(treeData.extensionCounts);
    if (summaryLines.length) {
      metadataLines.push('', 'SUMMARY BY EXTENSION:', ...summaryLines);
    }
  }

  if (includeTree && treeData.lines.length > 0) {
    if (metadataLines.length > 1) {
      metadataLines.push('');
    }
    metadataLines.push('PROJECT TREE:');
    metadataLines.push(...treeData.lines);
  }

  if (treeData.excludedEntries > 0) {
    metadataLines.push('');
    metadataLines.push(`Filtered entries hidden: ${treeData.excludedEntries}`);
  }

  metadataLines.push(PROJECT_OVERVIEW_END, '');
  return metadataLines.join('\n');
}

async function buildWorkspaceTree(
  rootUri: vscode.Uri,
  options: ResolvedProjectOverviewOptions,
  filters: PathFilterContext,
  token?: vscode.CancellationToken
): Promise<TreeBuildResult> {
  const includeLines = options.includeTree;
  const lines: string[] = [];
  let fileCount = 0;
  let directoryCount = 1; // include workspace root
  let excludedEntries = 0;
  const extensionCounts = new Map<string, number>();
  const rootName = path.basename(rootUri.fsPath) || rootUri.fsPath;
  if (includeLines) {
    lines.push(`${rootName}/`);
  }

  async function traverseDirectory(dirUri: vscode.Uri, prefix: string, depth: number) {
    if (token?.isCancellationRequested) {
      throw new vscode.CancellationError();
    }

    const baseEntries = await vscode.workspace.fs.readDirectory(dirUri);
    const filteredEntries = baseEntries
      .map(([name, type]) => {
        const childUri = vscode.Uri.joinPath(dirUri, name);
        return { name, type, uri: childUri };
      })
      .filter(({ name, uri }) => {
        if (shouldExcludeFromTree(name, options)) {
          excludedEntries++;
          return false;
        }
        if (shouldSkipPath(uri.fsPath, filters)) {
          excludedEntries++;
          return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));

    const maxEntries = options.treeMaxEntriesPerDirectory;
    const limitedEntries =
      maxEntries > 0 ? filteredEntries.slice(0, maxEntries) : filteredEntries;
    const remainingEntries = filteredEntries.length - limitedEntries.length;
    const visibleEntries = limitedEntries.length + (remainingEntries > 0 ? 1 : 0);

    for (let i = 0; i < limitedEntries.length; i++) {
      const { name, type, uri } = limitedEntries[i];
      const isLast = i === visibleEntries - 1;
      const connector = isLast ? '+-- ' : '|-- ';
      const childPrefix = prefix + (isLast ? '    ' : '|   ');

      if (type === vscode.FileType.Directory) {
        directoryCount++;
        if (includeLines) {
          lines.push(`${prefix}${connector}${name}/`);
        }
        const nextDepth = depth + 1;
        if (options.treeMaxDepth <= 0 || nextDepth <= options.treeMaxDepth) {
          await traverseDirectory(uri, childPrefix, nextDepth);
        } else if (includeLines) {
          lines.push(`${childPrefix}+-- (depth limit reached)`);
        }
      } else if (type === vscode.FileType.File) {
        fileCount++;
        const ext = path.extname(name).toLowerCase() || '[no-ext]';
        extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);
        if (includeLines) {
          lines.push(`${prefix}${connector}${name}`);
        }
      }
    }

    if (remainingEntries > 0 && includeLines) {
      lines.push(`${prefix}+-- (+${remainingEntries} more item(s)...)`);
    }
  }

  await traverseDirectory(rootUri, '', 0);

  return {
    lines,
    fileCount,
    directoryCount,
    extensionCounts: Object.fromEntries(extensionCounts),
    excludedEntries
  };
}

function shouldExcludeFromTree(name: string, options: ResolvedProjectOverviewOptions): boolean {
  return options.exclusionMatchers.some((regex) => regex.test(name));
}

function buildExtensionSummaryLines(extensionCounts: Record<string, number>): string[] {
  const entries = Object.entries(extensionCounts);
  if (!entries.length) {
    return [];
  }

  const sorted = entries.sort((a, b) => b[1] - a[1]);
  const limit = 8;
  const lines = sorted.slice(0, limit).map(([ext, count]) => `- ${ext}: ${count} file(s)`);
  if (sorted.length > limit) {
    lines.push(`- (+${sorted.length - limit} other extension(s))`);
  }
  return lines;
}

function stripExistingProjectOverview(content: string): string {
  const startIdx = content.indexOf(PROJECT_OVERVIEW_START);
  const endIdx = content.indexOf(PROJECT_OVERVIEW_END);

  if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
    return content;
  }

  const afterEndIdx = endIdx + PROJECT_OVERVIEW_END.length;
  const remainder = content.slice(afterEndIdx);
  return remainder.replace(/^\s*\n?/, '');
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

function resolveProjectOverviewOptions(): ResolvedProjectOverviewOptions {
  const config = vscode.workspace.getConfiguration('llmFileCompanion');
  const enabled = config.get<boolean>('projectOverview.enabled', true);
  const includeMetadata = config.get<boolean>('projectOverview.includeMetadata', true);
  const includeTree = config.get<boolean>('projectOverview.includeTree', true);
  const treeMaxDepth = config.get<number>('projectOverview.treeMaxDepth', 3);
  const treeMaxEntriesPerDirectory = config.get<number>(
    'projectOverview.treeMaxEntriesPerDirectory',
    30
  );
  const excludedNames = config.get<string[]>(
    'projectOverview.excludedNames',
    DEFAULT_TREE_EXCLUSIONS
  );
  const templateMode = config.get<OverviewTemplateMode>(
    'projectOverview.template',
    'full'
  );

  return {
    enabled,
    includeMetadata,
    includeTree,
    treeMaxDepth,
    treeMaxEntriesPerDirectory,
    excludedNames,
    templateMode,
    exclusionMatchers: compileExclusionRegexes(excludedNames)
  };
}

function compileExclusionRegexes(patterns: string[]): RegExp[] {
  return patterns
    .filter((pattern) => !!pattern && pattern.trim().length > 0)
    .map((pattern) => globToRegExp(pattern.trim()));
}

function globToRegExp(glob: string): RegExp {
  const escaped = glob.replace(/[-\\/^$+?.()|[\]{}]/g, '\\$&');
  const normalized = escaped.replace(/\*/g, '.*');
  return new RegExp(`^${normalized}$`, 'i');
}

function getOutputDocumentUri(workspaceRoot: vscode.Uri): vscode.Uri {
  const config = vscode.workspace.getConfiguration('llmFileCompanion');
  const configuredPath =
    config.get<string>('output.filePath', 'LLM_doc.txt') ?? 'LLM_doc.txt';
  const trimmed = configuredPath.trim() || 'LLM_doc.txt';

  if (path.isAbsolute(trimmed)) {
    return vscode.Uri.file(trimmed);
  }

  return vscode.Uri.joinPath(workspaceRoot, trimmed);
}

function buildSkipSummary(
  filters: PathFilterContext,
  stats: AppendWorkflowStats
): string | undefined {
  const parts: string[] = [];
  if (filters.stats.gitIgnored > 0) {
    parts.push(`${filters.stats.gitIgnored} .gitignore`);
  }
  if (filters.stats.llmIgnored > 0) {
    parts.push(`${filters.stats.llmIgnored} .llmignore`);
  }
  if (stats.binarySkipped > 0) {
    parts.push(`${stats.binarySkipped} binary`);
  }
  return parts.length ? `(skipped ${parts.join(', ')})` : undefined;
}

async function buildPathFilterContext(rootUri: vscode.Uri): Promise<PathFilterContext> {
  const [gitIgnore, llmIgnore] = await Promise.all([
    loadIgnoreFile(rootUri, '.gitignore'),
    loadIgnoreFile(rootUri, '.llmignore')
  ]);

  return {
    rootPath: rootUri.fsPath,
    gitIgnore,
    llmIgnore,
    stats: {
      gitIgnored: 0,
      llmIgnored: 0
    }
  };
}

async function loadIgnoreFile(
  rootUri: vscode.Uri,
  fileName: string
): Promise<IgnoreMatcher | undefined> {
  try {
    const fileUri = vscode.Uri.joinPath(rootUri, fileName);
    const bytes = await vscode.workspace.fs.readFile(fileUri);
    const content = new TextDecoder().decode(bytes);
    if (!content.trim()) {
      return undefined;
    }
    const matcher = ignore();
    matcher.add(content);
    return matcher;
  } catch {
    return undefined;
  }
}

function shouldSkipPath(
  fsPath: string,
  context?: PathFilterContext
): 'git' | '.llmignore' | undefined {
  if (!context) {
    return undefined;
  }

  const relativePath = path.relative(context.rootPath, fsPath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    return undefined;
  }

  const normalized = relativePath.split(path.sep).join('/');

  if (context.gitIgnore && matchesIgnore(context.gitIgnore, normalized)) {
    context.stats.gitIgnored++;
    return 'git';
  }

  if (context.llmIgnore && matchesIgnore(context.llmIgnore, normalized)) {
    context.stats.llmIgnored++;
    return '.llmignore';
  }

  return undefined;
}

function matchesIgnore(matcher: IgnoreMatcher, normalizedPath: string): boolean {
  return matcher.ignores(normalizedPath) || matcher.ignores(`${normalizedPath}/`);
}
