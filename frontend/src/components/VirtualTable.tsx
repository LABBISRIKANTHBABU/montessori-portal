import React, { useRef, useState, useEffect, useCallback, memo } from "react";

interface VirtualTableProps<T> {
  items: T[];
  rowHeight?: number;
  overscan?: number;
  headers: string[];
  renderRow: (item: T, index: number) => React.ReactNode;
  emptyMessage?: string;
}

export default function VirtualTable<T extends { id: number | string }>({
  items,
  rowHeight = 48,
  overscan = 5,
  headers,
  renderRow,
  emptyMessage = "No data found",
}: VirtualTableProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [containerHeight, setContainerHeight] = useState(400);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => {
      for (const entry of entries) {
        setContainerHeight(entry.contentRect.height);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleScroll = useCallback(() => {
    if (containerRef.current) {
      setScrollTop(containerRef.current.scrollTop);
    }
  }, []);

  const totalHeight = items.length * rowHeight;
  const startIndex = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const endIndex = Math.min(
    items.length,
    Math.ceil((scrollTop + containerHeight) / rowHeight) + overscan
  );
  const visibleItems = items.slice(startIndex, endIndex);

  if (items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "var(--muted)" }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      style={{ overflow: "auto", maxHeight: 500 }}
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        <table style={{ width: "100%" }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 1, background: "var(--white)" }}>
            <tr>
              {headers.map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
        </table>
        <div style={{ position: "absolute", top: startIndex * rowHeight, left: 0, right: 0 }}>
          <table style={{ width: "100%" }}>
            <tbody>
              {visibleItems.map((item, i) => (
                <tr key={item.id} style={{ height: rowHeight }}>
                  {renderRow(item, startIndex + i)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
