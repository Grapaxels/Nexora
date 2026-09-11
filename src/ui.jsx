import { useEffect, useRef } from 'react';
import { X, SearchX, LoaderCircle, ArrowUpRight } from 'lucide-react';
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => { const el = ref.current; const before = document.activeElement; el.showModal(); document.body.style.overflow = 'hidden'; return () => { document.body.style.overflow = ''; before?.focus(); }; }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === e.currentTarget) {const rect=e.currentTarget.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)onClose();} }} aria-label={title}><div className="modal-top"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></div>{children}</dialog>;
}
export function Empty({ title='Nothing here just yet', text='Try a different search or be the first to add something.', action, onAction }) { return <div className="empty"><SearchX size={34} strokeWidth={1.3}/><h3>{title}</h3><p>{text}</p>{action && <button className="btn primary" onClick={onAction}>{action}<ArrowUpRight size={16}/></button>}</div>; }
export function Loading(){return <div className="loading" role="status"><LoaderCircle className="spin" size={25}/> Finding your campus…</div>;}
export function Field({label,children,hint}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
export function FormError({error}){return error?<p role="alert" className="form-error">{error}</p>:null;}
