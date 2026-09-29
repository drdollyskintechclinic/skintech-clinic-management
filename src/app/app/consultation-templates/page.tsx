"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type Template = { id:string; field:string; name:string; content:string; active:boolean; sortOrder:number };
const fields = [
  ["chiefComplaint","Chief complaint / patient's concern"],
  ["examinationFindings","Examination / clinical findings"],
  ["diagnosis","Diagnosis / assessment"],
  ["treatmentAdvised","Treatment advised"],
  ["procedurePerformed","Procedure performed"],
  ["prescription","Prescription / medicines"],
  ["doctorNotes","Doctor's notes"]
] as const;

export default function ConsultationTemplatesPage() {
  const [templates,setTemplates]=useState<Template[]>([]);
  const [field,setField]=useState(fields[0][0]);
  const [name,setName]=useState("");
  const [content,setContent]=useState("");
  const [editing,setEditing]=useState<Template|null>(null);
  const [error,setError]=useState("");
  const [page,setPage]=useState<Record<string,number>>({});
  const pageSize=5;

  async function load(){ const r=await fetch("/api/consultation-templates",{cache:"no-store"}); const d=await r.json(); if(r.ok)setTemplates(d.templates); else setError(d.error??"Unable to load templates."); }
  useEffect(()=>{void load()},[]);

  function reset(){setEditing(null);setName("");setContent("");setField(fields[0][0]);}
  async function save(e:FormEvent){e.preventDefault();setError("");const body={id:editing?.id,field,name,content,active:true,sortOrder:templates.filter(t=>t.field===field).length};const r=await fetch("/api/consultation-templates",{method:editing?"PUT":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){setError(d.error??"Unable to save.");return;}reset();await load();}
  async function remove(id:string){if(!confirm("Delete this consultation template?"))return;const r=await fetch("/api/consultation-templates",{method:"DELETE",headers:{"Content-Type":"application/json"},body:JSON.stringify({id})});if(!r.ok){const d=await r.json();setError(d.error??"Unable to delete.");return;}await load();}
  const grouped=useMemo(()=>fields.map(([value,label])=>({value,label,items:templates.filter(t=>t.field===value)})),[templates]);
  function setFieldPage(field:string,next:number){setPage(current=>({...current,[field]:next}));}

  return <>
    <p className="eyebrow">Clinical setup</p>
    <div className="page-header"><div><h1>Consultation Templates</h1><p className="lead">Create reusable text for the consultation fields. Doctors can select and edit templates during consultation.</p></div></div>
    {error&&<p className="error">{error}</p>}
    <div className="card form-card">
      <div className="form-header"><div><h2>{editing?"Edit template":"Add template"}</h2></div>{editing&&<button className="text-button" type="button" onClick={reset}>Cancel edit</button>}</div>
      <form className="lead-form" onSubmit={save}>
        <label>Consultation field<select value={field} onChange={e=>setField(e.target.value)}>{fields.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>
        <label>Template name<input value={name} onChange={e=>setName(e.target.value)} required placeholder="e.g. General consultation" /></label>
        <label className="full">Template text<textarea value={content} onChange={e=>setContent(e.target.value)} rows={5} required placeholder="Enter the reusable clinical wording..." /></label>
        <div className="form-actions full"><button className="button">{editing?"Save changes":"Add template"}</button><button className="secondary-button" type="button" onClick={reset}>Clear</button></div>
      </form>
    </div>
    <div className="card table-card">
      {grouped.map(group=>{const currentPage=page[group.value]??1;const pageCount=Math.max(1,Math.ceil(group.items.length/pageSize));const start=(currentPage-1)*pageSize;const visible=group.items.slice(start,start+pageSize);return <section key={group.value} style={{marginBottom:"1.5rem"}}><h2>{group.label}</h2>{group.items.length===0?<p className="muted">No templates yet.</p>:<>{visible.map(t=><div className="template-row" key={t.id}><div><strong>{t.name}</strong><p>{t.content}</p></div><div><button className="text-button" onClick={()=>{setEditing(t);setField(t.field);setName(t.name);setContent(t.content)}}>Edit</button><button className="danger-button" onClick={()=>void remove(t.id)}>Delete</button></div></div>)}{pageCount>1&&<div className="form-actions"><button className="secondary-button" disabled={currentPage===1} onClick={()=>setFieldPage(group.value,currentPage-1)}>Previous</button><span className="muted">Page {currentPage} of {pageCount}</span><button className="secondary-button" disabled={currentPage===pageCount} onClick={()=>setFieldPage(group.value,currentPage+1)}>Next</button></div>}</>}</section>})}
    </div>
  </>;
}
