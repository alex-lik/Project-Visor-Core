'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  Network,
  Plus,
  Trash2,
  ExternalLink,
  ArrowRight,
  Bot,
  Globe,
  Layers,
  Terminal,
  Server,
  Lightbulb,
  Maximize2,
  RefreshCw,
} from 'lucide-react';
import CreateRelationModal from '@/components/CreateRelationModal';
import { STATUS_COLORS, RELATION_LABELS } from '@/lib/utils';

interface Node {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: string;
  priority: string;
  hostName?: string;
  x?: number;
  y?: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  relationType: string;
  label: string;
  color: string;
  description?: string;
}

export default function ArchitectureGraphPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNode, setSelectedNode] = useState<Node | null>(null);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Dragging state
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  const fetchGraphData = async () => {
    try {
      const res = await fetch('/api/relations');
      const data = await res.json();
      if (data.nodes) {
        // Layout nodes in a nice circle/grid initially if coordinates not set
        const count = data.nodes.length;
        const radius = Math.min(300, Math.max(180, count * 50));
        const centerX = 450;
        const centerY = 320;

        const positionedNodes = data.nodes.map((node: Node, idx: number) => {
          const angle = (idx / count) * 2 * Math.PI;
          return {
            ...node,
            x: Math.round(centerX + radius * Math.cos(angle)),
            y: Math.round(centerY + radius * Math.sin(angle)),
          };
        });

        setNodes(positionedNodes);
      }
      if (data.edges) setEdges(data.edges);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGraphData();
  }, []);

  const handleMouseDown = (e: React.MouseEvent, node: Node) => {
    e.stopPropagation();
    setDraggingNodeId(node.id);
    setSelectedNode(node);
    if (svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left - (node.x || 0),
        y: e.clientY - rect.top - (node.y || 0),
      });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!draggingNodeId || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const newX = Math.max(100, Math.min(rect.width - 100, e.clientX - rect.left - dragOffset.x));
    const newY = Math.max(80, Math.min(rect.height - 80, e.clientY - rect.top - dragOffset.y));

    setNodes((prev) =>
      prev.map((n) => (n.id === draggingNodeId ? { ...n, x: newX, y: newY } : n))
    );
  };

  const handleMouseUp = () => {
    setDraggingNodeId(null);
  };

  const handleDeleteRelation = async (relationId: string) => {
    if (!confirm('Удалить эту связь?')) return;
    try {
      await fetch(`/api/relations?id=${relationId}`, { method: 'DELETE' });
      fetchGraphData();
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <Network className="w-7 h-7 text-cyan-400" /> Граф связей и архитектуры
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Интерактивная карта взаимных зависимостей, вызовов API, баз данных и вебхуков между проектами. Перетаскивайте узлы мышью.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchGraphData}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors"
            title="Обновить схему"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white text-xs font-semibold shadow-lg shadow-cyan-500/20 transition-all flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Добавить связь
          </button>
        </div>
      </div>

      {/* Main Canvas + Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* SVG Interactive Canvas */}
        <div className="lg:col-span-3 rounded-2xl bg-[#0b101c] border border-slate-800 overflow-hidden relative shadow-2xl min-h-[620px] flex items-center justify-center select-none">
          {/* Background grid */}
          <div className="absolute inset-0 bg-grid-pattern opacity-40 pointer-events-none" />

          {/* Legend */}
          <div className="absolute top-4 left-4 p-3 rounded-xl bg-slate-900/90 border border-slate-800 backdrop-blur-md text-[11px] font-mono space-y-1.5 z-10">
            <div className="text-slate-400 font-bold uppercase text-[10px] mb-1">Типы связей</div>
            {Object.entries(RELATION_LABELS).map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <span className="w-3 h-1 rounded-full" style={{ backgroundColor: val.color }} />
                <span className="text-slate-300">{val.label}</span>
              </div>
            ))}
          </div>

          <svg
            ref={svgRef}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="w-full h-[620px] cursor-crosshair"
          >
            <defs>
              {/* Arrowhead markers */}
              {edges.map((e) => (
                <marker
                  key={`marker-${e.id}`}
                  id={`arrow-${e.id}`}
                  viewBox="0 0 10 10"
                  refX="28"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill={e.color || '#94a3b8'} />
                </marker>
              ))}
            </defs>

            {/* Edges */}
            {edges.map((edge) => {
              const src = nodes.find((n) => n.id === edge.source);
              const tgt = nodes.find((n) => n.id === edge.target);
              if (!src || !tgt || src.x === undefined || tgt.x === undefined) return null;

              const dx = (tgt.x || 0) - (src.x || 0);
              const dy = (tgt.y || 0) - (src.y || 0);
              const mx = (src.x || 0) + dx / 2;
              const my = (src.y || 0) + dy / 2 - 20;

              return (
                <g key={edge.id} className="group cursor-pointer">
                  {/* Glowing line on hover */}
                  <path
                    d={`M ${src.x} ${src.y} Q ${mx} ${my} ${tgt.x} ${tgt.y}`}
                    stroke={edge.color || '#94a3b8'}
                    strokeWidth="2"
                    fill="none"
                    strokeDasharray="4 2"
                    markerEnd={`url(#arrow-${edge.id})`}
                    className="opacity-80 group-hover:opacity-100 group-hover:stroke-cyan-400 transition-all"
                  />
                  {/* Center badge label on path */}
                  <text
                    x={mx}
                    y={my}
                    fill={edge.color || '#94a3b8'}
                    fontSize="10"
                    fontFamily="monospace"
                    textAnchor="middle"
                    className="bg-black select-none pointer-events-none"
                  >
                    {edge.label}
                  </text>
                </g>
              );
            })}

            {/* Nodes */}
            {nodes.map((node) => {
              const isSelected = selectedNode?.id === node.id;
              const statusCfg = STATUS_COLORS[node.status] || STATUS_COLORS.idea;

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x || 200}, ${node.y || 200})`}
                  onMouseDown={(e) => handleMouseDown(e, node)}
                  className="cursor-grab active:cursor-grabbing transition-transform"
                >
                  {/* Outer circle glow for selected */}
                  {isSelected && (
                    <rect
                      x="-85"
                      y="-30"
                      width="170"
                      height="60"
                      rx="16"
                      fill="none"
                      stroke="#06b6d4"
                      strokeWidth="2.5"
                      className="animate-pulse"
                    />
                  )}

                  {/* Node container card */}
                  <rect
                    x="-80"
                    y="-25"
                    width="160"
                    height="50"
                    rx="12"
                    fill="#0f172a"
                    stroke={isSelected ? '#06b6d4' : '#1e293b'}
                    strokeWidth="1.5"
                    className="filter drop-shadow-lg"
                  />

                  {/* Status dot */}
                  <circle cx="-62" cy="-4" r="4.5" fill={statusCfg.dot.includes('emerald') ? '#34d399' : '#f59e0b'} />

                  {/* Title */}
                  <text
                    x="-50"
                    y="0"
                    fill="#f8fafc"
                    fontSize="11"
                    fontWeight="bold"
                    textAnchor="start"
                    className="pointer-events-none"
                  >
                    {node.title.length > 14 ? `${node.title.slice(0, 13)}...` : node.title}
                  </text>

                  {/* Category & Host subtitle */}
                  <text
                    x="-50"
                    y="14"
                    fill="#94a3b8"
                    fontSize="9"
                    fontFamily="monospace"
                    textAnchor="start"
                    className="pointer-events-none"
                  >
                    {node.category} {node.hostName ? `• ${node.hostName}` : ''}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* Node Side Drawer */}
        <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white font-mono uppercase">Информация об узле</h3>
            {selectedNode && (
              <Link
                href={`/projects/${selectedNode.id}`}
                className="text-xs text-cyan-400 hover:underline flex items-center gap-1 font-mono"
              >
                Открыть <ExternalLink className="w-3 h-3" />
              </Link>
            )}
          </div>

          {selectedNode ? (
            <div className="space-y-4 text-xs">
              <div>
                <div className="text-[10px] font-mono uppercase text-slate-400">Проект</div>
                <div className="text-base font-bold text-white mt-0.5">{selectedNode.title}</div>
                <div className="text-slate-400 font-mono mt-0.5">{selectedNode.slug}</div>
              </div>

              <div className="grid grid-cols-2 gap-2 font-mono">
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Категория</div>
                  <div className="font-semibold text-white mt-0.5 uppercase">{selectedNode.category}</div>
                </div>
                <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800">
                  <div className="text-slate-400 text-[10px]">Статус</div>
                  <div className="font-semibold text-emerald-400 mt-0.5">{selectedNode.status}</div>
                </div>
              </div>

              {selectedNode.hostName && (
                <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/40 font-mono">
                  <div className="text-indigo-400 text-[10px]">Сервер размещения</div>
                  <div className="font-semibold text-white mt-0.5">{selectedNode.hostName}</div>
                </div>
              )}

              {/* Connected edges */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="text-[10px] font-mono uppercase text-slate-400 font-semibold">Связи этого проекта</div>
                {edges
                  .filter((e) => e.source === selectedNode.id || e.target === selectedNode.id)
                  .map((e) => {
                    const isSource = e.source === selectedNode.id;
                    const otherNode = nodes.find((n) => n.id === (isSource ? e.target : e.source));
                    return (
                      <div
                        key={e.id}
                        className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between"
                      >
                        <div className="space-y-0.5">
                          <div className="text-[11px] font-medium text-white flex items-center gap-1.5">
                            {isSource ? (
                              <>
                                <span>Вызывает</span> <ArrowRight className="w-3 h-3 text-cyan-400" />
                                <span className="text-cyan-300">{otherNode?.title}</span>
                              </>
                            ) : (
                              <>
                                <span className="text-indigo-300">{otherNode?.title}</span>
                                <ArrowRight className="w-3 h-3 text-indigo-400" />
                                <span>Вызывает этот сервис</span>
                              </>
                            )}
                          </div>
                          <div className="text-[10px] font-mono text-slate-400">{e.label}</div>
                        </div>

                        <button
                          onClick={() => handleDeleteRelation(e.id)}
                          className="text-slate-500 hover:text-rose-400 p-1"
                          title="Удалить"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="py-12 text-center text-slate-500 text-xs font-mono">
              Кликните на любой узел на графе для детального просмотра связей.
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      <CreateRelationModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreated={fetchGraphData}
      />
    </div>
  );
}
