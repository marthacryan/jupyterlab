import { NotebookActions } from './actions';

import { Cell, MarkdownCell } from '@jupyterlab/cells';

import { ElementExt } from '@lumino/domutils';
import { IHeadingsCollapser, INotebookTracker } from './tokens';

export class HeadingsCollapser implements IHeadingsCollapser {
  constructor(nbTrack: INotebookTracker) {
    nbTrack.currentChanged.connect(() => {
      nbTrack.currentWidget?.content.model?.stateChanged.connect(() => {
        if (
          nbTrack.currentWidget?.content?.widgets?.length &&
          nbTrack.currentWidget?.content?.widgets?.length > 1
        ) {
          nbTrack.currentWidget.content.widgets.forEach(
            (cell: Cell, i: number) => {
              if (cell instanceof MarkdownCell) {
                cell.toggleCollapsedSignal.connect(
                  (cell: MarkdownCell, isCollapsed: boolean) => {
                    this.setCellCollapse(nbTrack, i, isCollapsed);
                  }
                );
              }
            }
          );
        }
      });
    });

    nbTrack.activeCellChanged.connect(() => {
      this.handleCellChange(nbTrack);
    });
  }

  handleCellChange(nbTrack: INotebookTracker): any {
    if (nbTrack.currentWidget?.content.activeCellIndex) {
      this.uncollapseParent(
        nbTrack.currentWidget?.content.activeCellIndex,
        nbTrack
      );
    }
  }

  uncollapseParent(which: number, nbTrack: INotebookTracker): any {
    let nearestParentLoc = this.findNearestParentHeader(which, nbTrack);
    if (nearestParentLoc == -1) {
      // no parent, can't be collapsed so nothing to do.
      return;
    }
    let cell = nbTrack.currentWidget?.content.widgets[nearestParentLoc];
    if (!cell) {
      return;
    }
    if (!this.getCollapsedMetadata(cell) && !cell.isHidden) {
      // no uncollapsing needed.
      return;
    }
    if (cell.isHidden) {
      // recursively uncollapse this cell's parent then.
      this.uncollapseParent(nearestParentLoc, nbTrack);
    }
    if (this.getCollapsedMetadata(cell)) {
      // then uncollapse.
      this.setCellCollapse(nbTrack, nearestParentLoc, false);
    }
  }

  handleUp(nbTrack: INotebookTracker): any {
    if (
      !nbTrack.currentWidget?.content ||
      nbTrack.currentWidget?.content.activeCellIndex == 0
    ) {
      return;
    }
    nbTrack.currentWidget?.content.deselectAll();
    let newIndex = (nbTrack.currentWidget?.content?.activeCellIndex ?? 0) - 1;
    let newPotentialActiveCell =
      nbTrack.currentWidget?.content.widgets[newIndex];
    let isHidden = newPotentialActiveCell?.isHidden;
    if (isHidden) {
      let parentLoc = this.findNearestUncollapsedUpwards(newIndex, nbTrack);
      if (parentLoc == -1) {
        // no parent, can't be collapsed so nothing to do.
        return;
      }
      nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    } else {
      // normal operation.
      nbTrack.currentWidget.content.activeCellIndex -= 1;
    }
    if (nbTrack.activeCell) {
      ElementExt.scrollIntoViewIfNeeded(
        nbTrack.currentWidget?.content.node,
        nbTrack.activeCell.node
      );
    }
  }

  handleDown(nbTrack: INotebookTracker): any {
    nbTrack.currentWidget?.content.deselectAll();
    if (!nbTrack.currentWidget?.content.activeCellIndex) {
      return;
    }
    let newIndex = nbTrack.currentWidget?.content.activeCellIndex + 1;
    if (newIndex >= nbTrack.currentWidget?.content.widgets.length) {
      return;
    }
    let newPotentialActiveCell =
      nbTrack.currentWidget?.content.widgets[newIndex];
    let isHidden = newPotentialActiveCell.isHidden;
    if (isHidden) {
      let parentLoc = this.findNearestUncollapsedDownwards(newIndex, nbTrack);
      if (parentLoc == -1) {
        // no parent, can't be collapsed so nothing to do.
        return;
      }
      nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    } else {
      // normal operation.
      nbTrack.currentWidget.content.activeCellIndex += 1;
    }
    if (nbTrack.activeCell) {
      ElementExt.scrollIntoViewIfNeeded(
        nbTrack.currentWidget?.content.node,
        nbTrack.activeCell.node
      );
    }
  }

  findNearestUncollapsedUpwards(
    index: number,
    nbTrack: INotebookTracker
  ): number {
    // Finds the nearest header above the given cell. If the cell is a header itself, it does not return itself;
    // this can be checked directly by calling functions.
    if (
      !nbTrack.currentWidget?.content.widgets ||
      index >= nbTrack.currentWidget?.content.widgets.length
    ) {
      return -1;
    }
    while (index > 0) {
      index -= 1;
      let cell = nbTrack.currentWidget?.content.widgets[index];
      if (!cell?.isHidden) {
        return index;
      }
    }
    return -1; // else no unhidden found above.
  }

  findNearestUncollapsedDownwards(
    index: number,
    nbTrack: INotebookTracker
  ): number {
    // Finds the nearest header above the given cell. If the cell is a header itself, it does not return itself;
    // this can be checked directly by calling functions.
    if (
      !nbTrack.currentWidget?.content.widgets ||
      index >= nbTrack.currentWidget?.content.widgets.length ||
      index < 0
    ) {
      return -1;
    }
    while (index < nbTrack.currentWidget?.content.widgets.length - 1) {
      index += 1;
      let cell = nbTrack.currentWidget?.content.widgets[index];
      if (!cell?.isHidden) {
        return index;
      }
    }
    return -1; // else no unhidden found above.
  }

  collapseAll(nbTrack: INotebookTracker): any {
    if (nbTrack.currentWidget) {
      for (
        let cellI = 0;
        cellI < nbTrack.currentWidget?.content.widgets.length;
        cellI++
      ) {
        let cell = nbTrack.currentWidget?.content.widgets[cellI];
        if (this.getHeaderInfo(cell).isHeader) {
          this.setCellCollapse(nbTrack, cellI, true);
          // setCellCollapse tries to be smart and not change metadata of hidden cells.
          // that's not the desired behavior of this function though, which wants to act
          // as if the user clicked collapse on every level.
          this.setCollapsedMetadata(cell, true);
        }
      }
    }
  }

  uncollapseAll(nbTrack: INotebookTracker): any {
    if (nbTrack.currentWidget) {
      for (
        let cellI = 0;
        cellI < nbTrack.currentWidget?.content.widgets.length;
        cellI++
      ) {
        let cell = nbTrack.currentWidget?.content.widgets[cellI];
        if (this.getHeaderInfo(cell).isHeader) {
          this.setCellCollapse(nbTrack, cellI, false);
          // similar to collapseAll.
          this.setCollapsedMetadata(cell, false);
        }
      }
    }
  }

  findNextParentHeader(index: number, nbTrack: INotebookTracker): any {
    if (
      !nbTrack.currentWidget?.content.widgets ||
      index >= nbTrack.currentWidget?.content.widgets.length
    ) {
      return -1;
    }
    let childHeaderInfo = this.getHeaderInfo(
      nbTrack.currentWidget?.content.widgets[index]
    );
    for (
      let cellN = index + 1;
      cellN < nbTrack.currentWidget?.content.widgets.length;
      cellN++
    ) {
      let hInfo = this.getHeaderInfo(
        nbTrack.currentWidget?.content.widgets[cellN]
      );
      if (hInfo.isHeader && hInfo.headerLevel <= childHeaderInfo.headerLevel) {
        return cellN;
      }
    }
    // else no parent header found. return the index of the last cell
    return nbTrack.currentWidget?.content.widgets.length - 1;
  }

  findNearestParentHeader(index: number, nbTrack: INotebookTracker): number {
    // Finds the nearest header above the given cell. If the cell is a header itself, it does not return itself;
    // this can be checked directly by calling functions.
    if (
      !nbTrack.currentWidget?.content.widgets ||
      index >= nbTrack.currentWidget?.content.widgets.length
    ) {
      return -1; // strange...
    }
    let childHeaderInfo = this.getHeaderInfo(
      nbTrack.currentWidget?.content.widgets[index]
    );
    for (let cellN = index - 1; cellN >= 0; cellN--) {
      if (cellN < nbTrack.currentWidget?.content.widgets.length) {
        let hInfo = this.getHeaderInfo(
          nbTrack.currentWidget?.content.widgets[cellN]
        );
        if (hInfo.isHeader && hInfo.headerLevel < childHeaderInfo.headerLevel) {
          return cellN;
        }
      }
    }
    // else no parent header found.
    return -1;
  }

  removeButton(cell: Cell): any {
    if (cell.promptNode.getElementsByClassName('ch-button').length != 0) {
      cell.promptNode.removeChild(
        cell.promptNode.getElementsByClassName('ch-button')[0]
      );
    }
  }

  setCellCollapse(
    nbTrack: INotebookTracker,
    which: number,
    collapsing: boolean
  ): number {
    if (!nbTrack.currentWidget?.content.widgets.length) {
      return which + 1;
    }
    let cell = nbTrack.currentWidget?.content.widgets[which];
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
    this.setCollapsedMetadata(cell, collapsing);
    let localCollapsed = false;
    let localCollapsedLevel = 0;
    // iterate through all cells after the active cell.
    let cellNum = which + 1;
    for (
      cellNum = which + 1;
      cellNum < nbTrack.currentWidget?.content.widgets.length;
      cellNum++
    ) {
      let subCell = nbTrack.currentWidget?.content.widgets[cellNum];
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

      if (this.getCollapsedMetadata(subCell) && subCellHeaderInfo.isHeader) {
        localCollapsed = true;
        localCollapsedLevel = subCellHeaderInfo.headerLevel;
        // but don't collapse the locally collapsed header, so continue to
        // uncollapse the header. This will get noticed in the next round.
      }
      subCell.setHidden(false);
    }
    return cellNum + 1;
  }

  toggleCurrentCellCollapse(nbTrack: INotebookTracker): any {
    if (
      !nbTrack.activeCell ||
      !nbTrack.currentWidget?.content.activeCellIndex
    ) {
      return;
    }
    if (this.getHeaderInfo(nbTrack.activeCell).isHeader) {
      // Then toggle!
      let collapsing = !this.getCollapsedMetadata(nbTrack.activeCell);
      this.setCellCollapse(
        nbTrack,
        nbTrack.currentWidget.content.activeCellIndex,
        collapsing
      );
    } else {
      // then toggle parent!
      let parentLoc = this.findNearestParentHeader(
        nbTrack.currentWidget.content.activeCellIndex,
        nbTrack
      );
      if (parentLoc == -1) {
        // no parent, can't be collapsed so nothing to do.
        return;
      }
      this.setCellCollapse(
        nbTrack,
        parentLoc,
        !this.getCollapsedMetadata(
          nbTrack.currentWidget.content.widgets[parentLoc]
        )
      );
      // otherwise the active cell will still be the now (usually) hidden cell
      nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    }
    ElementExt.scrollIntoViewIfNeeded(
      nbTrack.currentWidget?.content.node,
      nbTrack.activeCell.node
    );
  }

  collapseCell(nbTrack: INotebookTracker): any {
    if (
      !nbTrack.activeCell ||
      !nbTrack.currentWidget?.content.activeCellIndex
    ) {
      return;
    }
    if (this.getHeaderInfo(nbTrack.activeCell).isHeader) {
      if (this.getCollapsedMetadata(nbTrack.activeCell)) {
        // Then move to nearest parent. Same behavior as the old nb extension.
        // Allows quick collapsing up the chain by <- <- <- presses if <- is a hotkey for this cmd.
        let parentLoc = this.findNearestParentHeader(
          nbTrack.currentWidget?.content.activeCellIndex,
          nbTrack
        );
        if (parentLoc == -1) {
          // no parent, stop going up the chain.
          return;
        }
        nbTrack.currentWidget.content.activeCellIndex = parentLoc;
      } else {
        // Then Collapse!
        this.setCellCollapse(
          nbTrack,
          nbTrack.currentWidget?.content.activeCellIndex,
          true
        );
      }
    } else {
      // then jump to previous parent.
      let parentLoc = this.findNearestParentHeader(
        nbTrack.currentWidget?.content.activeCellIndex,
        nbTrack
      );
      if (parentLoc == -1) {
        // no parent, can't be collapsed so nothing to do.
        return;
      }
      nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    }
    ElementExt.scrollIntoViewIfNeeded(
      nbTrack.currentWidget?.content.node,
      nbTrack.activeCell.node
    );
  }

  uncollapseCell(nbTrack: INotebookTracker): any {
    if (
      !nbTrack.activeCell ||
      !nbTrack.currentWidget?.content.activeCellIndex
    ) {
      return;
    }
    if (this.getHeaderInfo(nbTrack.activeCell).isHeader) {
      // Then uncollapse!
      this.setCellCollapse(
        nbTrack,
        nbTrack.currentWidget.content.activeCellIndex,
        false
      );
    } else {
      // then jump to next parent
      let parentLoc = this.findNextParentHeader(
        nbTrack.currentWidget.content.activeCellIndex,
        nbTrack
      );
      if (parentLoc == -1) {
        return;
      }
      nbTrack.currentWidget.content.activeCellIndex = parentLoc;
    }
    ElementExt.scrollIntoViewIfNeeded(
      nbTrack.currentWidget?.content.node,
      nbTrack.activeCell.node
    );
  }

  getCollapsedMetadata(cell: Cell): boolean {
    let metadata = cell.model.metadata;
    let collapsedData = false;
    // handle old metadata.
    if (metadata.has('Collapsed')) {
      metadata.set('heading_collapsed', metadata.get('Collapsed'));
      metadata.delete('Collapsed');
    }
    if (metadata.has('heading_collapsed')) {
      collapsedData = metadata.get('heading_collapsed') === 'true';
    } else {
      // default is false, not collapsed.
    }
    return collapsedData;
  }

  setCollapsedMetadata(cell: Cell, data: boolean): any {
    if (cell instanceof MarkdownCell) {
      cell.headerCollapsed = data;
    } else {
      cell.setHidden(data);
    }
  }

  addHeaderBelow(nbTrack: INotebookTracker): any {
    if (
      !nbTrack.activeCell ||
      !nbTrack.currentWidget?.content.activeCellIndex
    ) {
      return;
    }
    let headerInfo = this.getHeaderInfo(nbTrack.activeCell);
    if (!headerInfo.isHeader) {
      let parentHeaderIndex = this.findNearestParentHeader(
        nbTrack.currentWidget?.content.activeCellIndex,
        nbTrack
      );
      headerInfo = this.getHeaderInfo(
        nbTrack.currentWidget?.content.widgets[parentHeaderIndex]
      );
    }
    let res = this.findNextParentHeader(
      nbTrack.currentWidget?.content.activeCellIndex,
      nbTrack
    );
    nbTrack.currentWidget.content.activeCellIndex = res;
    NotebookActions.insertAbove(nbTrack.currentWidget?.content);
    NotebookActions.setMarkdownHeader(
      nbTrack.currentWidget?.content,
      headerInfo.headerLevel
    );
    NotebookActions.changeCellType(nbTrack.currentWidget?.content, 'markdown');
    nbTrack.activeCell.editor.setSelection({
      start: { line: 0, column: headerInfo.headerLevel + 1 },
      end: { line: 0, column: 10 }
    });
    nbTrack.activeCell.editor.focus();
  }

  addHeaderAbove(nbTrack: INotebookTracker): any {
    if (
      !nbTrack.activeCell ||
      !nbTrack.currentWidget?.content.activeCellIndex ||
      !nbTrack.currentWidget?.content.widgets
    ) {
      return;
    }
    let headerInfo = this.getHeaderInfo(nbTrack.activeCell);
    if (!headerInfo.isHeader) {
      let res = this.findNearestParentHeader(
        nbTrack.currentWidget?.content.activeCellIndex,
        nbTrack
      );
      headerInfo = this.getHeaderInfo(
        nbTrack.currentWidget?.content.widgets[res]
      );
    }
    NotebookActions.insertAbove(nbTrack.currentWidget?.content);
    NotebookActions.setMarkdownHeader(
      nbTrack.currentWidget?.content,
      headerInfo.headerLevel
    );
    NotebookActions.changeCellType(nbTrack.currentWidget?.content, 'markdown');
    nbTrack.activeCell.editor.setSelection({
      start: { line: 0, column: headerInfo.headerLevel + 1 },
      end: { line: 0, column: 10 }
    });
    nbTrack.activeCell.editor.focus();
  }

  getHeaderInfo(cell: Cell): { isHeader: boolean; headerLevel: number } {
    if (cell == undefined) {
      return { isHeader: false, headerLevel: -1 };
    }
    if (!(cell instanceof MarkdownCell)) {
      return { isHeader: false, headerLevel: 7 };
    }
    let level = cell.headerLevel;
    return { isHeader: level > 0, headerLevel: level };
  }
}
