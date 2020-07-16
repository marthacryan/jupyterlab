// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import * as React from 'react';
import { INumberedHeading } from '../../utils/headings';
import { OptionsManager } from './options_manager';

/**
 * Renders a Python table of contents item.
 *
 * @private
 * @param item - numbered heading
 * @returns rendered item
 */
function render(options: OptionsManager, item: INumberedHeading) {
  let fontSizeClass = 'toc-level-size-' + item.level;
  let numbering = item.numbering && options.numbering ? item.numbering : '';

  return <span className={fontSizeClass}> {numbering + item.text} </span>;
}

/**
 * Exports.
 */
export { render };
