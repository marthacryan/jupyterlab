// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { ISanitizer } from '@jupyterlab/apputils';
import {
  MarkdownCell,
  Cell,
  ICellModel
} from '@jupyterlab/cells';
import { INotebookTracker, NotebookPanel } from '@jupyterlab/notebook';
import { nullTranslator } from '@jupyterlab/translation';
import { TableOfContentsRegistry as Registry } from '../../registry';
import { TableOfContents } from '../../toc';
import { INotebookHeading } from '../../utils/headings';
import { OptionsManager } from './options_manager';
import { render } from './render';
import { toolbar } from './toolbar_generator';
import { ITranslator } from '@jupyterlab/translation';

/**
 * Returns a ToC generator for notebooks.
 *
 * @private
 * @param tracker - notebook tracker
 * @param widget - table of contents widget
 * @param sanitizer - HTML sanitizer
 * @param translator - Language translator
 * @returns ToC generator capable of parsing notebooks
 */
function createNotebookGenerator(
  tracker: INotebookTracker,
  widget: TableOfContents,
  sanitizer: ISanitizer,
  translator?: ITranslator
): Registry.IGenerator<NotebookPanel> {
  const options = new OptionsManager(widget, tracker, {
    numbering: false,
    sanitizer: sanitizer,
    translator: translator || nullTranslator
  });
  tracker.activeCellChanged.connect(
    (sender: INotebookTracker, args: Cell<ICellModel>) => {
      widget.update();
    }
  );
  return {
    tracker,
    usesLatex: true,
    options: options,
    toolbarGenerator: generateToolbar,
    itemRenderer: renderItem,
    generate: generate,
    collapseChanged: options.collapseChanged
  };

  /**
   * Returns a toolbar generator.
   *
   * @private
   * @returns toolbar generator
   */
  function generateToolbar() {
    return toolbar(options, tracker);
  }

  /**
   * Renders a table of contents item.
   *
   * @private
   * @param item - heading to render
   * @param toc - list of all headers to render
   * @returns rendered item
   */
  function renderItem(item: INotebookHeading, toc: INotebookHeading[] = []) {
    return render(options, tracker, item, toc);
  }

  /**
   * Generates a table of contents.
   *
   * @private
   * @param panel - notebook widget
   * @returns a list of headings
   */
  function generate(panel: NotebookPanel): INotebookHeading[] {
    let headings: INotebookHeading[] = [];
    panel.content.widgets.forEach((cell: Cell, index: number) => {
      if (cell instanceof MarkdownCell && cell.headerLevel > 0) {
        headings.push({
          type: 'header',
          cellRef: cell,
          index: index,
          onClick: () => {
            panel.content.activeCellIndex = index;
            panel.content.mode = 'command';
            cell.node.scrollIntoView();
          },
          text: cell.headerText,
          level: cell.headerLevel
        });
      }
    });
    return headings;
  }
}

/**
 * Exports.
 */
export { createNotebookGenerator };
