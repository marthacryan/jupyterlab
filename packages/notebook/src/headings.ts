import { NotebookActions } from './actions';

import { Cell, MarkdownCell } from '@jupyterlab/cells';

import { ElementExt } from '@lumino/domutils';
import { IHeadingsCollapser, INotebookTracker } from './tokens';

export class HeadingsCollapser implements IHeadingsCollapser {
  nbTrack: INotebookTracker;

  constructor(nbTrack: INotebookTracker) {
    this.nbTrack = nbTrack;
    nbTrack.currentChanged.connect(() => {
      // Not sure if this is running too often, but using stateChanged
      // signal caused the collapse button to not work for new heading cells that
      // hadn't been saved yet. 
      nbTrack.currentWidget?.content.model?.contentChanged.connect(() => {
        if (nbTrack.currentWidget?.content?.widgets?.length === undefined) {
          return;
        }
        nbTrack.currentWidget.content.widgets.forEach(
          (cell: Cell, i: number) => {
            if (!(cell instanceof MarkdownCell)) {
              return;
            }
            cell.toggleCollapsedSignal.connect(
              (cell: MarkdownCell, isCollapsed: boolean) => {
                this.setCellCollapse(i, isCollapsed);
              }
            );
          }
        );
      });
    });

    nbTrack.activeCellChanged.connect(() => {
      this.handleCellChange();
    });
  }

  handleCellChange(): any {
    if (this.nbTrack.currentWidget?.content.activeCellIndex !== undefined) {
      this.uncollapseParent(this.nbTrack.currentWidget.content.activeCellIndex);
    }
  }

  uncollapseParent(which: number): any {
    let nearestParentLoc = this.findNearestParentHeader(which);
    if (nearestParentLoc == -1) {
      // no parent, can't be collapsed so nothing to do.
      return;
    }
    let cell = this.nbTrack.currentWidget?.content.widgets[nearestParentLoc];
    if (!cell) {
      return;
    }
    let headerInfo = this.getHeaderInfo(cell);
    if (!headerInfo.collapsed && !cell.isHidden) {
      // no uncollapsing needed.
      return;
    }
    if (cell.isHidden) {
      // recursively uncollapse this cell's parent then.
      this.uncollapseParent(nearestParentLoc);
    }
    if (headerInfo.collapsed) {
      // then uncollapse.
      this.setCellCollapse(nearestParentLoc, false);
    }
  }

  findNearestUncollapsedUpwards(index: number): number {
    // Finds the nearest header above the given cell. If the cell is a header itself, it does not return itself;
    // this can be checked directly by calling functions.
    if (
      !this.nbTrack.currentWidget?.content.widgets ||
      index >= this.nbTrack.currentWidget?.content.widgets.length
    ) {
      return -1;
    }
    while (index > 0) {
      index -= 1;
      let cell = this.nbTrack.currentWidget?.content.widgets[index];
      if (!cell?.isHidden) {
        return index;
      }
    }
    return -1; // else no unhidden found above.
  }

  findNearestUncollapsedDownwards(index: number): number {
    // Finds the nearest header above the given cell. If the cell is a header itself, it does not return itself;
    // this can be checked directly by calling functions.
    if (
      !this.nbTrack.currentWidget?.content.widgets ||
      index >= this.nbTrack.currentWidget?.content.widgets.length ||
      index < 0
    ) {
      return -1;
    }
    while (index < this.nbTrack.currentWidget?.content.widgets.length - 1) {
      index += 1;
      let cell = this.nbTrack.currentWidget?.content.widgets[index];
      if (!cell?.isHidden) {
        return index;
      }
    }
    return -1; // else no unhidden found above.
  }

  collapseAll(): any {
    if (this.nbTrack.currentWidget) {
      for (
        let cellI = 0;
        cellI < this.nbTrack.currentWidget?.content.widgets.length;
        cellI++
      ) {
        let cell = this.nbTrack.currentWidget?.content.widgets[cellI];
        if (this.getHeaderInfo(cell).isHeader) {
          this.setCellCollapse( cellI, true);
          // setCellCollapse tries to be smart and not change metadata of hidden cells.
          // that's not the desired behavior of this function though, which wants to act
          // as if the user clicked collapse on every level.
          this.setCollapsed(cell, true);
        }
      }
    }
  }

  uncollapseAll(): any {
    if (this.nbTrack.currentWidget) {
      for (
        let cellI = 0;
        cellI < this.nbTrack.currentWidget?.content.widgets.length;
        cellI++
      ) {
        let cell = this.nbTrack.currentWidget?.content.widgets[cellI];
        if (this.getHeaderInfo(cell).isHeader) {
          this.setCellCollapse(cellI, false);
          // similar to collapseAll.
          this.setCollapsed(cell, false);
        }
      }
    }
  }

  findNextParentHeader(index: number, ): any {
    if (
      !this.nbTrack.currentWidget?.content.widgets ||
      index >= this.nbTrack.currentWidget?.content.widgets.length
    ) {
      return -1;
    }
    let childHeaderInfo = this.getHeaderInfo(
      this.nbTrack.currentWidget?.content.widgets[index]
    );
    for (
      let cellN = index + 1;
      cellN < this.nbTrack.currentWidget?.content.widgets.length;
      cellN++
    ) {
      let hInfo = this.getHeaderInfo(
        this.nbTrack.currentWidget?.content.widgets[cellN]
      );
      if (hInfo.isHeader && hInfo.headerLevel <= childHeaderInfo.headerLevel) {
        return cellN;
      }
    }
    // else no parent header found. return the index of the last cell
    return this.nbTrack.currentWidget?.content.widgets.length - 1;
  }

  findNearestParentHeader(index: number, ): number {
    // Finds the nearest header above the given cell. If the cell is a header itself, it does not return itself;
    // this can be checked directly by calling functions.
    if (
      !this.nbTrack.currentWidget?.content.widgets ||
      index >= this.nbTrack.currentWidget?.content.widgets.length
    ) {
      return -1; // strange...
    }
    let childHeaderInfo = this.getHeaderInfo(
      this.nbTrack.currentWidget?.content.widgets[index]
    );
    for (let cellN = index - 1; cellN >= 0; cellN--) {
      if (cellN < this.nbTrack.currentWidget?.content.widgets.length) {
        let hInfo = this.getHeaderInfo(
          this.nbTrack.currentWidget?.content.widgets[cellN]
        );
        if (hInfo.isHeader && hInfo.headerLevel < childHeaderInfo.headerLevel) {
          return cellN;
        }
      }
    }
    // else no parent header found.
    return -1;
  }

  setCellCollapse(
    which: number,
    collapsing: boolean
  ): number {
    if (!this.nbTrack.currentWidget?.content.widgets.length) {
      return which + 1;
    }
    let cell = this.nbTrack.currentWidget?.content.widgets[which];
    if (!cell) {
      return which + 1;
    }
    let selectedHeaderInfo = this.getHeaderInfo(cell);
    let isMarkdown = cell instanceof MarkdownCell;
    if (cell == undefined) {
      return -1;
    }
    if (cell.isHidden || !isMarkdown || !selectedHeaderInfo.isHeader) {
      // otherwise collapsing and uncollapsing already hidden stuff can
      // cause some funny looking bugs.
      return which + 1;
    }
    this.setCollapsed(cell, collapsing);
    let localCollapsed = false;
    let localCollapsedLevel = 0;
    // iterate through all cells after the active cell.
    let cellNum = which + 1;
    for (
      cellNum = which + 1;
      cellNum < this.nbTrack.currentWidget?.content.widgets.length;
      cellNum++
    ) {
      let subCell = this.nbTrack.currentWidget?.content.widgets[cellNum];
      let subCellHeaderInfo = this.getHeaderInfo(subCell);
      if (
        subCellHeaderInfo.isHeader &&
        subCellHeaderInfo.headerLevel <= selectedHeaderInfo.headerLevel
      ) {
        // then reached an equivalent or higher header level than the
        // original the end of the collapse.
        cellNum -= 1;
        break;
      }
      if (
        localCollapsed &&
        subCellHeaderInfo.isHeader &&
        subCellHeaderInfo.headerLevel <= localCollapsedLevel
      ) {
        // then reached the end of the local collapsed, so unset this.
        localCollapsed = false;
      }

      if (collapsing || localCollapsed) {
        // then no extra handling is needed for further locally collapsed
        // headers.
        subCell.setHidden(true);
        continue;
      }

      if (this.getHeaderInfo(subCell).collapsed && subCellHeaderInfo.isHeader) {
        localCollapsed = true;
        localCollapsedLevel = subCellHeaderInfo.headerLevel;
        // but don't collapse the locally collapsed header, so continue to
        // uncollapse the header. This will get noticed in the next round.
      }
      subCell.setHidden(false);
    }
    return cellNum + 1;
  }

  toggleCurrentCellCollapse(): any {
    if (
      !this.nbTrack.activeCell ||
      this.nbTrack.currentWidget?.content.activeCellIndex === undefined
    ) {
      return;
    }
    let headerInfo = this.getHeaderInfo(this.nbTrack.activeCell);
    if (headerInfo.isHeader) {
      // Then toggle!
      let collapsing = !headerInfo.collapsed;
      this.setCellCollapse(
        this.nbTrack.currentWidget.content.activeCellIndex,
        collapsing
      );
    } else {
      // then toggle parent!
      let parentLoc = this.findNearestParentHeader(
        this.nbTrack.currentWidget.content.activeCellIndex
      );
      if (parentLoc == -1) {
        // no parent, can't be collapsed so nothing to do.
        return;
      }
      this.setCellCollapse(
        parentLoc,
        !this.getHeaderInfo(
          this.nbTrack.currentWidget.content.widgets[parentLoc]
        ).collapsed
      );
      // otherwise the active cell will still be the now (usually) hidden cell
      this.nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    }
    ElementExt.scrollIntoViewIfNeeded(
      this.nbTrack.currentWidget?.content.node,
      this.nbTrack.activeCell.node
    );
  }

  collapseCell(): any {
    if (
      !this.nbTrack.activeCell ||
      this.nbTrack.currentWidget?.content.activeCellIndex === undefined
    ) {
      return;
    }
    let headerInfo = this.getHeaderInfo(this.nbTrack.activeCell);
    if (headerInfo.isHeader) {
      if (headerInfo.collapsed) {
        // Then move to nearest parent. Same behavior as the old nb extension.
        // Allows quick collapsing up the chain by <- <- <- presses if <- is a hotkey for this cmd.
        let parentLoc = this.findNearestParentHeader(
          this.nbTrack.currentWidget?.content.activeCellIndex
        );
        if (parentLoc == -1) {
          // no parent, stop going up the chain.
          return;
        }
        this.nbTrack.currentWidget.content.activeCellIndex = parentLoc;
      } else {
        // Then Collapse!
        this.setCellCollapse(
          this.nbTrack.currentWidget?.content.activeCellIndex,
          true
        );
      }
    } else {
      // then jump to previous parent.
      let parentLoc = this.findNearestParentHeader(
        this.nbTrack.currentWidget?.content.activeCellIndex
      );
      if (parentLoc == -1) {
        // no parent, can't be collapsed so nothing to do.
        return;
      }
      this.nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    }
    ElementExt.scrollIntoViewIfNeeded(
      this.nbTrack.currentWidget?.content.node,
      this.nbTrack.activeCell.node
    );
  }

  uncollapseCell(): any {
    if (
      !this.nbTrack.activeCell ||
      this.nbTrack.currentWidget?.content.activeCellIndex === undefined
    ) {
      return;
    }
    if (this.getHeaderInfo(this.nbTrack.activeCell).isHeader) {
      // Then uncollapse!
      this.setCellCollapse(
        this.nbTrack.currentWidget.content.activeCellIndex,
        false
      );
    } else {
      // then jump to next parent
      let parentLoc = this.findNextParentHeader(
        this.nbTrack.currentWidget.content.activeCellIndex
      );
      if (parentLoc == -1) {
        return;
      }
      this.nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    }
    ElementExt.scrollIntoViewIfNeeded(
      this.nbTrack.currentWidget?.content.node,
      this.nbTrack.activeCell.node
    );
  }

  setCollapsed(cell: Cell, data: boolean): any {
    if (cell instanceof MarkdownCell) {
      cell.headerCollapsed = data;
    } else {
      cell.setHidden(data);
    }
  }

  addHeaderBelow(): any {
    if (
      !this.nbTrack.activeCell ||
      this.nbTrack.currentWidget?.content.activeCellIndex === undefined
    ) {
      return;
    }
    let headerInfo = this.getHeaderInfo(this.nbTrack.activeCell);
    if (!headerInfo.isHeader) {
      let parentHeaderIndex = this.findNearestParentHeader(
        this.nbTrack.currentWidget?.content.activeCellIndex
      );
      headerInfo = this.getHeaderInfo(
        this.nbTrack.currentWidget?.content.widgets[parentHeaderIndex]
      );
    }
    let res = this.findNextParentHeader(
      this.nbTrack.currentWidget?.content.activeCellIndex
    );
    this.nbTrack.currentWidget.content.activeCellIndex = res;
    NotebookActions.insertAbove(this.nbTrack.currentWidget?.content);
    NotebookActions.setMarkdownHeader(
      this.nbTrack.currentWidget?.content,
      headerInfo.headerLevel
    );
    NotebookActions.changeCellType(this.nbTrack.currentWidget?.content, 'markdown');
    this.nbTrack.activeCell.editor.setSelection({
      start: { line: 0, column: headerInfo.headerLevel + 1 },
      end: { line: 0, column: 10 }
    });
    this.nbTrack.activeCell.editor.focus();
  }

  addHeaderAbove(): any {
    if (
      !this.nbTrack.activeCell ||
      this.nbTrack.currentWidget?.content.activeCellIndex === undefined ||
      !this.nbTrack.currentWidget?.content.widgets
    ) {
      return;
    }
    let headerInfo = this.getHeaderInfo(this.nbTrack.activeCell);
    if (!headerInfo.isHeader) {
      let res = this.findNearestParentHeader(
        this.nbTrack.currentWidget?.content.activeCellIndex
      );
      headerInfo = this.getHeaderInfo(
        this.nbTrack.currentWidget?.content.widgets[res]
      );
    }
    NotebookActions.insertAbove(this.nbTrack.currentWidget?.content);
    NotebookActions.setMarkdownHeader(
      this.nbTrack.currentWidget?.content,
      headerInfo.headerLevel
    );
    NotebookActions.changeCellType(this.nbTrack.currentWidget?.content, 'markdown');
    this.nbTrack.activeCell.editor.setSelection({
      start: { line: 0, column: headerInfo.headerLevel + 1 },
      end: { line: 0, column: 10 }
    });
    this.nbTrack.activeCell.editor.focus();
  }

  getHeaderInfo(cell: Cell): { isHeader: boolean; headerLevel: number; collapsed?: boolean } {
    if (cell == undefined) {
      return { isHeader: false, headerLevel: -1 };
    }
    if (!(cell instanceof MarkdownCell)) {
      return { isHeader: false, headerLevel: 7 };
    }
    let level = cell.headerLevel;
    let collapsed = cell.headerCollapsed;
    return { isHeader: level > 0, headerLevel: level, collapsed: collapsed };
  }
}
