"use client";

import { Commit, DEFAULT_GRAPH_CONFIG } from "@/lib/types";
import { calculateIndexArray } from "@/lib/graph/lane-assignment";
import { useEffect, useRef, useState } from "react";

interface CommitGraphProps {
  commits: Commit[];
  onCommitClick?: (commit: Commit) => void;
}

export default function CommitGraph({ commits, onCommitClick }: CommitGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);

  const config = DEFAULT_GRAPH_CONFIG;
  const commitSpacing = 50; // Vertical spacing between commits

  // Calculate index array for lane positioning
  const indexArray = commits.length > 0 ? calculateIndexArray(commits) : [];

  // Calculate SVG dimensions
  const maxLane = commits.length > 0
    ? Math.max(...commits.map((c) => c.lineIndex || 0))
    : 0;
  const width = Math.min(30 + (maxLane + 1) * config.laneWidth, 200);
  const height = commits.length * commitSpacing;

  // Assign x, y coordinates to commits
  commits.forEach((commit, i) => {
    const lane = commit.lineIndex || 0;
    const xIndex = indexArray[i]?.indexOf(lane) ?? lane;
    commit.cx = 30 + xIndex * config.laneWidth;
    commit.cy = i * commitSpacing + 25;
  });

  // Build commit lookup
  const commitDict = new Map<string, Commit>();
  commits.forEach((c) => commitDict.set(c.oid, c));

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
        const thisx = commit.cx || 0;
        const thisy = commit.cy || 0;

        return (
          <g key={`lines-${commit.oid}`}>
            {/* Lines to parents */}
            {commit.parents.map((parent, j) => {
              const parentCommit = commitDict.get(parent.oid);
              if (!parentCommit || !parentCommit.cy) return null;

              const nextx = parentCommit.cx || 0;
              const nexty = parentCommit.cy || 0;
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
                  const nextYPos = commits[i + 1].cy || 0;

                  // Find color for this lane
                  const laneCommit = commits.find((c) => c.lineIndex === lane);
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
      {commits.map((commit) => (
        <g key={`commit-${commit.oid}`}>
          {/* Head commit indicator (outline circle) */}
          {commit.isHead && (
            <circle
              cx={commit.cx}
              cy={commit.cy}
              r="7"
              stroke={commit.color}
              strokeWidth="2"
              fill="none"
            />
          )}

          {/* Commit dot */}
          <circle
            cx={commit.cx}
            cy={commit.cy}
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
            cx={commit.cx}
            cy={commit.cy}
            r="12"
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHoveredCommit(commit.oid)}
            onMouseLeave={() => setHoveredCommit(null)}
            onClick={() => onCommitClick?.(commit)}
          />
        </g>
      ))}
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
