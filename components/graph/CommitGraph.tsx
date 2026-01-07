"use client";

import { Commit, DEFAULT_GRAPH_CONFIG } from "@/lib/types";
import { calculateIndexArray } from "@/lib/graph/lane-assignment";
import { useEffect, useRef, useState, useMemo } from "react";

interface CommitGraphProps {
  commits: Commit[];
  onCommitClick?: (commit: Commit) => void;
}

interface CommitPosition {
  oid: string;
  cx: number;
  cy: number;
}

export default function CommitGraph({ commits, onCommitClick }: CommitGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);

  const config = DEFAULT_GRAPH_CONFIG;
  const commitSpacing = 50; // Vertical spacing between commits

  // Calculate index array for lane positioning
  const indexArray = useMemo(
    () => (commits.length > 0 ? calculateIndexArray(commits) : []),
    [commits]
  );

  // Calculate positions without mutating commits
  const commitPositions = useMemo(() => {
    const positions = new Map<string, CommitPosition>();
    commits.forEach((commit, i) => {
      const lane = commit.lineIndex || 0;
      const xIndex = indexArray[i]?.indexOf(lane) ?? lane;
      positions.set(commit.oid, {
        oid: commit.oid,
        cx: 30 + xIndex * config.laneWidth,
        cy: i * commitSpacing + 25,
      });
    });
    return positions;
  }, [commits, indexArray, config.laneWidth, commitSpacing]);

  // Calculate SVG dimensions
  const { width, height } = useMemo(() => {
    const maxLane = commits.length > 0
      ? Math.max(...commits.map((c) => c.lineIndex || 0))
      : 0;
    return {
      width: Math.min(30 + (maxLane + 1) * config.laneWidth, 200),
      height: commits.length * commitSpacing,
    };
  }, [commits, config.laneWidth, commitSpacing]);

  // Build commit lookup
  const commitDict = useMemo(() => {
    const dict = new Map<string, Commit>();
    commits.forEach((c) => dict.set(c.oid, c));
    return dict;
  }, [commits]);

  // Build lane to commit mapping for O(1) lookup
  const laneToCommit = useMemo(() => {
    const map = new Map<number, Commit>();
    commits.forEach((c) => {
      if (c.lineIndex !== undefined && !map.has(c.lineIndex)) {
        map.set(c.lineIndex, c);
      }
    });
    return map;
  }, [commits]);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={Math.max(height, 100)}
      className="flex-shrink-0"
      style={{ minWidth: width }}
    >
      {/* Draw connection lines */}
      {commits.map((commit, i) => {
        const pos = commitPositions.get(commit.oid);
        if (!pos) return null;

        const thisx = pos.cx;
        const thisy = pos.cy;

        return (
          <g key={`lines-${commit.oid}`}>
            {/* Lines to parents */}
            {commit.parents.map((parent, j) => {
              const parentCommit = commitDict.get(parent.oid);
              const parentPos = commitPositions.get(parent.oid);
              if (!parentCommit || !parentPos) return null;

              const nextx = parentPos.cx;
              const nexty = parentPos.cy;
              const color = parentCommit.color || "#999";

              return (
                <path
                  key={`${commit.oid}-${parent.oid}`}
                  d={drawCurve(thisx, thisy, nextx, nexty)}
                  stroke={color}
                  strokeWidth="2"
                  fill="none"
                />
              );
            })}

            {/* Lines for lane continuity */}
            {i < commits.length - 1 && indexArray[i] && indexArray[i + 1] && (
              <>
                {indexArray[i].map((lane) => {
                  if (!indexArray[i + 1].includes(lane)) return null;

                  const xPos = 30 + indexArray[i].indexOf(lane) * config.laneWidth;
                  const nextXPos = 30 + indexArray[i + 1].indexOf(lane) * config.laneWidth;
                  const yPos = thisy;
                  const nextCommitPos = commitPositions.get(commits[i + 1].oid);
                  const nextYPos = nextCommitPos?.cy || 0;

                  // Find color for this lane (O(1) lookup)
                  const laneCommit = laneToCommit.get(lane);
                  const color = laneCommit?.color || "#999";

                  // Only draw if this isn't the current commit's lane
                  if (commit.lineIndex !== lane) {
                    return (
                      <path
                        key={`lane-${i}-${lane}`}
                        d={drawCurve(xPos, yPos, nextXPos, nextYPos)}
                        stroke={color}
                        strokeWidth="2"
                        fill="none"
                        opacity="0.6"
                      />
                    );
                  }
                  return null;
                })}
              </>
            )}
          </g>
        );
      })}

      {/* Draw commit dots */}
      {commits.map((commit) => {
        const pos = commitPositions.get(commit.oid);
        if (!pos) return null;

        return (
          <g key={`commit-${commit.oid}`}>
            {/* Head commit indicator (outline circle) */}
            {commit.isHead && (
              <circle
                cx={pos.cx}
                cy={pos.cy}
                r="7"
                stroke={commit.color}
                strokeWidth="2"
                fill="none"
              />
            )}

            {/* Commit dot */}
            <circle
              cx={pos.cx}
              cy={pos.cy}
              r={config.commitRadius}
              fill={commit.color}
              className={`cursor-pointer transition-all ${
                hoveredCommit === commit.oid ? "r-6" : ""
              }`}
              onMouseEnter={() => setHoveredCommit(commit.oid)}
              onMouseLeave={() => setHoveredCommit(null)}
              onClick={() => onCommitClick?.(commit)}
            />

            {/* Invisible larger circle for easier hovering */}
            <circle
              cx={pos.cx}
              cy={pos.cy}
              r="12"
              fill="transparent"
              className="cursor-pointer"
              onMouseEnter={() => setHoveredCommit(commit.oid)}
              onMouseLeave={() => setHoveredCommit(null)}
              onClick={() => onCommitClick?.(commit)}
            />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * Draws a curved path between two points
 */
function drawCurve(
  startx: number,
  starty: number,
  endx: number,
  endy: number
): string {
  const firstLineEndY = starty + ((endy - starty - 40) / 2);
  const secondLineStartY = firstLineEndY + 40;

  return `M ${startx} ${starty} L ${startx} ${firstLineEndY} C ${startx} ${
    firstLineEndY + 20
  } , ${endx} ${firstLineEndY + 20} , ${endx} ${firstLineEndY + 40} L ${endx} ${endy}`;
}
