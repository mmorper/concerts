import { useMemo } from 'react'

export interface TreemapTile {
  id: string
  name: string
  normalizedName: string
  count: number
  color: string
  x: number
  y: number
  width: number
  height: number
  // For artist tiles
  firstYear?: number
  lastYear?: number
  years?: number[]
}

interface TreemapInput {
  id: string
  name: string
  normalizedName: string
  count: number
  color: string
  firstYear?: number
  lastYear?: number
  years?: number[]
}

interface UseTreemapLayoutOptions {
  data: TreemapInput[]
  width: number
  height: number
  padding?: number
}

/**
 * Squarify algorithm for treemap layout
 *
 * Creates near-square rectangles for better visualization.
 * Based on Bruls, Huizing, and van Wijk's squarified treemap algorithm.
 */
function squarify(
  data: TreemapInput[],
  x: number,
  y: number,
  width: number,
  height: number
): TreemapTile[] {
  if (data.length === 0) return []

  const total = data.reduce((sum, d) => sum + d.count, 0)
  if (total === 0) return []

  const tiles: TreemapTile[] = []
  // Sort by count descending for better layout
  const remaining = [...data].sort((a, b) => b.count - a.count)

  let currentX = x
  let currentY = y
  let currentWidth = width
  let currentHeight = height

  while (remaining.length > 0) {
    const isHorizontal = currentWidth >= currentHeight
    const side = isHorizontal ? currentHeight : currentWidth

    // Find optimal row using worst aspect ratio heuristic
    let row: TreemapInput[] = []
    let rowSum = 0
    let worstRatio = Infinity

    // Calculate remaining total for this iteration
    const remainingTotal = remaining.reduce((sum, d) => sum + d.count, 0)

    for (let i = 0; i < remaining.length; i++) {
      const testRow = [...row, remaining[i]]
      const testSum = rowSum + remaining[i].count

      // Calculate row size as proportion of current area
      const rowSize =
        (testSum / remainingTotal) *
        (isHorizontal ? currentWidth : currentHeight)

      // Calculate worst aspect ratio in this row
      let maxRatio = 0
      testRow.forEach((item) => {
        const itemSize = (item.count / testSum) * side
        if (rowSize > 0 && itemSize > 0) {
          const ratio = Math.max(rowSize / itemSize, itemSize / rowSize)
          maxRatio = Math.max(maxRatio, ratio)
        }
      })

      if (maxRatio <= worstRatio || row.length === 0) {
        row = testRow
        rowSum = testSum
        worstRatio = maxRatio
      } else {
        break
      }
    }

    // Layout the row
    const rowSize =
      (rowSum / remainingTotal) * (isHorizontal ? currentWidth : currentHeight)
    let offset = 0

    row.forEach((item) => {
      const itemSize = (item.count / rowSum) * side

      if (isHorizontal) {
        tiles.push({
          ...item,
          id: item.id,
          x: currentX,
          y: currentY + offset,
          width: rowSize,
          height: itemSize,
        })
        offset += itemSize
      } else {
        tiles.push({
          ...item,
          id: item.id,
          x: currentX + offset,
          y: currentY,
          width: itemSize,
          height: rowSize,
        })
        offset += itemSize
      }
    })

    // Update remaining area
    if (isHorizontal) {
      currentX += rowSize
      currentWidth -= rowSize
    } else {
      currentY += rowSize
      currentHeight -= rowSize
    }

    // Remove processed items from remaining
    remaining.splice(0, row.length)
  }

  return tiles
}

/**
 * Hook for computing treemap layout from data
 *
 * Memoizes the layout computation for performance.
 */
export function useTreemapLayout({
  data,
  width,
  height,
  padding = 2,
}: UseTreemapLayoutOptions): TreemapTile[] {
  return useMemo(() => {
    if (width <= 0 || height <= 0 || data.length === 0) {
      return []
    }

    // Apply padding to the container
    const paddedWidth = width - padding * 2
    const paddedHeight = height - padding * 2

    const tiles = squarify(data, padding, padding, paddedWidth, paddedHeight)

    // Apply inner padding between tiles (shrink each tile slightly)
    const tilePadding = 1
    return tiles.map((tile) => ({
      ...tile,
      x: tile.x + tilePadding,
      y: tile.y + tilePadding,
      width: Math.max(0, tile.width - tilePadding * 2),
      height: Math.max(0, tile.height - tilePadding * 2),
    }))
  }, [data, width, height, padding])
}
