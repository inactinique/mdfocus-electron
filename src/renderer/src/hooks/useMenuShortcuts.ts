import { useEffect } from 'react';
import { useEditorStore } from '../stores/editorStore';
import { useProjectStore } from '../stores/projectStore';
import { useBibliographyStore } from '../stores/bibliographyStore';

/**
 * Hook that listens to menu shortcuts and triggers appropriate actions
 * This should be called once at the app root level
 */
export function useMenuShortcuts() {
  const { saveCurrentFile, loadFile, createNewFile, insertFormatting, togglePreview } =
    useEditorStore();
  const { createProject, loadProject } = useProjectStore();
  const { searchCitations } = useBibliographyStore();

  useEffect(() => {
    // File operations
    const handleNewFile = () => {
      createNewFile();
    };

    const handleOpenFile = async () => {
      try {
        const result = await window.electron.dialog.openFile({
          filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
        });

        if (!result.canceled && result.filePaths && result.filePaths.length > 0) {
          await loadFile(result.filePaths[0]);
        }
      } catch (error) {
        console.error('Failed to open file:', error);
      }
    };

    const handleSaveFile = async () => {
      const { filePath } = useEditorStore.getState();

      // If no file path exists, open "Save As" dialog
      if (!filePath) {
        try {
          const result = await window.electron.dialog.saveFile({
            filters: [{ name: 'Markdown', extensions: ['md', 'markdown'] }],
            defaultPath: 'document.md',
          });

          if (!result.canceled && result.filePath) {
            await useEditorStore.getState().saveFileAs(result.filePath);
          }
        } catch (error) {
          console.error('Failed to save file:', error);
        }
      } else {
        // File path exists, save directly
        saveCurrentFile();
      }
    };

    // Project operations
    const handleNewProject = () => {
      // Trigger project creation UI
      window.dispatchEvent(new CustomEvent('show-create-project-dialog'));
    };

    const handleOpenProject = () => {
      // Trigger project open UI
      window.dispatchEvent(new CustomEvent('show-open-project-dialog'));
    };

    // Export operations
    const handleExportPDF = () => {
      // Trigger PDF export modal
      window.dispatchEvent(new CustomEvent('show-pdf-export-dialog'));
    };

    // Formatting operations
    const handleFormatBold = () => {
      insertFormatting('bold');
    };

    const handleFormatItalic = () => {
      insertFormatting('italic');
    };

    const handleInsertLink = () => {
      insertFormatting('link');
    };

    const handleInsertCitation = () => {
      insertFormatting('citation');
    };

    const handleInsertTable = () => {
      insertFormatting('table');
    };

    // View operations
    const handleTogglePreview = () => {
      togglePreview();
    };

    const handleSwitchPanel = (_event: Electron.IpcRendererEvent, panel: string) => {
      // Trigger panel switch
      window.dispatchEvent(new CustomEvent('switch-panel', { detail: panel }));
    };

    // Bibliography operations
    const handleImportBibTeX = () => {
      window.dispatchEvent(new CustomEvent('show-bibtex-import-dialog'));
    };

    const handleSearchCitations = () => {
      window.dispatchEvent(new CustomEvent('focus-citation-search'));
    };

    const handleConnectZotero = () => {
      window.dispatchEvent(new CustomEvent('show-zotero-connect-dialog'));
    };

    // Settings
    const handleOpenSettings = () => {
      window.dispatchEvent(new CustomEvent('switch-panel', { detail: 'settings' }));
    };

    // About
    const handleAbout = () => {
      window.dispatchEvent(new CustomEvent('show-about-dialog'));
    };

    // Register all listeners
    window.electron.ipcRenderer.on('menu:new-file', handleNewFile);
    window.electron.ipcRenderer.on('menu:open-file', handleOpenFile);
    window.electron.ipcRenderer.on('menu:save-file', handleSaveFile);
    window.electron.ipcRenderer.on('menu:new-project', handleNewProject);
    window.electron.ipcRenderer.on('menu:open-project', handleOpenProject);
    window.electron.ipcRenderer.on('menu:export-pdf', handleExportPDF);
    window.electron.ipcRenderer.on('menu:format-bold', handleFormatBold);
    window.electron.ipcRenderer.on('menu:format-italic', handleFormatItalic);
    window.electron.ipcRenderer.on('menu:insert-link', handleInsertLink);
    window.electron.ipcRenderer.on('menu:insert-citation', handleInsertCitation);
    window.electron.ipcRenderer.on('menu:insert-table', handleInsertTable);
    window.electron.ipcRenderer.on('menu:toggle-preview', handleTogglePreview);
    window.electron.ipcRenderer.on('menu:switch-panel', handleSwitchPanel);
    window.electron.ipcRenderer.on('menu:import-bibtex', handleImportBibTeX);
    window.electron.ipcRenderer.on('menu:search-citations', handleSearchCitations);
    window.electron.ipcRenderer.on('menu:connect-zotero', handleConnectZotero);
    window.electron.ipcRenderer.on('menu:open-settings', handleOpenSettings);
    window.electron.ipcRenderer.on('menu:about', handleAbout);

    // Cleanup listeners on unmount
    return () => {
      window.electron.ipcRenderer.removeListener('menu:new-file', handleNewFile);
      window.electron.ipcRenderer.removeListener('menu:open-file', handleOpenFile);
      window.electron.ipcRenderer.removeListener('menu:save-file', handleSaveFile);
      window.electron.ipcRenderer.removeListener('menu:new-project', handleNewProject);
      window.electron.ipcRenderer.removeListener('menu:open-project', handleOpenProject);
      window.electron.ipcRenderer.removeListener('menu:export-pdf', handleExportPDF);
      window.electron.ipcRenderer.removeListener('menu:format-bold', handleFormatBold);
      window.electron.ipcRenderer.removeListener('menu:format-italic', handleFormatItalic);
      window.electron.ipcRenderer.removeListener('menu:insert-link', handleInsertLink);
      window.electron.ipcRenderer.removeListener('menu:insert-citation', handleInsertCitation);
      window.electron.ipcRenderer.removeListener('menu:insert-table', handleInsertTable);
      window.electron.ipcRenderer.removeListener('menu:toggle-preview', handleTogglePreview);
      window.electron.ipcRenderer.removeListener('menu:switch-panel', handleSwitchPanel);
      window.electron.ipcRenderer.removeListener('menu:import-bibtex', handleImportBibTeX);
      window.electron.ipcRenderer.removeListener('menu:search-citations', handleSearchCitations);
      window.electron.ipcRenderer.removeListener('menu:connect-zotero', handleConnectZotero);
      window.electron.ipcRenderer.removeListener('menu:open-settings', handleOpenSettings);
      window.electron.ipcRenderer.removeListener('menu:about', handleAbout);
    };
  }, [
    saveCurrentFile,
    loadFile,
    createNewFile,
    insertFormatting,
    togglePreview,
    createProject,
    loadProject,
    searchCitations,
  ]);
}
