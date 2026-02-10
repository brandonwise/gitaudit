/**
 * Dependency Galaxy - 3D Force-Directed Visualization
 * 
 * A stunning solar system-like visualization of dependencies.
 * Packages orbit as planets, connections as gravity lines.
 * Vulnerable nodes pulse with red energy.
 */

import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { ThreeEvent } from '@react-three/fiber'
import { OrbitControls, Text, Line, Stars, Html, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { useSecurityStore } from '../../stores/securityStore'
import type { DependencyNode, SupplyChainGraph } from '../../lib/supply'

interface GalaxyProps {
  graph: SupplyChainGraph | null
  onNodeClick?: (nodeId: string) => void
}

// Color palette for dependency types
const COLORS = {
  safe: '#44cc44',
  lowRisk: '#88cc44',
  mediumRisk: '#ffcc00',
  highRisk: '#ff8c00',
  critical: '#ff4444',
  selected: '#4488ff',
  connection: '#334455',
  connectionVuln: '#ff444444',
}

function getNodeColor(node: DependencyNode): string {
  const risk = node.riskScore || 0
  if (risk >= 75) return COLORS.critical
  if (risk >= 50) return COLORS.highRisk
  if (risk >= 25) return COLORS.mediumRisk
  if (risk > 0) return COLORS.lowRisk
  return COLORS.safe
}

function getNodeSize(node: DependencyNode): number {
  // Root nodes are larger
  if (node.depth === 0) return 0.8
  if (node.depth === 1) return 0.5
  return 0.3
}

// Single dependency node as a glowing sphere
function DependencyNode3D({ 
  node, 
  position, 
  isSelected,
  onSelect 
}: { 
  node: DependencyNode
  position: [number, number, number]
  isSelected: boolean
  onSelect: () => void
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)
  
  const color = isSelected ? COLORS.selected : getNodeColor(node)
  const size = getNodeSize(node)
  const isVulnerable = (node.riskScore || 0) > 0
  
  // Animate the node
  useFrame((state) => {
    if (!meshRef.current) return
    
    // Gentle floating animation
    meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.1
    
    // Pulsing for vulnerable nodes
    if (isVulnerable && glowRef.current) {
      const pulse = 0.5 + Math.sin(state.clock.elapsedTime * 3) * 0.5
      glowRef.current.scale.setScalar(1.2 + pulse * 0.3)
      ;(glowRef.current.material as THREE.MeshBasicMaterial).opacity = 0.3 + pulse * 0.2
    }
    
    // Scale on hover
    const targetScale = hovered ? 1.2 : 1
    meshRef.current.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.1)
  })
  
  return (
    <group position={position}>
      {/* Glow effect for vulnerable nodes */}
      {isVulnerable && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[size * 1.5, 32, 32]} />
          <meshBasicMaterial 
            color={color} 
            transparent 
            opacity={0.3}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}
      
      {/* Main sphere */}
      <mesh 
        ref={meshRef}
        onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect() }}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={isVulnerable ? 0.5 : 0.2}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      
      {/* Inner glow */}
      <mesh>
        <sphereGeometry args={[size * 0.7, 16, 16]} />
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.5}
        />
      </mesh>
      
      {/* Label on hover or selection */}
      {(hovered || isSelected) && (
        <Billboard>
          <Html center distanceFactor={10}>
            <div className="px-3 py-2 rounded-lg bg-black/80 backdrop-blur border border-white/20 whitespace-nowrap">
              <div className="text-sm font-semibold text-white">{node.name}</div>
              <div className="text-xs text-gray-400">{node.version}</div>
              {isVulnerable && (
                <div className="text-xs text-red-400 mt-1">
                  ⚠️ {node.vulnerabilityCount} vulnerabilities
                </div>
              )}
            </div>
          </Html>
        </Billboard>
      )}
    </group>
  )
}

// Connection line between nodes
function Connection({ 
  start, 
  end, 
  isVulnerable 
}: { 
  start: [number, number, number]
  end: [number, number, number]
  isVulnerable: boolean
}) {
  const points = useMemo(() => [
    new THREE.Vector3(...start),
    new THREE.Vector3(...end),
  ], [start, end])
  
  return (
    <Line
      points={points}
      color={isVulnerable ? COLORS.connectionVuln : COLORS.connection}
      lineWidth={isVulnerable ? 2 : 1}
      transparent
      opacity={0.4}
    />
  )
}

// Orbital ring decoration
function OrbitalRing({ radius, color }: { radius: number; color: string }) {
  return (
    <mesh rotation={[Math.PI / 2, 0, 0]}>
      <torusGeometry args={[radius, 0.02, 16, 100]} />
      <meshBasicMaterial color={color} transparent opacity={0.15} />
    </mesh>
  )
}

// Main galaxy scene
function GalaxyScene({ graph, onNodeClick }: GalaxyProps) {
  const { camera } = useThree()
  const selectedNode = useSecurityStore(state => state.galaxySelectedNode)
  const setSelectedNode = useSecurityStore(state => state.setGalaxySelectedNode)
  
  // Calculate node positions using force-directed layout
  const { nodePositions, edges } = useMemo(() => {
    if (!graph) return { nodePositions: new Map(), edges: [] }
    
    const positions = new Map<string, [number, number, number]>()
    const nodeArray = Array.from(graph.nodes.entries())
    
    // Simple radial layout based on depth
    const depthGroups = new Map<number, typeof nodeArray>()
    for (const [id, node] of nodeArray) {
      const group = depthGroups.get(node.depth) || []
      group.push([id, node])
      depthGroups.set(node.depth, group)
    }
    
    // Position nodes in concentric rings
    for (const [depth, nodes] of depthGroups) {
      const radius = 3 + depth * 4
      const angleStep = (2 * Math.PI) / nodes.length
      
      nodes.forEach(([id, _node], i) => {
        const angle = i * angleStep + (depth * 0.5) // Offset each ring
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        const y = (Math.random() - 0.5) * 2 // Slight vertical variation
        positions.set(id, [x, y, z])
      })
    }
    
    // Map edges to positions
    const edgeData = graph.edges.map(e => ({
      from: e.from,
      to: e.to,
      start: positions.get(e.from) || [0, 0, 0] as [number, number, number],
      end: positions.get(e.to) || [0, 0, 0] as [number, number, number],
      isVulnerable: (graph.nodes.get(e.to)?.riskScore || 0) > 0,
    }))
    
    return { nodePositions: positions, edges: edgeData }
  }, [graph])
  
  // Camera focus on selected node
  useEffect(() => {
    if (selectedNode && nodePositions.has(selectedNode)) {
      const pos = nodePositions.get(selectedNode)!
      // Smoothly move camera to look at selected node
      camera.lookAt(new THREE.Vector3(...pos))
    }
  }, [selectedNode, nodePositions, camera])
  
  if (!graph) {
    return (
      <Text
        position={[0, 0, 0]}
        fontSize={0.5}
        color="white"
        anchorX="center"
        anchorY="middle"
      >
        No dependency data loaded
      </Text>
    )
  }
  
  const nodes = Array.from(graph.nodes.entries()) as [string, DependencyNode][]
  
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={1} />
      <pointLight position={[-10, -10, -10]} intensity={0.5} color="#4488ff" />
      
      {/* Star field background */}
      <Stars 
        radius={100} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={1}
      />
      
      {/* Orbital rings for visual depth */}
      <OrbitalRing radius={5} color="#4488ff" />
      <OrbitalRing radius={9} color="#44cc88" />
      <OrbitalRing radius={13} color="#cc8844" />
      
      {/* Connection lines */}
      {edges.map((edge, i) => (
        <Connection
          key={`edge-${i}`}
          start={edge.start}
          end={edge.end}
          isVulnerable={edge.isVulnerable}
        />
      ))}
      
      {/* Dependency nodes */}
      {nodes.map(([id, node]) => (
        <DependencyNode3D
          key={id}
          node={node}
          position={nodePositions.get(id) || [0, 0, 0]}
          isSelected={selectedNode === id}
          onSelect={() => {
            setSelectedNode(id)
            onNodeClick?.(id)
          }}
        />
      ))}
      
      {/* Center sun (represents the project) */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1, 64, 64]} />
        <meshStandardMaterial
          color="#ffa500"
          emissive="#ff6600"
          emissiveIntensity={0.8}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshBasicMaterial
          color="#ff8800"
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Camera controls */}
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        minDistance={5}
        maxDistance={50}
        autoRotate
        autoRotateSpeed={0.3}
      />
    </>
  )
}

// Legend component
function GalaxyLegend() {
  return (
    <div className="absolute bottom-4 left-4 p-4 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
      <h4 className="text-sm font-semibold mb-3 text-white">Risk Level</h4>
      <div className="space-y-2">
        {[
          { color: COLORS.safe, label: 'Safe' },
          { color: COLORS.lowRisk, label: 'Low Risk' },
          { color: COLORS.mediumRisk, label: 'Medium Risk' },
          { color: COLORS.highRisk, label: 'High Risk' },
          { color: COLORS.critical, label: 'Critical' },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-2">
            <div 
              className="w-3 h-3 rounded-full" 
              style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }}
            />
            <span className="text-xs text-gray-300">{label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// Stats overlay
function GalaxyStats({ graph }: { graph: SupplyChainGraph | null }) {
  if (!graph) return null
  
  return (
    <div className="absolute top-4 right-4 p-4 rounded-xl bg-black/60 backdrop-blur-sm border border-white/10">
      <h4 className="text-sm font-semibold mb-3 text-white">Supply Chain</h4>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <div className="text-2xl font-bold text-white">{graph.stats.totalDeps}</div>
          <div className="text-xs text-gray-400">Total Deps</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{graph.stats.directDeps}</div>
          <div className="text-xs text-gray-400">Direct</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-orange-400">{graph.stats.vulnerableCount}</div>
          <div className="text-xs text-gray-400">Vulnerable</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-white">{graph.stats.maxDepth}</div>
          <div className="text-xs text-gray-400">Max Depth</div>
        </div>
      </div>
    </div>
  )
}

// Main component export
export function DependencyGalaxy({ graph, onNodeClick }: GalaxyProps) {
  return (
    <div className="relative w-full h-[600px] rounded-xl overflow-hidden bg-[#050510] border border-white/10">
      <Canvas
        camera={{ position: [0, 15, 25], fov: 60 }}
        gl={{ antialias: true, alpha: true }}
      >
        <GalaxyScene graph={graph} onNodeClick={onNodeClick} />
      </Canvas>
      
      <GalaxyLegend />
      <GalaxyStats graph={graph} />
      
      {/* Instructions */}
      <div className="absolute bottom-4 right-4 text-xs text-gray-500">
        Drag to rotate • Scroll to zoom • Click nodes to inspect
      </div>
    </div>
  )
}
