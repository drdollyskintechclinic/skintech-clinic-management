import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, AuthorizationError } from "@/server/auth/authorization";
import { hasPermission } from "@/server/identity/permissions";
import { db } from "@/server/db/prisma";

export const dynamic = "force-dynamic";
type Event={id:string;occurredAt:Date;actorUserId:string|null;resourceId:string|null;action:string;metadata:unknown};
const planSchema=z.object({
  patientId:z.string().uuid(),
  treatmentId:z.string().uuid(),
  packageId:z.string().uuid().optional().or(z.literal("")),
  startDate:z.string().min(10),
  totalSessions:z.coerce.number().int().min(1).max(100),
  validityDays:z.coerce.number().int().min(1).max(3650),
  intervalBetweenSessionsDays:z.coerce.number().int().min(0).max(3650).default(0),notes:z.string().trim().max(2000).optional().or(z.literal(""))
});
const sessionSchema=z.object({
  planId:z.string().uuid(),
  sessionDate:z.string().min(10),
  status:z.enum(["SCHEDULED","COMPLETED","CANCELLED"]).default("COMPLETED"),
  performedByUserId:z.string().uuid().optional().or(z.literal("")),
  notes:z.string().trim().max(3000).optional().or(z.literal(""))
});
const getData=(e:Event)=>(e.metadata??{}) as Record<string,unknown>;
async function events(org:string,type:string){return await db.auditEvent.findMany({where:{organizationId:org,resourceType:type},orderBy:{occurredAt:"desc"},take:5000}) as Event[];}
function current(es:Event[]){const m=new Map<string,Event>();for(const e of es){const id=e.resourceId??e.id;if(!m.has(id))m.set(id,e);}return [...m.values()].filter(e=>!e.action.endsWith("_DELETED"));}
async function access(){
 const user=await requireAuth();
 if(!hasPermission(user.permissions, "treatment.record")&&!hasPermission(user.permissions,"clinical.read")&&!hasPermission(user.permissions,"reception.manage")) throw new AuthorizationError();
 return user;
}
export async function GET(){
 const user=await access();
 const [plansE,sessionsE,treatE,packagesE,patientE,users]=await Promise.all([
  events(user.organizationId,"PATIENT_TREATMENT"),events(user.organizationId,"TREATMENT_SESSION"),events(user.organizationId,"TREATMENT"),events(user.organizationId,"TREATMENT_PACKAGE"),events(user.organizationId,"PATIENT"),
  db.user.findMany({where:{userRoles:{some:{organizationId:user.organizationId}}},select:{id:true,name:true,email:true}})
 ]);
 const treatments=current(treatE).map(e=>({id:e.resourceId??e.id,...getData(e)})).filter(t=>String(t.status??"ACTIVE")==="ACTIVE");
 const packages=current(packagesE).map(e=>({id:e.resourceId??e.id,...getData(e)})).filter(p=>String(p.status??"ACTIVE")==="ACTIVE");
 const patients=current(patientE).map(e=>({id:e.resourceId??e.id,...getData(e)}));
 const plans=current(plansE).map(e=>({id:e.resourceId??e.id,...getData(e)}));
 const sessions=current(sessionsE).map(e=>({id:e.resourceId??e.id,...getData(e)}));
 const userMap=Object.fromEntries(users.map(u=>[u.id,{name:u.name,email:u.email}]));
 return NextResponse.json({plans,sessions,treatments,packages,patients,users:userMap,isAdmin:hasPermission(user.permissions,"platform.manage")});
}
export async function POST(req:Request){
 const user=await access();
 if(!hasPermission(user.permissions,"treatment.record")&&!hasPermission(user.permissions,"clinical.write")&&!hasPermission(user.permissions,"reception.manage")) throw new AuthorizationError();
 const body=await req.json();
 if(body.action==="create-plan"){
  const p=planSchema.safeParse(body.data);if(!p.success)return NextResponse.json({error:"Please check the treatment plan details."},{status:400});
  const patientE=current(await events(user.organizationId,"PATIENT")).find(e=>e.resourceId===p.data.patientId);
  if(!patientE)return NextResponse.json({error:"Patient not found."},{status:404});
  const treatmentE=current(await events(user.organizationId,"TREATMENT")).find(e=>e.resourceId===p.data.treatmentId);
  if(!treatmentE)return NextResponse.json({error:"Treatment not found."},{status:404});
  const packageE=p.data.packageId?current(await events(user.organizationId,"TREATMENT_PACKAGE")).find(e=>e.resourceId===p.data.packageId):null;
  const d=getData(patientE),td=getData(treatmentE),pd=packageE?getData(packageE):null;
  const totalSessions=p.data.totalSessions;
  const planId=crypto.randomUUID();
  const start=new Date(p.data.startDate+"T00:00:00+05:30");
  const expiry=new Date(start.getTime()+p.data.validityDays*86400000);
  const intervalBetweenSessionsDays=Number(pd?.intervalBetweenSessionsDays??(p.data.packageId?30:0));
  const expiryDate=expiry.toISOString().slice(0,10);
  const metadata={patientId:p.data.patientId,patientNumber:String(d.patientNumber??""),patientName:String(d.name??""),mobile:String(d.mobile??""),treatmentId:p.data.treatmentId,treatmentName:String(td.name??""),packageId:p.data.packageId||"",packageName:String(pd?.name??""),intervalBetweenSessionsDays,totalSessions,sessionsCompleted:0,startDate:p.data.startDate,expiryDate,status:"ACTIVE",notes:p.data.notes??"",createdByUserId:user.id,createdByUserName:user.name??""};
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"PATIENT_TREATMENT",resourceId:planId,action:"PATIENT_TREATMENT_CREATED",metadata}});
  const baseDate=new Date(p.data.startDate+"T00:00:00Z");
  for(let i=1;i<=totalSessions;i++){
   const sessionDate=new Date(baseDate);
   sessionDate.setUTCDate(sessionDate.getUTCDate()+((i-1)*intervalBetweenSessionsDays));
   const date=sessionDate.toISOString().slice(0,10);
   if(date>expiryDate)break;
   const sessionId=crypto.randomUUID();
   const sessionMetadata={planId,patientId:p.data.patientId,patientNumber:String(d.patientNumber??""),patientName:String(d.name??""),treatmentId:p.data.treatmentId,treatmentName:String(td.name??""),packageId:p.data.packageId||"",packageName:String(pd?.name??""),sessionNumber:i,totalSessions,sessionDate:date,status:"SCHEDULED",performedByUserId:user.id,performedByUserName:user.name??"",notes:""};
   await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"TREATMENT_SESSION",resourceId:sessionId,action:"TREATMENT_SESSION_CREATED",metadata:sessionMetadata}});
  }
  return NextResponse.json({id:planId},{status:201});
 }
 if(body.action==="create-session"){
  const p=sessionSchema.safeParse(body.data);if(!p.success)return NextResponse.json({error:"Please check the session details."},{status:400});
  const plan=current(await events(user.organizationId,"PATIENT_TREATMENT")).find(e=>e.resourceId===p.data.planId);
  if(!plan)return NextResponse.json({error:"Treatment plan not found."},{status:404});
  const planData=getData(plan);
  const allSessions=current(await events(user.organizationId,"TREATMENT_SESSION")).filter(e=>String(getData(e).planId)===p.data.planId);
  const scheduledSession=allSessions.find(e=>String(getData(e).status)==="SCHEDULED");
  if(scheduledSession)return NextResponse.json({error:"A scheduled session already exists. Complete, cancel, or edit that session before creating the next one."},{status:400});
  const sessionNumber=allSessions.reduce((max,e)=>Math.max(max,Number(getData(e).sessionNumber??0)),0)+1;
  const previousSession=allSessions.find(e=>Number(getData(e).sessionNumber)===sessionNumber-1);
  const previousDate=previousSession?String(getData(previousSession).sessionDate??""):"";
  if(previousDate&&p.data.sessionDate<previousDate)return NextResponse.json({error:"Session date cannot be earlier than the previous session date ("+previousDate+")."},{status:400});
  const totalSessions=Number(planData.totalSessions??1);
  if(sessionNumber>totalSessions)return NextResponse.json({error:"All package sessions have already been recorded."},{status:400});
  const performedId=p.data.performedByUserId||user.id;
  const performer=await db.user.findUnique({where:{id:performedId},select:{id:true,name:true,email:true}});
  const sessionId=crypto.randomUUID();
  const metadata={planId:p.data.planId,patientId:String(planData.patientId??""),patientNumber:String(planData.patientNumber??""),patientName:String(planData.patientName??""),treatmentId:String(planData.treatmentId??""),treatmentName:String(planData.treatmentName??""),packageId:String(planData.packageId??""),packageName:String(planData.packageName??""),sessionNumber,totalSessions,sessionDate:p.data.sessionDate,status:p.data.status,performedByUserId:performer?.id??user.id,performedByUserName:performer?.name??user.name??"",notes:p.data.notes??""};
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"TREATMENT_SESSION",resourceId:sessionId,action:"TREATMENT_SESSION_CREATED",metadata}});
  if(p.data.status==="COMPLETED"){
   const completed=sessionNumber;
   const updated={...planData,sessionsCompleted:completed,status:completed>=totalSessions?"COMPLETED":"ACTIVE"};
   await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"PATIENT_TREATMENT",resourceId:p.data.planId,action:"PATIENT_TREATMENT_UPDATED",metadata:updated}});
  }
  return NextResponse.json({id:sessionId,sessionNumber},{status:201});
 }
 if(body.action==="delete-session"){
  if(!hasPermission(user.permissions,"platform.manage"))throw new AuthorizationError();
  const p=z.object({sessionId:z.string().uuid()}).safeParse(body.data);
  if(!p.success)return NextResponse.json({error:"Invalid session."},{status:400});
  const existing=current(await events(user.organizationId,"TREATMENT_SESSION")).find(e=>e.resourceId===p.data.sessionId);
  if(!existing)return NextResponse.json({error:"Session not found."},{status:404});
  const old=getData(existing);
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"TREATMENT_SESSION",resourceId:p.data.sessionId,action:"TREATMENT_SESSION_DELETED",metadata:{...old,deletedByUserId:user.id,deletedByUserName:user.name??""}}});
  const planId=String(old.planId??"");
  const plan=current(await events(user.organizationId,"PATIENT_TREATMENT")).find(e=>e.resourceId===planId);
  if(plan){
   const planData=getData(plan);
   const remaining=current(await events(user.organizationId,"TREATMENT_SESSION")).filter(e=>String(getData(e).planId)===planId&&e.resourceId!==p.data.sessionId);
   const completed=remaining.filter(e=>String(getData(e).status)==="COMPLETED").length;
   const totalSessions=Number(planData.totalSessions??1);
   const updated={...planData,sessionsCompleted:completed,status:completed>=totalSessions?"COMPLETED":"ACTIVE"};
   await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"PATIENT_TREATMENT",resourceId:planId,action:"PATIENT_TREATMENT_UPDATED",metadata:updated}});
  }
  return NextResponse.json({ok:true});
 }
 if(body.action==="update-session"){
  const p=z.object({sessionId:z.string().uuid(),sessionDate:z.string().min(10),status:z.enum(["SCHEDULED","COMPLETED","CANCELLED"]),performedByUserId:z.string().uuid().optional().or(z.literal("")),notes:z.string().trim().max(3000).optional().or(z.literal(""))}).safeParse(body.data);
  if(!p.success)return NextResponse.json({error:"Please check the session details."},{status:400});
  const existing=current(await events(user.organizationId,"TREATMENT_SESSION")).find(e=>e.resourceId===p.data.sessionId);
  if(!existing)return NextResponse.json({error:"Session not found."},{status:404});
  const old=getData(existing);
  const planIdForDate=String(old.planId??"");
  const priorSessions=current(await events(user.organizationId,"TREATMENT_SESSION")).filter(e=>String(getData(e).planId)===planIdForDate&&e.resourceId!==p.data.sessionId);
  const previousSession=priorSessions.find(e=>Number(getData(e).sessionNumber)===Number(old.sessionNumber)-1);
  const previousDate=previousSession?String(getData(previousSession).sessionDate??""):"";
  if(previousDate&&p.data.sessionDate<previousDate)return NextResponse.json({error:"Session date cannot be earlier than the previous session date ("+previousDate+")."},{status:400});
  const performerId=p.data.performedByUserId||String(old.performedByUserId||user.id);
  const performer=await db.user.findUnique({where:{id:performerId},select:{id:true,name:true,email:true}});
  const metadata={...old,sessionDate:p.data.sessionDate,status:p.data.status,performedByUserId:performer?.id??user.id,performedByUserName:performer?.name??user.name??"",notes:p.data.notes??""};
  await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"TREATMENT_SESSION",resourceId:p.data.sessionId,action:"TREATMENT_SESSION_UPDATED",metadata}});
  const planId=String(old.planId);
  const plan=current(await events(user.organizationId,"PATIENT_TREATMENT")).find(e=>e.resourceId===planId);
  if(plan){
   const planData=getData(plan);
   const all=current(await events(user.organizationId,"TREATMENT_SESSION")).filter(e=>String(getData(e).planId)===planId&&e.resourceId!==p.data.sessionId);
   const completed=all.filter(e=>String(getData(e).status)==="COMPLETED").length+(p.data.status==="COMPLETED"?1:0);
   const totalSessions=Number(planData.totalSessions??1);
   const updated={...planData,sessionsCompleted:completed,status:completed>=totalSessions?"COMPLETED":"ACTIVE"};
   await db.auditEvent.create({data:{organizationId:user.organizationId,actorUserId:user.id,resourceType:"PATIENT_TREATMENT",resourceId:planId,action:"PATIENT_TREATMENT_UPDATED",metadata:updated}});
  }
  return NextResponse.json({ok:true});
 }
 return NextResponse.json({error:"Invalid action."},{status:400});
}