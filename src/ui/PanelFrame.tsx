import { useEffect, useRef, type ReactNode } from "react";
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
