/**
 * Security Timeline - Enhanced commit timeline with security overlays
 * 
 * Shows secrets introduced/removed and vulnerabilities over time.
 */

import { useMemo, useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import type { Commit } from '../../lib/github'
import { useSecurityStore } from '../../stores/securityStore'

interface SecurityTimelineProps {
  commits: Commit[]
  onCommitClick?: (commit: Commit) => void
}

export function SecurityTimeline({ commits, onCommitClick }: SecurityTimelineProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 800, height: 200 })
  const [hoveredCommit, setHoveredCommit] = useState<Commit | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })
  
  const { secretsByCommit, securityTimeline } = useSecurityStore()
  
  // Responsive sizing
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.offsetWidth,
          height: 200,
        })
      }
    }
    
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])
  
  // Process commits with security data
  const timelineData = useMemo(() => {
    return commits.map(commit => {
      const secrets = secretsByCommit.get(commit.sha) || []
      const timelinePoint = securityTimeline.find(p => p.commit === commit.sha)
      
      return {
        commit,
        date: new Date(commit.author.date),
        secretsCount: secrets.length,
        hasSecrets: secrets.length > 0,
        riskScore: timelinePoint?.riskScore || 0,
        secretsIntroduced: timelinePoint?.secretsIntroduced || 0,
        secretsRemoved: timelinePoint?.secretsRemoved || 0,
      }
    }).sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [commits, secretsByCommit, securityTimeline])
  
  // D3 scales
  const scales = useMemo(() => {
    const margin = { top: 30, right: 20, bottom: 40, left: 20 }
    const width = dimensions.width - margin.left - margin.right
    const height = dimensions.height - margin.top - margin.bottom
    
    const xScale = d3.scaleTime()
      .domain(d3.extent(timelineData, d => d.date) as [Date, Date])
      .range([0, width])
    
    const yScale = d3.scaleLinear()
      .domain([0, Math.max(d3.max(timelineData, d => d.riskScore) || 100, 100)])
      .range([height, 0])
    
    return { xScale, yScale, margin, width, height }
  }, [timelineData, dimensions])
  
  // Generate path for risk score area
  const areaPath = useMemo(() => {
    const areaGenerator = d3.area<typeof timelineData[0]>()
      .x(d => scales.xScale(d.date))
      .y0(scales.height)
      .y1(d => scales.yScale(d.riskScore))
      .curve(d3.curveMonotoneX)
    
    return areaGenerator(timelineData) || ''
  }, [timelineData, scales])
  
  // Generate line path
  const linePath = useMemo(() => {
    const lineGenerator = d3.line<typeof timelineData[0]>()
      .x(d => scales.xScale(d.date))
      .y(d => scales.yScale(d.riskScore))
      .curve(d3.curveMonotoneX)
    
    return lineGenerator(timelineData) || ''
  }, [timelineData, scales])
  
  const handleMouseMove = (event: React.MouseEvent, data: typeof timelineData[0]) => {
    const rect = containerRef.current?.getBoundingClientRect()
    if (rect) {
      setTooltipPos({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      })
    }
    setHoveredCommit(data.commit)
  }
  
  return (
    <div 
      ref={containerRef}
      className="rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border-subtle)] p-4 relative overflow-hidden"
    >
      <h3 className="font-semibold mb-4 flex items-center gap-2">
        <span>📊</span>
        Security Timeline
      </h3>
      
      <svg 
        ref={svgRef}
        width={dimensions.width} 
        height={dimensions.height}
        className="overflow-visible"
      >
        <defs>
          {/* Gradient for risk area */}
          <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff4444" stopOpacity="0.6" />
            <stop offset="50%" stopColor="#ff8c00" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#44cc44" stopOpacity="0.1" />
          </linearGradient>
          
          {/* Glow filter */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        
        <g transform={`translate(${scales.margin.left}, ${scales.margin.top})`}>
          {/* Risk area */}
          <motion.path
            d={areaPath}
            fill="url(#riskGradient)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
          />
          
          {/* Risk line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="#ff6b6b"
            strokeWidth={2}
            filter="url(#glow)"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: 'easeInOut' }}
          />
          
          {/* Secret markers */}
          {timelineData.filter(d => d.hasSecrets).map((d, i) => (
            <motion.g
              key={`secret-${i}`}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
            >
              {/* Pulsing ring */}
              <circle
                cx={scales.xScale(d.date)}
                cy={scales.yScale(d.riskScore)}
                r={10}
                fill="none"
                stroke="#ff4444"
                strokeWidth={2}
                opacity={0.5}
              >
                <animate
                  attributeName="r"
                  values="8;16;8"
                  dur="2s"
                  repeatCount="indefinite"
                />
                <animate
                  attributeName="opacity"
                  values="0.6;0;0.6"
                  dur="2s"
                  repeatCount="indefinite"
                />
              </circle>
              
              {/* Core dot */}
              <circle
                cx={scales.xScale(d.date)}
                cy={scales.yScale(d.riskScore)}
                r={6}
                fill="#ff4444"
                filter="url(#glow)"
                className="cursor-pointer"
                onMouseEnter={(e) => handleMouseMove(e, d)}
                onMouseLeave={() => setHoveredCommit(null)}
                onClick={() => onCommitClick?.(d.commit)}
              />
              
              {/* Secret count badge */}
              {d.secretsCount > 1 && (
                <text
                  x={scales.xScale(d.date)}
                  y={scales.yScale(d.riskScore) - 12}
                  textAnchor="middle"
                  fill="#ff4444"
                  fontSize={10}
                  fontWeight="bold"
                >
                  {d.secretsCount}
                </text>
              )}
            </motion.g>
          ))}
          
          {/* Regular commits (without secrets) */}
          {timelineData.filter(d => !d.hasSecrets).map((d, i) => (
            <circle
              key={`commit-${i}`}
              cx={scales.xScale(d.date)}
              cy={scales.yScale(d.riskScore)}
              r={3}
              fill="#44cc44"
              opacity={0.6}
              className="cursor-pointer hover:opacity-100"
              onMouseEnter={(e) => handleMouseMove(e, d)}
              onMouseLeave={() => setHoveredCommit(null)}
              onClick={() => onCommitClick?.(d.commit)}
            />
          ))}
          
          {/* X-axis */}
          <g transform={`translate(0, ${scales.height})`}>
            <line 
              x1={0} 
              x2={scales.width} 
              stroke="rgba(255,255,255,0.2)" 
            />
            {scales.xScale.ticks(6).map((tick, i) => (
              <g key={i} transform={`translate(${scales.xScale(tick)}, 0)`}>
                <line y2={6} stroke="rgba(255,255,255,0.2)" />
                <text
                  y={20}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.5)"
                  fontSize={10}
                >
                  {d3.timeFormat('%b %Y')(tick)}
                </text>
              </g>
            ))}
          </g>
          
          {/* Y-axis label */}
          <text
            transform="rotate(-90)"
            x={-scales.height / 2}
            y={-5}
            textAnchor="middle"
            fill="rgba(255,255,255,0.4)"
            fontSize={10}
          >
            Risk Score
          </text>
        </g>
      </svg>
      
      {/* Tooltip */}
      {hoveredCommit && (
        <motion.div
          className="absolute z-10 px-3 py-2 rounded-lg bg-black/90 backdrop-blur border border-white/20 pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 60,
            transform: 'translateX(-50%)',
          }}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-sm font-medium mb-1 truncate max-w-[200px]">
            {hoveredCommit.message}
          </div>
          <div className="text-xs text-gray-400">
            {hoveredCommit.author.name} • {new Date(hoveredCommit.author.date).toLocaleDateString()}
          </div>
          {secretsByCommit.get(hoveredCommit.sha)?.length ? (
            <div className="text-xs text-red-400 mt-1">
              ⚠️ {secretsByCommit.get(hoveredCommit.sha)?.length} secrets detected
            </div>
          ) : null}
        </motion.div>
      )}
      
      {/* Legend */}
      <div className="flex items-center gap-6 mt-4 text-xs text-[var(--color-text-muted)]">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#ff4444] animate-pulse" />
          <span>Secret Detected</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#44cc44]" />
          <span>Safe Commit</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-2 bg-gradient-to-r from-[#44cc44] via-[#ff8c00] to-[#ff4444] rounded" />
          <span>Risk Level</span>
        </div>
      </div>
    </div>
  )
}
