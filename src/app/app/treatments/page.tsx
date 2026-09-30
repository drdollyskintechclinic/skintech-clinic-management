"use client";
import { FormEvent, useEffect, useState } from "react";
type Treatment={id:string;name:string;category:string;price:number;durationMinutes:number;notes?:string;status:"ACTIVE"|"INACTIVE"};
type Package={id:string;name:string;treatmentId:string;sessions:number;price:number;validityDays:number;notes?:string;status:"ACTIVE"|"INACTIVE"};
const emptyT={name:"",category:"",price:"",durationMinutes:"60",notes:"",status:"ACTIVE" as "ACTIVE"|"INACTIVE"};
const emptyP={name:"",treatmentId:"",sessions:"1",price:"",validityDays:"90",notes:"",status:"ACTIVE" as "ACTIVE"|"INACTIVE"};
export default function TreatmentsPage(){
 const [treatments,setTreatments]=useState<Treatment[]>([]),[packages,setPackages]=useState<Package[]>([]);
 const [tab,setTab]=useState<"treatments"|"packages">("treatments"),[open,setOpen]=useState(false),[editing,setEditing]=useState<Treatment|Package|null>(null);
 const [tForm,setTForm]=useState(emptyT),[pForm,setPForm]=useState(emptyP),[saving,setSaving]=useState(false),[error,setError]=useState("");
 const [page,setPage]=useState(1);
 const pageSize=20;
 async function load(){const r=await fetch("/api/treatments",{cache:"no-store"});if(r.ok){const d=await r.json();setTreatments(d.treatments);setPackages(d.packages);}}
 useEffect(()=>{void load()},[]);
 function add(){setEditing(null);setError("");tab==="treatments"?setTForm(emptyT):setPForm({...emptyP,treatmentId:treatments.find(t=>t.status==="ACTIVE")?.id||treatments[0]?.id||""});setOpen(true)}
 function edit(x:Treatment|Package){setEditing(x);setError("");if(tab==="treatments"){const t=x as Treatment;setTForm({name:t.name,category:t.category,price:String(t.price),durationMinutes:String(t.durationMinutes),notes:t.notes||"",status:t.status})}else{const p=x as Package;setPForm({name:p.name,treatmentId:p.treatmentId,sessions:String(p.sessions),price:String(p.price),validityDays:String(p.validityDays),notes:p.notes||"",status:p.status})}setOpen(true)}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");const data=tab==="treatments"?{...tForm,price:Number(tForm.price),durationMinutes:Number(tForm.durationMinutes)}:{...pForm,sessions:Number(pForm.sessions),price:Number(pForm.price),validityDays:Number(pForm.validityDays)};const r=await fetch("/api/treatments",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({type:tab==="treatments"?"treatment":"package",...(editing?{id:editing.id}:{}),data})});const d=await r.json();setSaving(false);if(!r.ok){setError(d.error||"Unable to save.");return}setOpen(false);setEditing(null);await load()}
 async function remove(id:string){if(!window.confirm("Delete this catalogue item?"))return;const r=await fetch("/api/treatments?id="+encodeURIComponent(id)+"&type="+(tab==="treatments"?"treatment":"package"),{method:"DELETE"});if(r.ok)await load();else setError((await r.json()).error||"Unable to delete.")}
 const treatmentName=(id:string)=>treatments.find(t=>t.id===id)?.name||"—";
 return <>
  <p className="eyebrow">Treatment management</p>
  <div className="page-header"><div><h1>Treatments & Packages</h1><p className="lead">Maintain the clinic treatment catalogue and package pricing.</p></div><button className="button" onClick={add}>+ Add {tab==="treatments"?"treatment":"package"}</button></div>
  <div className="toolbar"><button className={tab==="treatments"?"button":"secondary-button"} onClick={()=>{setTab("treatments");setPage(1);setOpen(false)}}>Treatments</button><button className={tab==="packages"?"button":"secondary-button"} onClick={()=>{setTab("packages");setPage(1);setOpen(false)}}>Packages</button></div>
  {error&&<p className="error">{error}</p>}
  {open&&<div className="catalogue-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}><div className="card form-card catalogue-modal"><div className="form-header"><div><h2>{editing?"Edit":"Add"} {tab==="treatments"?"treatment":"package"}</h2><p className="muted">Changes are recorded in the clinic audit history.</p></div><button className="text-button" type="button" onClick={()=>setOpen(false)}>Close</button></div>
   {tab==="treatments"?<form className="lead-form" onSubmit={submit}>
    <label>Treatment name<input required value={tForm.name} onChange={e=>setTForm({...tForm,name:e.target.value})} placeholder="e.g. Hydrafacial"/></label>
    <label>Category<input required value={tForm.category} onChange={e=>setTForm({...tForm,category:e.target.value})} placeholder="Facial, Hair, Laser, PMU..."/></label>
    <label>Standard price (₹)<input required type="number" min="0" value={tForm.price} onChange={e=>setTForm({...tForm,price:e.target.value})}/></label>
    <label>Duration (minutes)<input required type="number" min="0" value={tForm.durationMinutes} onChange={e=>setTForm({...tForm,durationMinutes:e.target.value})}/></label>
    <label>Status<select value={tForm.status} onChange={e=>setTForm({...tForm,status:e.target.value as "ACTIVE"|"INACTIVE"})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
    <label className="full">Notes<textarea rows={3} value={tForm.notes} onChange={e=>setTForm({...tForm,notes:e.target.value})} placeholder="Internal treatment notes"/></label>
    <div className="form-actions full"><button className="button" disabled={saving}>{saving?"Saving...":editing?"Save changes":"Add treatment"}</button><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancel</button></div>
   </form>:<form className="lead-form" onSubmit={submit}>
    <label>Package name<input required value={pForm.name} onChange={e=>setPForm({...pForm,name:e.target.value})} placeholder="e.g. Hair PRP – 6 Sessions"/></label>
    <label>Treatment<select required value={pForm.treatmentId} onChange={e=>setPForm({...pForm,treatmentId:e.target.value})}><option value="">Select treatment</option>{treatments.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
    <label>Sessions<input required type="number" min="1" value={pForm.sessions} onChange={e=>setPForm({...pForm,sessions:e.target.value})}/></label>
    <label>Package price (₹)<input required type="number" min="0" value={pForm.price} onChange={e=>setPForm({...pForm,price:e.target.value})}/></label>
    <label>Validity (days)<input required type="number" min="1" value={pForm.validityDays} onChange={e=>setPForm({...pForm,validityDays:e.target.value})}/></label>
    <label>Status<select value={pForm.status} onChange={e=>setPForm({...pForm,status:e.target.value as "ACTIVE"|"INACTIVE"})}><option value="ACTIVE">Active</option><option value="INACTIVE">Inactive</option></select></label>
    <label className="full">Notes<textarea rows={3} value={pForm.notes} onChange={e=>setPForm({...pForm,notes:e.target.value})} placeholder="Package terms or internal notes"/></label>
    <div className="form-actions full"><button className="button" disabled={saving}>{saving?"Saving...":editing?"Save changes":"Add package"}</button><button type="button" className="secondary-button" onClick={()=>setOpen(false)}>Cancel</button></div>
   </form>}
  </div>}
  <div className="card table-card lead-list"><div className="lead-table">
   {tab==="treatments"?<><div className="lead-row catalogue-treatment-row lead-head"><span>Treatment</span><span>Status</span><span>Category</span><span>Price</span><span>Duration</span><span>Notes</span><span>Actions</span></div>{treatments.slice((page-1)*pageSize,page*pageSize).map(t=><div className="lead-row catalogue-treatment-row" key={t.id}><strong>{t.name}</strong><span className={t.status==="ACTIVE"?"status-active":"status-inactive"}>{t.status==="ACTIVE"?"Active":"Inactive"}</span><span>{t.category}</span><span>₹{t.price.toLocaleString("en-IN")}</span><span>{t.durationMinutes} min</span><span className="notes-cell">{t.notes||"—"}</span><span className="row-actions"><button className="text-button" onClick={()=>edit(t)}>Edit</button><button className="danger-button" onClick={()=>void remove(t.id)}>Delete</button></span></div>)}</>:<><div className="lead-row catalogue-package-row lead-head"><span>Package</span><span>Status</span><span>Treatment</span><span>Sessions</span><span>Price</span><span>Validity</span><span>Notes</span><span>Actions</span></div>{packages.slice((page-1)*pageSize,page*pageSize).map(p=><div className="lead-row catalogue-package-row" key={p.id}><strong>{p.name}</strong><span className={p.status==="ACTIVE"?"status-active":"status-inactive"}>{p.status==="ACTIVE"?"Active":"Inactive"}</span><span>{treatmentName(p.treatmentId)}</span><span>{p.sessions}</span><span>₹{p.price.toLocaleString("en-IN")}</span><span>{p.validityDays} days</span><span className="notes-cell">{p.notes||"—"}</span><span className="row-actions"><button className="text-button" onClick={()=>edit(p)}>Edit</button><button className="danger-button" onClick={()=>void remove(p.id)}>Delete</button></span></div>)}</>}
   {((tab==="treatments"&&treatments.length===0)||(tab==="packages"&&packages.length===0))&&<div className="empty-state"><strong>No {tab} yet</strong><span>Use the button above to add one.</span></div>}
  </div></div>
 </>;
}