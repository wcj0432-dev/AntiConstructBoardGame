import { useEffect, useRef, type ReactNode } from "react";
import { dismissTooltips } from "./Tooltip";
import { X } from "lucide-react";
export function PanelFrame({
  title,
  children,
  footer,
  onClose,
  modal = false,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  modal?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    dismissTooltips();
    // Keep ordinary tooltips hoverable, while always allowing the current
    // document's close/confirmation controls to receive the pointer.
    const protectControls = (e: PointerEvent) => {
      if ((e.target as Element)?.closest?.(".unified-tooltip.pinned")) return;
      const controls = ref.current?.querySelectorAll<HTMLElement>(
        ".panel-close,.panel-footer button",
      );
      if (
        controls &&
        [...controls].some((n) => {
          const r = n.getBoundingClientRect();
          return (
            r.width > 0 &&
            r.height > 0 &&
            e.clientX >= r.left &&
            e.clientX <= r.right &&
            e.clientY >= r.top &&
            e.clientY <= r.bottom
          );
        })
      )
        dismissTooltips();
    };
    window.addEventListener("pointermove", protectControls, true);
    window.addEventListener("pointerdown", protectControls, true);
    return () => {
      window.removeEventListener("pointermove", protectControls, true);
      window.removeEventListener("pointerdown", protectControls, true);
      dismissTooltips();
    };
  }, [title]);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement;
    ref.current?.querySelector<HTMLButtonElement>(".panel-close")?.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);
  return (
    <div className={`panel-layer ${modal ? "full-layer" : ""}`}>
      <section
        ref={ref}
        className="command-panel"
        role="dialog"
        aria-modal={modal}
        aria-label={title}
        onKeyDown={(e) => {
          if (e.key === "Tab" && modal) {
            const items = ref.current?.querySelectorAll<HTMLElement>(
              'button:not(:disabled),input,select,[tabindex="0"]',
            );
            if (items?.length) {
              const first = items[0],
                last = items[items.length - 1];
              if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
              } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
              }
            }
          }
        }}
      >
        <header className="panel-heading">
          <div>
            <span className="eyebrow">联邦最高议事厅 / INTERNAL DOCUMENT</span>
            <h2>{title}</h2>
          </div>
          <button
            className="panel-close"
            aria-label="关闭面板"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </header>
        <div className="panel-scroll">{children}</div>
        {footer && <footer className="panel-footer">{footer}</footer>}
      </section>
    </div>
  );
}
