"use client";

import { FormEvent, useEffect, useState } from "react";

type Staff = { id:string; name:string; email:string; isActive:boolean; role:string; roleLabel:string; clinicLocationId:string; clinicLocationName:string; jobTitle:string; contactNumber:string; degree:string; speciality:string };
type Location = { id:string; name:string };
const emptyForm={name:"",email:"",password:"",role:"RECEPTIONIST_TELECALLER",clinicLocationId:"",jobTitle:"",contactNumber:"",degree:"",speciality:""};

export default function StaffPage(){
 const [staff,setStaff]=useState<Staff[]>([]); const [locations,setLocations]=useState<Location[]>([]);
 const [open,setOpen]=useState(false); const [editing,setEditing]=useState<Staff|null>(null); const [form,setForm]=useState(emptyForm); const [saving,setSaving]=useState(false); const [error,setError]=useState("");
 async function load(){const response=await fetch("/api/staff",{cache:"no-store"});if(response.ok){const data=await response.json();setStaff(data.staff);setLocations(data.locations);}}
 useEffect(()=>{void load()},[]);
 function openAdd(){setEditing(null);setForm({...emptyForm,clinicLocationId:locations[0]?.id||""});setError("");setOpen(true)}
 function openEdit(m:Staff){setEditing(m);setForm({name:m.name,email:m.email,password:"",role:m.role,clinicLocationId:m.clinicLocationId||locations[0]?.id||"",jobTitle:m.jobTitle,contactNumber:m.contactNumber,degree:m.degree,speciality:m.speciality});setError("");setOpen(true)}
 async function submit(e:FormEvent<HTMLFormElement>){e.preventDefault();setSaving(true);setError("");const response=await fetch("/api/staff",{method:editing?"PATCH":"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({...form,...(editing?{staffId:editing.id}:{})})});const result=await response.json();setSaving(false);if(!response.ok){setError(result.error??"Unable to save staff member.");return}setOpen(false);setEditing(null);setForm(emptyForm);await load()}
 async function toggle(m:Staff){const response=await fetch("/api/staff",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({staffId:m.id,isActive:!m.isActive})});if(response.ok)await load()}
 const doctor=form.role==="DOCTOR";
 return <>
  <p className="eyebrow">Staff management</p>
  <div className="page-header"><div><h1>Staff Management</h1><p className="lead">Manage doctors, receptionists, telecallers and therapists.</p></div><button className="button" onClick={openAdd}>+ Add staff</button></div>
  {error&&<p className="error">{error}</p>}
  {open&&<div className="card form-card"><div className="form-header"><div><h2>{editing?"Edit staff member":"Add staff member"}</h2><p className="muted">Permissions come from the selected role.</p></div><button className="text-button" type="button" onClick={()=>setOpen(false)}>Close</button></div>
   <form className="lead-form" onSubmit={submit}>
    <label>Name<input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required placeholder="Full name"/></label>
    <label>Role<select value={form.role} onChange={e=>setForm({...form,role:e.target.value})}><option value="DOCTOR">Doctor</option><option value="RECEPTIONIST_TELECALLER">Receptionist / Telecaller</option><option value="THERAPIST">Therapist</option></select></label>
    <label>Contact number<input value={form.contactNumber} onChange={e=>setForm({...form,contactNumber:e.target.value})} placeholder="Mobile number"/></label>
    <label>Branch<select value={form.clinicLocationId} onChange={e=>setForm({...form,clinicLocationId:e.target.value})} required><option value="">Select branch</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select></label>
    <label>Job title<input value={form.jobTitle} onChange={e=>setForm({...form,jobTitle:e.target.value})} placeholder="Front Desk Executive, Laser Therapist..."/></label>
    <label>Email<input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} type="email" required placeholder="staff@example.com"/></label>
    <label>{editing?"New login password":"Login password"}<input value={form.password} onChange={e=>setForm({...form,password:e.target.value})} type="password" minLength={12} required={!editing} placeholder={editing?"Leave blank to keep current password":"Minimum 12 characters"}/></label>
    {doctor&&<><label>Degree<input value={form.degree} onChange={e=>setForm({...form,degree:e.target.value})} placeholder="BHMS, MBBS, BDS, MD..."/></label><label>Speciality<input value={form.speciality} onChange={e=>setForm({...form,speciality:e.target.value})} placeholder="Aesthetic Medicine, Trichology..."/></label></>}
    <div className="form-actions full"><button className="button" disabled={saving}>{saving?"Saving...":editing?"Save changes":"Add staff"}</button><button className="secondary-button" type="button" onClick={()=>setOpen(false)}>Cancel</button></div>
   </form></div>}
  <div className="card table-card lead-list"><div className="lead-table">
   <div className="lead-row lead-head"><span>Name</span><span>Role</span><span>Contact</span><span>Job title</span><span>Degree</span><span>Speciality</span><span>Email</span><span>Branch</span><span>Status</span><span>Actions</span></div>
   {staff.map(m=><div className="lead-row" key={m.id}><strong>{m.name||"Unnamed staff"}</strong><span>{m.roleLabel}</span><span>{m.contactNumber||"—"}</span><span>{m.jobTitle||"—"}</span><span>{m.role==="DOCTOR"?(m.degree||"—"):"—"}</span><span>{m.role==="DOCTOR"?(m.speciality||"—"):"—"}</span><span>{m.email}</span><span>{m.clinicLocationName}</span><span>{m.isActive?"Active":"Inactive"}</span><span className="row-actions"><button className="text-button" type="button" onClick={()=>openEdit(m)}>Edit</button><button className={m.isActive?"danger-button":"text-button"} type="button" onClick={()=>void toggle(m)}>{m.isActive?"Deactivate":"Activate"}</button></span></div>)}
   {staff.length===0&&<div className="empty-state"><strong>No staff added</strong><span>Add a staff member to manage clinic access.</span></div>}
  </div></div>
 </>;
}