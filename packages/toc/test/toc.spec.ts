// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import 'jest';

// import { Widget } from '@lumino/widgets';

import { DocumentManager, IDocumentManager } from '@jupyterlab/docmanager';
import { TableOfContents } from '@jupyterlab/toc';
import { RenderMimeRegistry } from '@jupyterlab/rendermime';
import { DocumentRegistry, TextModelFactory } from '@jupyterlab/docregistry';

import * as Mock from '@jupyterlab/testutils/lib/mock';

describe('ToC/index', () => {
  let manager: IDocumentManager;

  beforeAll(() => {
    const opener: DocumentManager.IWidgetOpener = {
      open: widget => {
        /* no op */
      }
    };
    let registry = new DocumentRegistry({
      textModelFactory: new TextModelFactory()
    });
    let serviceManager = new Mock.ServiceManagerMock();
    manager = new DocumentManager({
      registry,
      opener,
      manager: serviceManager
    });
  });
  describe('TableOfContents', () => {
    describe('#constructor()', () => {
      it('should construct a new ToC widget', () => {
        const widget = new TableOfContents({
          docmanager: manager,
          rendermime: new RenderMimeRegistry()
        });
        expect(widget).toBeInstanceOf(TableOfContents);
      });
    });
  });
});
