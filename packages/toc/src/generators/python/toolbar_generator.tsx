// Copyright (c) Jupyter Development Team.
// Distributed under the terms of the Modified BSD License.

import * as React from 'react';
import { OptionsManager } from './options_manager';

/**
 * Interface describing toolbar properties.
 *
 * @private
 */
interface IProperties {}

/**
 * Interface describing toolbar state.
 *
 * @private
 */
interface IState {
  /**
   * Boolean indicating whether numbering is enabled.
   */
  numbering: boolean;
}

/**
 * Returns a component for rendering a python table of contents toolbar.
 *
 * @private
 * @returns toolbar component
 */
function toolbar(options: OptionsManager) {
  return class Toolbar extends React.Component<IProperties, IState> {
    /**
     * Returns a component for rendering a python table of contents toolbar.
     *
     * @param props - toolbar properties
     * @returns toolbar component
     */
    constructor(props: IProperties) {
      super(props);
      this.state = { numbering: false };
      options.initializeOptions(false);
    }

    /**
     * Renders a toolbar.
     *
     * @returns rendered toolbar
     */
    render() {
      const numberingIcon = this.state.numbering ? (
        <div
          className="toc-toolbar-auto-numbering-button toc-toolbar-button"
          onClick={event => {
            options.numbering = !options.numbering;
            this.setState({ numbering: options.numbering });
          }}
        >
          <div
            role="text"
            aria-label="Toggle Auto-Numbering"
            title="Toggle Auto-Numbering"
            className="toc-toolbar-auto-numbering-icon toc-toolbar-icon-selected"
          />
        </div>
      ) : (
        <div
          className="toc-toolbar-auto-numbering-button toc-toolbar-button"
          onClick={event => {
            options.numbering = !options.numbering;
            this.setState({ numbering: options.numbering });
          }}
        >
          <div
            role="text"
            aria-label="Toggle Auto-Numbering"
            title="Toggle Auto-Numbering"
            className="toc-toolbar-auto-numbering-icon toc-toolbar-icon"
          />
        </div>
      );

      return (
        <div>
          <div className={'toc-toolbar'}>
            {numberingIcon}
          </div>
        </div>
      );
    }
  };
}

/**
 * Exports.
 */
export { toolbar };
