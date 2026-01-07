"use client";

import { Commit, DEFAULT_GRAPH_CONFIG } from "@/lib/types";
import { calculateIndexArray } from "@/lib/graph/topological-lane-assignment";
import { useRef, useState, useMemo } from "react";

const COLLAPSED_HEIGHT = 50; // px - must match CommitList
const EXPANDED_HEIGHT = 200; // px - must match CommitList
const GRAPH_LINE_WIDTH = 2.5;
const BRANCH_LABEL = {
  fontSize: 10,
  height: 18,
  paddingX: 6,
  markerRadius: 3,
  markerGap: 4,
  minWidth: 70,
  maxWidth: 180,
  offsetX: 16,
  gapY: 4,
  maxLabelsPerCommit: 4,
};

const MAX_LABEL_CHARS = Math.max(
  4,
  Math.floor(
    (BRANCH_LABEL.maxWidth -
      BRANCH_LABEL.paddingX * 2 -
      BRANCH_LABEL.markerRadius * 2 -
      BRANCH_LABEL.markerGap) /
      (BRANCH_LABEL.fontSize * 0.6)
  )
);

interface CommitGraphProps {
  commits: Commit[];
  expandedCommit: string | null;
  heads: Array<{ name: string; oid: string }>;
  repoOwner: string;
  repoName: string;
}

interface CommitPosition {
  oid: string;
  cx: number;
  cy: number;
}

interface BranchLabel {
  key: string;
  text: string;
  fullText: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  startX: number;
  startY: number;
}

export default function CommitGraph({
  commits,
  expandedCommit,
  heads,
  repoOwner,
  repoName,
}: CommitGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hoveredCommit, setHoveredCommit] = useState<string | null>(null);

  const config = DEFAULT_GRAPH_CONFIG;

  // Calculate index array for lane positioning
  const indexArray = useMemo(
    () => (commits.length > 0 ? calculateIndexArray(commits) : []),
    [commits]
  );

  const headBranchesByOid = useMemo(() => {
    const map = new Map<string, string[]>();
    heads.forEach((head) => {
      const existing = map.get(head.oid);
      if (existing) {
        existing.push(head.name);
      } else {
        map.set(head.oid, [head.name]);
      }
    });
    return map;
  }, [heads]);

  const labelColumnWidth = useMemo(() => {
    let maxWidth = 0;

    for (const branches of headBranchesByOid.values()) {
      const orderedBranches = sortBranches(branches);
      const labelTexts = buildLabelTexts(orderedBranches);

      labelTexts.forEach((rawText) => {
        const trimmedText = truncateLabel(rawText, MAX_LABEL_CHARS);
        const textWidth = estimateTextWidth(trimmedText, BRANCH_LABEL.fontSize);
        const labelWidth = Math.min(
          BRANCH_LABEL.maxWidth,
          Math.max(
            BRANCH_LABEL.minWidth,
            textWidth +
              BRANCH_LABEL.paddingX * 2 +
              BRANCH_LABEL.markerRadius * 2 +
              BRANCH_LABEL.markerGap
          )
        );

        maxWidth = Math.max(maxWidth, labelWidth);
      });
    }

    return maxWidth > 0 ? maxWidth + BRANCH_LABEL.offsetX : 0;
  }, [headBranchesByOid]);

  // Calculate positions with cumulative Y based on expanded state
  const commitPositions = useMemo(() => {
    const positions = new Map<string, CommitPosition>();
    let cumulativeY = 0;
    const graphOffsetX = labelColumnWidth;

    commits.forEach((commit, i) => {
      const lane = commit.lineIndex || 0;
      const xIndex = indexArray[i]?.indexOf(lane) ?? lane;
      const rowHeight = expandedCommit === commit.oid ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT;

      positions.set(commit.oid, {
        oid: commit.oid,
        cx: graphOffsetX + 30 + xIndex * config.laneWidth,
        cy: cumulativeY + rowHeight / 2, // Center dot vertically in row
      });

      cumulativeY += rowHeight;
    });
    return positions;
  }, [commits, indexArray, config.laneWidth, expandedCommit, labelColumnWidth]);

  // Calculate SVG dimensions (graph lanes only)
  const { graphWidth, totalHeight } = useMemo(() => {
    const maxLane = commits.length > 0
      ? Math.max(...commits.map((c) => c.lineIndex || 0))
      : 0;

    // Calculate total height based on expanded state
    const computedTotalHeight = commits.reduce((sum, commit) => {
      return sum + (expandedCommit === commit.oid ? EXPANDED_HEIGHT : COLLAPSED_HEIGHT);
    }, 0);

    return {
      graphWidth: 30 + (maxLane + 1) * config.laneWidth,
      totalHeight: computedTotalHeight,
    };
  }, [commits, config.laneWidth, expandedCommit]);

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

  const laneToHeadBranches = useMemo(() => {
    const map = new Map<number, string[]>();
    commits.forEach((commit) => {
      if (commit.lineIndex === undefined) return;
      const headBranches = headBranchesByOid.get(commit.oid);
      if (!headBranches || headBranches.length === 0) return;

      const existing = map.get(commit.lineIndex);
      if (existing) {
        headBranches.forEach((branch) => {
          if (!existing.includes(branch)) {
            existing.push(branch);
          }
        });
      } else {
        map.set(commit.lineIndex, [...headBranches]);
      }
    });
    return map;
  }, [commits, headBranchesByOid]);

  const branchLabels = useMemo(() => {
    const labels: BranchLabel[] = [];

    commits.forEach((commit) => {
      const headBranches = headBranchesByOid.get(commit.oid);
      if (!headBranches || headBranches.length === 0) return;
      const pos = commitPositions.get(commit.oid);
      if (!pos) return;

      const color = commit.color || "#999";
      const orderedBranches = sortBranches(headBranches);
      const labelTexts = buildLabelTexts(orderedBranches);

      const blockHeight = labelTexts.length * BRANCH_LABEL.height +
        Math.max(0, labelTexts.length - 1) * BRANCH_LABEL.gapY;

      labelTexts.forEach((rawText, index) => {
        const trimmedText = truncateLabel(rawText, MAX_LABEL_CHARS);
        const textWidth = estimateTextWidth(trimmedText, BRANCH_LABEL.fontSize);
        const labelWidth = Math.min(
          BRANCH_LABEL.maxWidth,
          Math.max(
            BRANCH_LABEL.minWidth,
            textWidth +
              BRANCH_LABEL.paddingX * 2 +
              BRANCH_LABEL.markerRadius * 2 +
              BRANCH_LABEL.markerGap
          )
        );

        const centerY = pos.cy - blockHeight / 2 +
          index * (BRANCH_LABEL.height + BRANCH_LABEL.gapY) +
          BRANCH_LABEL.height / 2;

        labels.push({
          key: `${commit.oid}-${rawText}`,
          text: trimmedText,
          fullText: rawText,
          color,
          x: BRANCH_LABEL.offsetX,
          y: centerY,
          width: labelWidth,
          height: BRANCH_LABEL.height,
          startX: pos.cx - config.commitRadius - 4,
          startY: pos.cy,
        });
      });
    });

    return {
      labels,
      columnWidth: labelColumnWidth,
    };
  }, [commits, commitPositions, config.commitRadius, headBranchesByOid, labelColumnWidth]);

  const graphOffsetX = labelColumnWidth;
  const svgWidth = graphWidth + branchLabels.columnWidth;
  const commitUrlBase = repoOwner && repoName
    ? `https://github.com/${repoOwner}/${repoName}/commit/`
    : "";

  return (
    <svg
      ref={svgRef}
      width={svgWidth}
      height={Math.max(totalHeight, 100)}
      className="flex-shrink-0"
      style={{ minWidth: svgWidth }}
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
            {commit.parents.map((parent) => {
              const parentCommit = commitDict.get(parent.oid);
              const parentPos = commitPositions.get(parent.oid);
              if (!parentCommit || !parentPos) return null;

              const nextx = parentPos.cx;
              const nexty = parentPos.cy;
              const color = commit.color || parentCommit.color || "#999";
              const lineBranches = laneToHeadBranches.get(commit.lineIndex ?? -1)
                ?? commit.branches;
              const lineTitle = lineBranches.length > 0
                ? `Branches: ${formatBranches(lineBranches)}`
                : "Branches: unknown";

              return (
                <path
                  key={`${commit.oid}-${parent.oid}`}
                  d={drawCurve(thisx, thisy, nextx, nexty)}
                  stroke={color}
                  strokeWidth={GRAPH_LINE_WIDTH}
                  fill="none"
                  strokeLinecap="round"
                >
                  <title>{lineTitle}</title>
                </path>
              );
            })}

            {/* Lines for lane continuity */}
            {i < commits.length - 1 && indexArray[i] && indexArray[i + 1] && (
              <>
                {indexArray[i].map((lane) => {
                  if (!indexArray[i + 1].includes(lane)) return null;

                  const xPos = graphOffsetX + 30 + indexArray[i].indexOf(lane) * config.laneWidth;
                  const nextXPos = graphOffsetX + 30 + indexArray[i + 1].indexOf(lane) * config.laneWidth;
                  const yPos = thisy;
                  const nextCommitPos = commitPositions.get(commits[i + 1].oid);
                  const nextYPos = nextCommitPos?.cy || 0;

                  // Find color for this lane (O(1) lookup)
                  const laneCommit = laneToCommit.get(lane);
                  const color = laneCommit?.color || "#999";
                  const lineBranches = laneToHeadBranches.get(lane)
                    ?? laneCommit?.branches
                    ?? [];
                  const lineTitle = lineBranches.length > 0
                    ? `Branches: ${formatBranches(lineBranches)}`
                    : `Lane ${lane + 1}`;

                  // Only draw if this isn't the current commit's lane
                  if (commit.lineIndex !== lane) {
                    return (
                      <path
                        key={`lane-${i}-${lane}`}
                        d={drawCurve(xPos, yPos, nextXPos, nextYPos)}
                        stroke={color}
                        strokeWidth={GRAPH_LINE_WIDTH}
                        fill="none"
                        opacity="0.6"
                        strokeLinecap="round"
                      >
                        <title>{lineTitle}</title>
                      </path>
                    );
                  }
                  return null;
                })}
              </>
            )}
          </g>
        );
      })}

      {/* Branch labels with curved connectors */}
      {branchLabels.labels.map((label) => {
        const connectorEndX = label.x + label.width + 6;

        return (
          <g key={`branch-label-${label.key}`}>
            <title>{label.fullText}</title>
            <path
              d={drawLabelCurve(label.startX, label.startY, connectorEndX, label.y)}
              stroke={label.color}
              strokeWidth="1.5"
              fill="none"
              opacity="0.7"
            />
            <rect
              x={label.x}
              y={label.y - label.height / 2}
              width={label.width}
              height={label.height}
              rx={label.height / 2}
              fill={toRgba(label.color, 0.12)}
              stroke={label.color}
              strokeWidth="1"
            />
            <circle
              cx={label.x + BRANCH_LABEL.paddingX + BRANCH_LABEL.markerRadius}
              cy={label.y}
              r={BRANCH_LABEL.markerRadius}
              fill={label.color}
            />
            <text
              x={label.x + BRANCH_LABEL.paddingX + BRANCH_LABEL.markerRadius * 2 + BRANCH_LABEL.markerGap}
              y={label.y}
              fontSize={BRANCH_LABEL.fontSize}
              fontWeight="600"
              fill={label.color}
              dominantBaseline="middle"
            >
              {label.text}
            </text>
          </g>
        );
      })}

      {/* Draw commit dots */}
      {commits.map((commit) => {
        const pos = commitPositions.get(commit.oid);
        if (!pos) return null;
        const commitUrl = commitUrlBase ? `${commitUrlBase}${commit.oid}` : "";
        const nodeContent = (
          <>
            {/* Head commit indicator (outline circle) */}
            {commit.isHead && (
              <circle
                cx={pos.cx}
                cy={pos.cy}
                r="7"
                stroke={commit.color}
                strokeWidth={GRAPH_LINE_WIDTH}
                fill="none"
              />
            )}

            {/* Commit dot */}
            <circle
              cx={pos.cx}
              cy={pos.cy}
              r={config.commitRadius}
              fill={commit.color}
              className={`transition-all ${
                hoveredCommit === commit.oid ? "r-6" : ""
              }`}
              onMouseEnter={() => setHoveredCommit(commit.oid)}
              onMouseLeave={() => setHoveredCommit(null)}
            >
              <title>
                {commit.messageHeadline}
                {"\n"}SHA: {commit.oid.substring(0, 7)}
                {"\n"}Author: {commit.author.name}
                {commit.branches.length > 0 && `\nBranches: ${commit.branches.join(", ")}`}
              </title>
            </circle>

            {/* Invisible larger circle for easier hovering */}
            <circle
              cx={pos.cx}
              cy={pos.cy}
              r="12"
              fill="transparent"
              onMouseEnter={() => setHoveredCommit(commit.oid)}
              onMouseLeave={() => setHoveredCommit(null)}
            >
              <title>
                {commit.messageHeadline}
                {"\n"}SHA: {commit.oid.substring(0, 7)}
                {"\n"}Author: {commit.author.name}
                {commit.branches.length > 0 && `\nBranches: ${commit.branches.join(", ")}`}
              </title>
            </circle>
          </>
        );

        return (
          <g key={`commit-${commit.oid}`}>
            {commitUrl ? (
              <a
                href={commitUrl}
                target="_blank"
                rel="noreferrer"
                className="cursor-pointer"
              >
                {nodeContent}
              </a>
            ) : (
              nodeContent
            )}
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

function drawLabelCurve(
  startx: number,
  starty: number,
  endx: number,
  endy: number
): string {
  const midx = startx + (endx - startx) * 0.4;
  return `M ${startx} ${starty} C ${midx} ${starty}, ${midx} ${endy}, ${endx} ${endy}`;
}

function sortBranches(branches: string[]): string[] {
  return [...branches].sort((a, b) => {
    const key = (name: string) => {
      const lower = name.toLowerCase();
      if (lower === "main") return 0;
      if (lower === "master") return 1;
      return 2;
    };
    const keyDiff = key(a) - key(b);
    if (keyDiff !== 0) return keyDiff;
    return a.localeCompare(b, undefined, { sensitivity: "base" });
  });
}

function buildLabelTexts(branches: string[]): string[] {
  const visibleLimit = Math.max(1, BRANCH_LABEL.maxLabelsPerCommit - 1);
  const hasOverflow = branches.length > BRANCH_LABEL.maxLabelsPerCommit;
  const overflowCount = branches.length - visibleLimit;
  return hasOverflow
    ? [...branches.slice(0, visibleLimit), `+${overflowCount} more`]
    : branches;
}

function formatBranches(branches: string[]): string {
  const uniqueBranches = Array.from(new Set(branches));
  const maxVisible = 3;
  if (uniqueBranches.length <= maxVisible) {
    return uniqueBranches.join(", ");
  }
  const extraCount = uniqueBranches.length - maxVisible;
  return `${uniqueBranches.slice(0, maxVisible).join(", ")} +${extraCount} more`;
}

function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.6;
}

function truncateLabel(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }
  if (maxChars <= 3) {
    return text.slice(0, maxChars);
  }
  return `${text.slice(0, maxChars - 3)}...`;
}

function toRgba(hex: string, alpha: number): string {
  const normalized = hex.replace("#", "");
  const isShort = normalized.length === 3;
  const expanded = isShort
    ? normalized.split("").map((c) => `${c}${c}`).join("")
    : normalized;

  if (expanded.length !== 6) {
    return `rgba(0,0,0,${alpha})`;
  }

  const red = parseInt(expanded.slice(0, 2), 16);
  const green = parseInt(expanded.slice(2, 4), 16);
  const blue = parseInt(expanded.slice(4, 6), 16);
  return `rgba(${red},${green},${blue},${alpha})`;
}
