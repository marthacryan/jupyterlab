// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import { IDocumentWidget } from '@jupyterlab/docregistry';
import { FileEditor, IEditorTracker } from '@jupyterlab/fileeditor';
import { TableOfContentsRegistry as Registry } from '../../registry';
import { TableOfContents } from '../../toc';
import { OptionsManager } from './options_manager';
import { INumberedHeading } from '../../utils/headings';
import { render } from './render';
import { toolbar } from './toolbar_generator';

/**
 * Generates a table of contents.
 *
 * @private
 * @param editor - editor widget
 * @returns a list of headings
 */
function generate(editor: IDocumentWidget<FileEditor>): INumberedHeading[] {
  // Split the text into lines:
  let lines = editor.content.model.value.text.split('\n') as Array<any>;

  // Iterate over the lines to get the heading level and text for each line:
  let headings: INumberedHeading[] = [];
  let processingImports = false;
  let levelOneHeadingNumber = 0;
  let levelTwoHeadingNumber = 1;
  for (let i = 0; i < lines.length; i++) {
    let line = lines[i].trim();
    if (line.indexOf('def ') === 0) {
      processingImports = false;
      let numbering = `${levelOneHeadingNumber}.${levelTwoHeadingNumber}. `;
      levelTwoHeadingNumber++;
      headings.push({
        text: line.slice(0, -1),
        level: 2,
        numbering: numbering,
        onClick: onClick(i)
      });
    } else if (line.indexOf('class ') === 0) {
      processingImports = false;
      levelOneHeadingNumber++;
      let numbering = `${levelOneHeadingNumber}. `;
      levelTwoHeadingNumber = 1;
      headings.push({
        text: line.slice(0, -1),
        level: 1,
        numbering: numbering,
        onClick: onClick(i)
      });
    } else if (line.indexOf('import ') == 0 && !processingImports) {
      processingImports = true;
      let numbering = `${levelOneHeadingNumber}.${levelTwoHeadingNumber}. `;
      levelTwoHeadingNumber++;
      headings.push({
        text: line,
        level: 2,
        numbering: numbering,
        onClick: onClick(i)
      });
    }
  }
  return headings;

  /**
   * Returns a "click" handler.
   *
   * @private
   * @param line - line number
   * @returns click handler
   */
  function onClick(line: number) {
    return () => {
      editor.content.editor.setCursorPosition({
        line: line,
        column: 0
      });
    };
  }
}

/**
 * Returns a boolean indicating whether this ToC generator is enabled.
 *
 * @private
 * @param editor - editor widget
 * @returns boolean indicating whether this ToC generator is enabled
 */
function isEnabled(editor: IDocumentWidget<FileEditor>) {
  let mime = editor.content.model.mimeType;
  return mime === 'application/x-python-code' || mime === 'text/x-python';
}

/**
 * Returns a ToC generator for Python files.
 *
 * @private
 * @param tracker - file editor tracker
 * @returns ToC generator capable of parsing Python files
 */
function createPythonGenerator(
  tracker: IEditorTracker,
  widget: TableOfContents
): Registry.IGenerator<IDocumentWidget<FileEditor>> {
  const options = new OptionsManager(widget, { numbering: true });
  return {
    tracker,
    isEnabled: isEnabled,
    itemRenderer: renderItem,
    toolbarGenerator: generateToolbar,
    options: options,
    generate: generate
  };

  /**
   * Returns a toolbar generator.
   *
   * @private
   * @returns toolbar generator
   */
  function generateToolbar() {
    return toolbar(options);
  }

  /**
   * Renders a table of contents item.
   *
   * @private
   * @param item - heading to render
   * @returns rendered item
   */
  function renderItem(item: INumberedHeading) {
    return render(options, item);
  }
}

/**
 * Exports.
 */
export { createPythonGenerator };
