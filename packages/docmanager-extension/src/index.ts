// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import {
  JupyterLab, JupyterLabPlugin
} from '@jupyterlab/application';

import {
  showDialog, showErrorMessage, Spinner, Dialog, ICommandPalette
} from '@jupyterlab/apputils';

import {
  IChangedArgs, uuid
} from '@jupyterlab/coreutils';

import {
  renameDialog, DocumentManager, IDocumentManager
} from '@jupyterlab/docmanager';

import {
  DocumentRegistry
} from '@jupyterlab/docregistry';

import {
  Contents, Kernel
} from '@jupyterlab/services';

import {
  IDisposable
} from '@phosphor/disposable';


/**
 * The command IDs used by the document manager plugin.
 */
namespace CommandIDs {
  export
  const clone = 'docmanager:clone';

  export
  const close = 'docmanager:close';

  export
  const closeAllFiles = 'docmanager:close-all-files';

  export
  const createFrom = 'docmanager:create-from';

  export
  const deleteFile = 'docmanager:delete-file';

  export
  const newUntitled = 'docmanager:new-untitled';

  export
  const open = 'docmanager:open';

  export
  const rename = 'docmanager:rename';

  export
  const restoreCheckpoint = 'docmanager:restore-checkpoint';

  export
  const save = 'docmanager:save';

  export
  const saveAll = 'docmanager:save-all';

  export
  const saveAs = 'docmanager:save-as';
}


/**
 * The default document manager provider.
 */
const plugin: JupyterLabPlugin<IDocumentManager> = {
  id: '@jupyterlab/docmanager-extension:plugin',
  provides: IDocumentManager,
  requires: [ICommandPalette],
  activate: (app: JupyterLab, palette: ICommandPalette): IDocumentManager => {
    const manager = app.serviceManager;
    const contexts = new WeakSet<DocumentRegistry.Context>();
    const opener: DocumentManager.IWidgetOpener = {
      open: (widget, options) => {
        const shell = app.shell;
        if (!widget.id) {
          widget.id = `document-manager-${++Private.id}`;
        }
        widget.title.dataset = {
          'type': 'document-title',
          ...widget.title.dataset
        };
        if (!widget.isAttached && (widget as any).ready !== undefined) {
          // Add a loading spinner, and remove it when the widget is ready.
          let spinner = new Spinner();
          spinner.id = uuid();
          spinner.title.label = widget.title.label;
          shell.addToMainArea(spinner, options || {});
          shell.activateById(spinner.id);

          (widget as any).ready.then(() => {
            const isCurrent = app.shell.currentWidget === spinner;
            app.shell.addToMainArea(widget, { ref: spinner.id });
            spinner.dispose();
            if (isCurrent) {
              shell.activateById(widget.id);
            }
          });
        } else if (!widget.isAttached) {
          shell.addToMainArea(widget, options || {});
          shell.activateById(widget.id);
        } else {
          shell.activateById(widget.id);
        }

        // Handle dirty state for open documents.
        let context = docManager.contextForWidget(widget);
        if (!contexts.has(context)) {
          handleContext(app, context);
          contexts.add(context);
        }
      }
    };
    const registry = app.docRegistry;
    const docManager = new DocumentManager({ registry, manager, opener });

    // Register the file operations commands.
    addCommands(app, docManager, palette, opener);

    return docManager;
  }
};


/**
 * Export the plugin as default.
 */
export default plugin;


/**
 * Add the file operations commands to the application's command registry.
 */
function addCommands(app: JupyterLab, docManager: IDocumentManager, palette: ICommandPalette, opener: DocumentManager.IWidgetOpener): void {
  const { commands, docRegistry } = app;
  const category = 'File Operations';
  const isEnabled = () => {
    const { currentWidget } = app.shell;
    return !!(currentWidget && docManager.contextForWidget(currentWidget));
  };
  const fileType = () => {
    const { currentWidget } = app.shell;
    if (!currentWidget) {
      return 'File';
    }
    const context = docManager.contextForWidget(currentWidget);
    if (!context) {
      return '';
    }
    const fts = docRegistry.getFileTypesForPath(context.path);
    return (fts.length && fts[0].displayName) ? fts[0].displayName : 'File';
  };

  commands.addCommand(CommandIDs.close, {
    label: () => {
      const widget = app.shell.currentWidget;
      let name = 'File';
      if (widget) {
        const typeName = fileType();
        name = typeName || widget.title.label;
      }
      return `Close ${name}`;
    },
    isEnabled: () => !!app.shell.currentWidget &&
                     !!app.shell.currentWidget.title.closable,
    execute: () => {
      if (app.shell.currentWidget) {
        app.shell.currentWidget.close();
      }
    }
  });

  commands.addCommand(CommandIDs.closeAllFiles, {
    label: 'Close All',
    execute: () => { app.shell.closeAll(); }
  });

  commands.addCommand(CommandIDs.deleteFile, {
    label: () => `Delete ${fileType()}`,
    execute: args => {
      const path = typeof args['path'] === 'undefined' ? ''
        : args['path'] as string;

      if (!path) {
        const command = CommandIDs.deleteFile;
        throw new Error(`A non-empty path is required for ${command}.`);
      }
      return docManager.deleteFile(path);
    }
  });

  commands.addCommand(CommandIDs.newUntitled, {
    execute: args => {
      const errorTitle = args['error'] as string || 'Error';
      const path = typeof args['path'] === 'undefined' ? ''
        : args['path'] as string;
      let options: Partial<Contents.ICreateOptions> = {
        type: args['type'] as Contents.ContentType,
        path
      };

      if (args['type'] === 'file') {
        options.ext = args['ext'] as string || '.txt';
      }

      return docManager.services.contents.newUntitled(options)
        .catch(error => showErrorMessage(errorTitle, error));
    },
    label: args => args['label'] as string || `New ${args['type'] as string}`
  });

  commands.addCommand(CommandIDs.open, {
    execute: args => {
      const path = typeof args['path'] === 'undefined' ? ''
        : args['path'] as string;
      const factory = args['factory'] as string || void 0;
      const kernel = args['kernel'] as Kernel.IModel || void 0;
      return docManager.services.contents.get(path, { content: false })
        .then(() => docManager.openOrReveal(path, factory, kernel))
        .then(widget => {
          return widget.ready.then(() => { return widget; });
        });
    },
    icon: args => args['icon'] as string || '',
    label: args => (args['label'] || args['factory']) as string,
    mnemonic: args => args['mnemonic'] as number || -1
  });

  commands.addCommand(CommandIDs.restoreCheckpoint, {
    label: () => `Revert ${fileType()} to Saved`,
    caption: 'Revert contents to previous checkpoint',
    isEnabled,
    execute: () => {
      if (isEnabled()) {
        let context = docManager.contextForWidget(app.shell.currentWidget);
        if (context.model.readOnly) {
          return context.revert();
        }
        return context.restoreCheckpoint().then(() => context.revert());
      }
    }
  });

  commands.addCommand(CommandIDs.save, {
    label: () => `Save ${fileType()}`,
    caption: 'Save and create checkpoint',
    isEnabled,
    execute: () => {
      if (isEnabled()) {
        let context = docManager.contextForWidget(app.shell.currentWidget);
        if (context.model.readOnly) {
          return showDialog({
            title: 'Cannot Save',
            body: 'Document is read-only',
            buttons: [Dialog.okButton()]
          });
        }
        return context.save().then(() => context.createCheckpoint());
      }
    }
  });

  commands.addCommand(CommandIDs.saveAll, {
    label: () => 'Save All',
    caption: 'Save all open documents',
    isEnabled: () => {
      const iterator = app.shell.widgets('main');
      let widget = iterator.next();
      while (widget) {
        if (docManager.contextForWidget(widget)) {
          return true;
        }
        widget = iterator.next();
      }
      return false;
    },
    execute: () => {
      const iterator = app.shell.widgets('main');
      const promises: Promise<void>[] = [];
      const paths = new Set<string>(); // Cache so we don't double save files.
      let widget = iterator.next();
      while (widget) {
        const context = docManager.contextForWidget(widget);
        if (context && !context.model.readOnly && !paths.has(context.path)) {
          paths.add(context.path);
          promises.push(context.save());
        }
        widget = iterator.next();
      }
      return Promise.all(promises);
    }
  });

  commands.addCommand(CommandIDs.saveAs, {
    label: () => `Save ${fileType()} As…`,
    caption: 'Save with new path',
    isEnabled,
    execute: () => {
      if (isEnabled()) {
        let context = docManager.contextForWidget(app.shell.currentWidget);
        return context.saveAs();
      }
    }
  });

  commands.addCommand(CommandIDs.rename, {
    label: () => `Rename ${fileType()}…`,
    isEnabled,
    execute: () => {
      if (isEnabled()) {
        let context = docManager.contextForWidget(app.shell.currentWidget);
        return renameDialog(docManager, context!.path);
      }
    }
  });

  commands.addCommand(CommandIDs.clone, {
    label: () => `New View for ${fileType()}`,
    isEnabled,
    execute: () => {
      const widget = app.shell.currentWidget;
      if (!widget) {
        return;
      }
      // Clone the widget.
      let child = docManager.cloneWidget(widget);
      if (child) {
        opener.open(child);
      }
    },
  });

  app.contextMenu.addItem({
    command: CommandIDs.rename,
    selector: '[data-type="document-title"]',
    rank: 1
  });
  app.contextMenu.addItem({
    command: CommandIDs.clone,
    selector: '[data-type="document-title"]',
    rank: 2
  });

  [
    CommandIDs.save,
    CommandIDs.restoreCheckpoint,
    CommandIDs.saveAs,
    CommandIDs.clone,
    CommandIDs.close,
    CommandIDs.closeAllFiles
  ].forEach(command => { palette.addItem({ command, category }); });
}


/**
 * Handle dirty state for a context.
 */
function handleContext(app: JupyterLab, context: DocumentRegistry.Context): void {
  let disposable: IDisposable | null = null;
  let onStateChanged = (sender: any, args: IChangedArgs<any>) => {
    if (args.name === 'dirty') {
      if (args.newValue === true) {
        if (!disposable) {
          disposable = app.setDirty();
        }
      } else if (disposable) {
        disposable.dispose();
        disposable = null;
      }
    }
  };
  context.ready.then(() => {
    context.model.stateChanged.connect(onStateChanged);
    if (context.model.dirty) {
      disposable = app.setDirty();
    }
  });
  context.disposed.connect(() => {
    if (disposable) {
      disposable.dispose();
    }
  });
}


/**
 * A namespace for private module data.
 */
namespace Private {
  /**
   * A counter for unique IDs.
   */
  export
  let id = 0;
}
