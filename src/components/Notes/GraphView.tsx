import { useEffect, useRef, useState } from "react";
import { ArrowLeft } from "lucide-react";
import type { Note } from "../../types";
import { buildNoteGraph } from "../../lib/noteLinks";
import styles from "./GraphView.module.css";

interface GraphViewProps {
  notes: Note[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onBack?: () => void;
  showBack?: boolean;
}

interface SimNode {
  id: string;
  title: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export function GraphView({
  notes,
  selectedId,
  onSelect,
  onBack,
  showBack,
}: GraphViewProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const simRef = useRef<SimNode[]>([]);
  const linksRef = useRef<{ source: string; target: string }[]>([]);
  const frameRef = useRef<number>(0);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const { nodes, links } = buildNoteGraph(notes);
    const container = containerRef.current;
    const w = container?.clientWidth ?? 600;
    const h = container?.clientHeight ?? 400;

    simRef.current = nodes.map((n, i) => {
      const angle = (i / Math.max(nodes.length, 1)) * Math.PI * 2;
      const r = Math.min(w, h) * 0.25;
      return {
        ...n,
        x: w / 2 + Math.cos(angle) * r,
        y: h / 2 + Math.sin(angle) * r,
        vx: 0,
        vy: 0,
      };
    });
    linksRef.current = links;
  }, [notes]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(container);

    const simulate = () => {
      const nodes = simRef.current;
      const links = linksRef.current;
      const w = container.clientWidth;
      const h = container.clientHeight;
      const cx = w / 2;
      const cy = h / 2;

      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dist = Math.max(Math.hypot(dx, dy), 1);
          const force = 800 / (dist * dist);
          const fx = (dx / dist) * force;
          const fy = (dy / dist) * force;
          a.vx -= fx;
          a.vy -= fy;
          b.vx += fx;
          b.vy += fy;
        }
      }

      for (const link of links) {
        const a = nodes.find((n) => n.id === link.source);
        const b = nodes.find((n) => n.id === link.target);
        if (!a || !b) continue;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.max(Math.hypot(dx, dy), 1);
        const force = (dist - 120) * 0.02;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }

      for (const n of nodes) {
        n.vx += (cx - n.x) * 0.002;
        n.vy += (cy - n.y) * 0.002;
        n.vx *= 0.85;
        n.vy *= 0.85;
        n.x += n.vx;
        n.y += n.vy;
        n.x = Math.max(40, Math.min(w - 40, n.x));
        n.y = Math.max(40, Math.min(h - 40, n.y));
      }
    };

    const draw = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      const nodes = simRef.current;
      const links = linksRef.current;

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-surface")
        .trim();
      ctx.fillRect(0, 0, w, h);

      const linkColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-border")
        .trim();
      const textColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-on-surface-muted")
        .trim();
      const accent = getComputedStyle(document.documentElement)
        .getPropertyValue("--color-on-surface")
        .trim();

      for (const link of links) {
        const a = nodes.find((n) => n.id === link.source);
        const b = nodes.find((n) => n.id === link.target);
        if (!a || !b) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = linkColor;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      for (const n of nodes) {
        const isSelected = n.id === selectedId;
        const isHovered = n.id === hoveredId;
        const r = isSelected || isHovered ? 6 : 4;

        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.fillStyle = isSelected ? accent : textColor;
        ctx.fill();

        ctx.font = "12px var(--font-body)";
        ctx.fillStyle = isSelected ? accent : textColor;
        ctx.textAlign = "center";
        const label =
          n.title.length > 24 ? `${n.title.slice(0, 22)}…` : n.title;
        ctx.fillText(label, n.x, n.y + 18);
      }

      simulate();
      frameRef.current = requestAnimationFrame(draw);
    };

    frameRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(frameRef.current);
      ro.disconnect();
    };
  }, [notes, selectedId, hoveredId]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const nodes = simRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    for (const n of nodes) {
      if (Math.hypot(n.x - x, n.y - y) < 14) {
        onSelect(n.id);
        return;
      }
    }
  };

  const handleMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const nodes = simRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    let found: string | null = null;
    for (const n of nodes) {
      if (Math.hypot(n.x - x, n.y - y) < 14) {
        found = n.id;
        break;
      }
    }
    setHoveredId(found);
    canvas.style.cursor = found ? "pointer" : "default";
  };

  const { nodes: graphNodes, links } = buildNoteGraph(notes);

  return (
    <div className={styles.graph}>
      <header className={styles.header}>
        {showBack && onBack && (
          <button className={styles.backBtn} onClick={onBack}>
            <ArrowLeft size={16} />
            All notes
          </button>
        )}
        <div className={styles.headerText}>
          <h2>Graph view</h2>
          <span>
            {graphNodes.length} notes · {links.length} links
          </span>
        </div>
      </header>
      {graphNodes.length === 0 ? (
        <div className={styles.empty}>
          <p>Add links with [[Note Title]] to see connections</p>
        </div>
      ) : (
        <div ref={containerRef} className={styles.canvasWrap}>
          <canvas
            ref={canvasRef}
            className={styles.canvas}
            onClick={handleClick}
            onMouseMove={handleMove}
            onMouseLeave={() => setHoveredId(null)}
          />
        </div>
      )}
    </div>
  );
}
