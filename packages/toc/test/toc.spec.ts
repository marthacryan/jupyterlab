// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import 'jest';

// import { Widget } from '@lumino/widgets';
import { Context } from '@jupyterlab/docregistry';

import {
  INotebookModel,
  NotebookPanel,
  NotebookTracker
} from '@jupyterlab/notebook';
import { initNotebookContext } from '@jupyterlab/testutils';
import { DocumentManager, IDocumentManager } from '@jupyterlab/docmanager';
import * as ToC from '@jupyterlab/toc';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { ServiceManager } from '@jupyterlab/services';
import { DocumentRegistry, TextModelFactory } from '@jupyterlab/docregistry';
import { JupyterServer } from '@jupyterlab/testutils/lib/start_jupyter_server';

import { NBTestUtils, Mock } from '@jupyterlab/testutils';

const server = new JupyterServer();

beforeAll(async () => {
  jest.setTimeout(20000);
  await server.start();
});

afterAll(async () => {
  await server.shutdown();
});

describe('@jupyterlab/toc', () => {
  let manager: IDocumentManager;
  let widget: ToC.TableOfContents;
  let registry: DocumentRegistry;
  let serviceManager: ServiceManager.IManager;
  let factory: TextModelFactory;
  let context: Context<INotebookModel>;

  beforeAll(async () => {
    const opener: DocumentManager.IWidgetOpener = {
      open: widget => {
        /* no op */
      }
    };
    factory = new TextModelFactory();
    registry = new DocumentRegistry({
      textModelFactory: factory
    });
    serviceManager = new Mock.ServiceManagerMock();
    manager = new DocumentManager({
      registry,
      opener,
      manager: serviceManager
    });
    context = await initNotebookContext({ manager: serviceManager, startKernel: true });
    context.model.fromJSON(NBTestUtils.DEFAULT_CONTENT);
    await serviceManager.contents.save(context.path, {
      type: 'notebook',
      format: 'json',
      content: NBTestUtils.DEFAULT_CONTENT
    });
  });

  afterAll(async () => {
    await context.sessionContext.shutdown();
    context.dispose();
  });

  describe('TableOfContents', () => {
    describe('#constructor', () => {
      it('should construct a new ToC widget', () => {
        widget = new ToC.TableOfContents({
          docmanager: manager,
          rendermime: new RenderMimeRegistry()
        });
        expect(widget).toBeInstanceOf(ToC.TableOfContents);
      });
    });

    describe('#current', () => {
      let notebookWidget: NotebookPanel;
      let registry: ToC.TableOfContentsRegistry;
      let notebookGenerator: ToC.TableOfContentsRegistry.IGenerator<NotebookPanel>;
      let tracker: NotebookTracker;

      it('should create a registry', () => {
        registry = new ToC.TableOfContentsRegistry();
      });

      it ('should create a notebook generator', () => {
        tracker = new NotebookTracker({
          namespace: 'notebook'
        });
        notebookGenerator = ToC.createNotebookGenerator(
          tracker,
          widget,
          NBTestUtils.defaultRenderMime().sanitizer
        );
      });

      it ('should add a notebook generator to the registry', () => {
        registry.add(notebookGenerator);
      });

      it ('should find the notebook generator', async () => {
        notebookWidget = NBTestUtils.createNotebookPanel(context);
        expect(notebookWidget).toBeInstanceOf(NotebookPanel);
        tracker.add(notebookWidget);
        const foundNotebookGenerator = registry.find(notebookWidget);
        expect(foundNotebookGenerator).toBeDefined();
      });
    });
  });
});
