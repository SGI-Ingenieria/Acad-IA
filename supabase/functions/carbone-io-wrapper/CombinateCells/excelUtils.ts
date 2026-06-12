import { type Worksheet } from '@cj-tech-master/excelts'

/**
 * Converts an Excel column label to a 1-based number.
 * Example: A -> 1, Z -> 26, AA -> 27
 */
function columnToNumber(label: string): number {
  let n = 0

  for (let i = 0; i < label.length; i++) {
    n = n * 26 + label.charCodeAt(i) - 64
  }

  return n
}

type MergeRangePattern = {
  startColumn: string
  numberOfColumns: number
  firstStartRow: number
  mergeWidthInColumns: number
  mergeHeightInRows: number
  mergeBlockCount: number
  rowStepBetweenBlocks: number
  columnStepBetweenBlocks?: number // 👈 nuevo (opcional)
}

export function applyMergePattern(sheet: Worksheet, config: MergeRangePattern) {
  const {
    startColumn,
    numberOfColumns,
    firstStartRow,
    mergeWidthInColumns,
    mergeHeightInRows,
    mergeBlockCount,
    rowStepBetweenBlocks,
    columnStepBetweenBlocks = 1, // 👈 default
  } = config

  const firstCol = columnToNumber(startColumn)

  for (let block = 0; block < mergeBlockCount; block++) {
    const rowStart = firstStartRow + block * rowStepBetweenBlocks
    const rowEnd = rowStart + mergeHeightInRows - 1

    for (let i = 0; i < numberOfColumns; i++) {
      const colStart =
        firstCol + i * (mergeWidthInColumns + columnStepBetweenBlocks)

      const colEnd = colStart + mergeWidthInColumns - 1

      sheet.mergeCells(rowStart, colStart, rowEnd, colEnd)
    }
  }
}

type ColumnWidthPattern = {
  fromColumn: string
  numberOfBlocks: number
  columnStepBetweenBlocks: number
  widths: readonly number[]
}

export function applyColumnWidthPattern(
  sheet: Worksheet,
  config: ColumnWidthPattern,
) {
  const { fromColumn, numberOfBlocks, columnStepBetweenBlocks, widths } = config

  const startColumnNumber = columnToNumber(fromColumn)

  for (let block = 0; block < numberOfBlocks; block++) {
    const blockStartColumn = startColumnNumber + block * columnStepBetweenBlocks

    for (let i = 0; i < widths.length; i++) {
      const columnNumber = blockStartColumn + i
      sheet.getColumn(columnNumber).width = widths[i]
    }
  }
}
