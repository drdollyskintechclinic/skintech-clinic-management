import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

export const dynamic="force-dynamic";
const schema=z.object({patientId:z.string().uuid(),dueDate:z.string().date(),purpose:z.string().trim().min(2).max(200),assignedUserId:z.string().uuid().optional().or(z.literal("")),notes:z.string().trim().max(2000).optional().or(z.literal("")),status:z.enum(["PENDING","COMPLETED","CANCELLED"]).default("PENDING")});
const events=async(organizationId:string,resourceType:string)=>db.auditEvent.findMany({where:{organizationId,resourceType},orderBy:{occurredAt:"desc"},take:5000});
const data=(e:{metadata:unknown})=>(e.metadata??{}) as Record<string,any>;
function current(items:any[]){const m=new Map<string,any>();for(const e of items){const id=e.resourceId??e.id;if(!m.has(id))m.set(id,e)}return [...m.values()].filter(e=>e.action!=="FOLLOW_UP_DELETED" && e.action!=="FOLLOW_UP_CLEARED")}
export async function GET(){
 const user=await requirePermission("reception.manage");
 const [f,p]=await Promise.all([events(user.organizationId,"FOLLOW_UP"),events(user.organizationId,"PATIENT")]);
 const patients=current(p).filter(e=>e.action!=="PATIENT_DELETED").map(e=>({id:e.resourceId??e.id,patientNumber:data(e).patientNumber??"",name:data(e).name??"",mobile:data(e).mobile??""}));
 const patientMap=new Map(patients.map(x=>[x.id,x]));
 const followups=current(f).map(e=>{const d=data(e),pt=patientMap.get(String(d.patientId));return {id:e.resourceId??e.id,patientId:d.patientId,patientNumber:pt?.patientNumber??d.patientNumber??"",patientName:pt?.name??d.patientName??"",mobile:pt?.mobile??d.mobile??"",dueDate:d.dueDate??"",purpose:d.purpose??"",assignedUserId:d.assignedUserId??"",assignedUserName:d.assignedUserName??"",notes:d.notes??"",status:d.status??"PENDING",createdAt:e.occurredAt.toISOString()}});
 const staff=await db.user.findMany({where:{userRoles:{some:{organizationId:user.organizationId}},isActive:true},select:{id:true,name:true,email:true},orderBy:{name:"asc"}});
 return NextResponse.json({followups,patients,staff:staff.map(s=>({id:s.id,name:s.name?.trim()||s.email}))});
}
export async function POST(request:Request){
 const user=await requirePermission("reception.manage");
 const body=await request.json();
 if(body.action==="create"){
  const p=schema.safeParse(body.data);if(!p.success)return NextResponse.json({error:"Please check the follow-up details."},{status:400});
  const patientEvents=await events(user.organizationId,"PATIENT");
  const pe=current(patientEvents).find(e=>(e.resourceId??e.id)===p.data.patientId);
  if(!pe||pe.action==="PATIENT_DELETED")return NextResponse.json({error:"Patient not found."},{status:404});
  const pd=data(pe);let assignedName="";
  if(p.data.assignedUserId){const staff=await db.user.findUnique({where:{id:p.data.assignedUserId},select:{name:true,email:true}});assignedName=staff?.name?.trim()||staff?.email||""}
  const id=crypto.randomUUID();
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"FOLLOW_UP",resourceId:id,action:"FOLLOW_UP_CREATED",metadata:{patientId:p.data.patientId,patientNumber:pd.patientNumber??"",patientName:pd.name??"",mobile:pd.mobile??"",dueDate:p.data.dueDate,purpose:p.data.purpose,assignedUserId:p.data.assignedUserId||"",assignedUserName:assignedName,notes:p.data.notes??"",status:p.data.status,createdByUserId:user.id,createdByUserName:user.name??""}}});
  return NextResponse.json({id},{status:201});
 }
 if(body.action==="complete"||body.action==="cancel"){
  const followupId=String(body.followupId||"");
  if(!followupId)return NextResponse.json({error:"Follow-up not found."},{status:400});
  const f=current(await events(user.organizationId,"FOLLOW_UP")).find(e=>(e.resourceId??e.id)===followupId);
  if(!f)return NextResponse.json({error:"Follow-up not found."},{status:404});
  const status=body.action==="complete"?"COMPLETED":"CANCELLED";
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"FOLLOW_UP",resourceId:followupId,action:body.action==="complete"?"FOLLOW_UP_COMPLETED":"FOLLOW_UP_CANCELLED",metadata:{...data(f),status,updatedAt:new Date().toISOString(),updatedByUserId:user.id,updatedByUserName:user.name??""}}});
  return NextResponse.json({ok:true});
 }
 if(body.action==="clear"){
  const followupId=String(body.followupId||"");
  if(!followupId)return NextResponse.json({error:"Follow-up not found."},{status:400});
  const f=current(await events(user.organizationId,"FOLLOW_UP")).find(e=>(e.resourceId??e.id)===followupId);
  if(!f)return NextResponse.json({error:"Follow-up not found."},{status:404});
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"FOLLOW_UP",resourceId:followupId,action:"FOLLOW_UP_CLEARED",metadata:{...data(f),status:"CANCELLED",clearedAt:new Date().toISOString(),clearedByUserId:user.id,clearedByUserName:user.name??""}}});
  return NextResponse.json({ok:true});
 }
 if(body.action==="update"){
  const p=z.object({followupId:z.string().uuid(),dueDate:z.string().date(),purpose:z.string().trim().min(2).max(200),assignedUserId:z.string().uuid().optional().or(z.literal("")),notes:z.string().trim().max(2000).optional().or(z.literal("")),status:z.enum(["PENDING","COMPLETED","CANCELLED"])}).safeParse(body.data);
  if(!p.success)return NextResponse.json({error:"Please check the follow-up details."},{status:400});
  const f=current(await events(user.organizationId,"FOLLOW_UP")).find(e=>(e.resourceId??e.id)===p.data.followupId);if(!f)return NextResponse.json({error:"Follow-up not found."},{status:404});
  let assignedName="";if(p.data.assignedUserId){const staff=await db.user.findUnique({where:{id:p.data.assignedUserId},select:{name:true,email:true}});assignedName=staff?.name?.trim()||staff?.email||""}
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"FOLLOW_UP",resourceId:p.data.followupId,action:"FOLLOW_UP_UPDATED",metadata:{...data(f),dueDate:p.data.dueDate,purpose:p.data.purpose,assignedUserId:p.data.assignedUserId||"",assignedUserName:assignedName,notes:p.data.notes??"",status:p.data.status}}});
  return NextResponse.json({ok:true});
 }
 return NextResponse.json({error:"Invalid action."},{status:400});
}