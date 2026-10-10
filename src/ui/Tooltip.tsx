import { cloneElement, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from "react";
import { createPortal } from "react-dom";
/** Shared tooltip for HTML and SVG triggers. Interactive content stays within the viewport. */
export function Tooltip({ title, children, content }: {title: string; children: ReactElement<any>; content: ReactNode}) {
  const id = useId(), timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const [anchor, setAnchor] = useState<DOMRect | null>(null), [pinned, setPinned] = useState(false);
  const [bounds, setBounds] = useState({width:innerWidth, height:innerHeight});
  const clear = () => { clearTimeout(timer.current); };
  const close = () => { clear(); if (!pinned) timer.current = setTimeout(() => setAnchor(null), 180); };
  const show = (element: Element, delay: number) => { clear(); const r = element.getBoundingClientRect(); timer.current = setTimeout(() => {setAnchor(r); setBounds({width:innerWidth,height:innerHeight});}, delay); };
  useEffect(() => () => clearTimeout(timer.current), []);
  useEffect(() => {
    if (!anchor) return;
    const hide = () => {setAnchor(null);setPinned(false);};
    const key = (e: KeyboardEvent) => {if(e.key === "Escape") {e.preventDefault();e.stopImmediatePropagation();hide();}};
    window.addEventListener("keydown",key,true); window.addEventListener("resize",hide); window.addEventListener("wheel",hide,{passive:true});
    return () => {window.removeEventListener("keydown",key,true);window.removeEventListener("resize",hide);window.removeEventListener("wheel",hide);};
  }, [anchor]);
  const width = Math.min(390,bounds.width-24);
  const below = anchor && bounds.height-anchor.bottom >= anchor.top;
  const maxHeight = Math.max(80,Math.min(410,anchor ? (below ? bounds.height-anchor.bottom-18 : anchor.top-18) : bounds.height-32));
  return <>{cloneElement(children, {
    "aria-describedby": anchor ? id : undefined,
    onMouseEnter: (e:any) => {children.props.onMouseEnter?.(e);show(e.currentTarget,280);},
    onMouseLeave: (e:any) => {children.props.onMouseLeave?.(e);close();},
    onFocus: (e:any) => {children.props.onFocus?.(e);if(e.currentTarget.matches(":focus-visible")) show(e.currentTarget,0);},
    onBlur: (e:any) => {children.props.onBlur?.(e);close();},
  })}{anchor && createPortal(<aside id={id} role={pinned ? "dialog" : "tooltip"} aria-label={title} className={`unified-tooltip ${pinned?"pinned":""}`} onMouseEnter={clear} onMouseLeave={close} style={{width,maxHeight,left:Math.max(12,Math.min(bounds.width-width-12,anchor.left)), ...(below ? {top:anchor.bottom+6} : {bottom:Math.max(12,bounds.height-anchor.top+6)})}}>
    <header><strong>{title}</strong><button onClick={() => {if(pinned){setPinned(false);setAnchor(null);}else setPinned(true);}} aria-label={pinned?"关闭固定提示":"固定说明"}>{pinned?"关闭":"固定"}</button></header>
    <div className="tooltip-body">{content}</div>
  </aside>,document.body)}</>;
}
