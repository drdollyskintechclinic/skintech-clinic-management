import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/server/auth/authorization";
import { db } from "@/server/db/prisma";

const starterTemplates = [{"field":"chiefComplaint","name":"General skin consultation","content":"Patient presents with concerns regarding skin condition. Duration: ____. Main concerns: ____. Previous treatment: ____."},{"field":"chiefComplaint","name":"Acne consultation","content":"Patient presents with acne/acne-related concerns. Duration: ____. Distribution: ____. Associated symptoms: ____. Previous treatment: ____."},{"field":"chiefComplaint","name":"Pigmentation consultation","content":"Patient presents with pigmentation/uneven skin tone. Duration: ____. Site: ____. Previous treatment: ____."},{"field":"chiefComplaint","name":"Hair fall consultation","content":"Patient presents with hair fall/thinning. Duration: ____. Pattern noticed: ____. Associated scalp symptoms: ____. Previous treatment: ____."},{"field":"chiefComplaint","name":"Dandruff/scalp consultation","content":"Patient presents with dandruff/scalp concerns. Duration: ____. Symptoms: ____. Previous treatment: ____."},{"field":"chiefComplaint","name":"Laser hair reduction consultation","content":"Patient presents for unwanted hair reduction. Areas of concern: ____. Previous hair-removal methods: ____."},{"field":"chiefComplaint","name":"Hair restoration consultation","content":"Patient presents for hair restoration assessment. Main concern: ____. Duration: ____. Previous treatment: ____."},{"field":"chiefComplaint","name":"PMU consultation","content":"Patient presents for semi-permanent makeup consultation. Desired procedure: ____. Previous PMU/procedure history: ____."},{"field":"chiefComplaint","name":"Scar consultation","content":"Patient presents with concern regarding scar(s). Duration/onset: ____. Site: ____. Previous treatment: ____."},{"field":"chiefComplaint","name":"Follow-up consultation","content":"Patient presents for follow-up of previous treatment. Current concern: ____. Response since last visit: ____."},{"field":"examinationFindings","name":"General skin examination","content":"Skin examined for texture, tone, pigmentation, lesions and inflammatory changes. Relevant findings: ____."},{"field":"examinationFindings","name":"Acne examination","content":"Examination notes: comedones ____, papules ____, pustules ____, nodules/cysts ____, post-inflammatory changes ____. Distribution: ____."},{"field":"examinationFindings","name":"Pigmentation examination","content":"Pigmentation assessed for site, distribution, symmetry, intensity and associated skin changes. Findings: ____."},{"field":"examinationFindings","name":"Hair/scalp examination","content":"Scalp and hair examined for density, hair calibre, shedding pattern, scalp condition and visible inflammation/scaling. Findings: ____."},{"field":"examinationFindings","name":"Dandruff/scalp examination","content":"Scalp examined for scaling, erythema, oiliness/dryness and other visible changes. Findings: ____."},{"field":"examinationFindings","name":"Laser hair reduction assessment","content":"Treatment area assessed for hair density, hair calibre, skin appearance and relevant precautions. Findings: ____."},{"field":"examinationFindings","name":"Hair restoration assessment","content":"Hair loss pattern, scalp condition, density and relevant donor/recipient areas assessed. Findings: ____."},{"field":"examinationFindings","name":"PMU assessment","content":"Area assessed for skin condition, previous pigmentation/tattoo/PMU and suitability for planned procedure. Findings: ____."},{"field":"examinationFindings","name":"Scar assessment","content":"Scar assessed for site, size, type/appearance, texture, pigmentation and surrounding skin. Findings: ____."},{"field":"examinationFindings","name":"Follow-up examination","content":"Previous treatment area reviewed. Current examination findings: ____. Change compared with previous visit: ____."},{"field":"diagnosis","name":"General skin assessment","content":"Assessment: ____."},{"field":"diagnosis","name":"Acne assessment","content":"Clinical assessment of acne/acne-related changes: ____."},{"field":"diagnosis","name":"Pigmentation assessment","content":"Clinical assessment of pigmentation/uneven skin tone: ____."},{"field":"diagnosis","name":"Hair fall assessment","content":"Clinical assessment of hair loss/thinning pattern: ____."},{"field":"diagnosis","name":"Scalp condition assessment","content":"Clinical assessment of scalp condition: ____."},{"field":"diagnosis","name":"Photoaging assessment","content":"Clinical assessment of visible photoaging/skin texture changes: ____."},{"field":"diagnosis","name":"Scar assessment","content":"Clinical assessment of scar characteristics and surrounding skin: ____."},{"field":"diagnosis","name":"Unwanted hair assessment","content":"Assessment of unwanted hair in the treatment area: ____."},{"field":"diagnosis","name":"PMU suitability assessment","content":"Assessment of planned PMU area and suitability based on current examination: ____."},{"field":"diagnosis","name":"Follow-up assessment","content":"Follow-up assessment based on clinical findings and response to previous treatment: ____."},{"field":"treatmentAdvised","name":"General skincare plan","content":"Personalized skincare plan discussed. Products/procedures advised: ____. Frequency: ____. Review planned: ____."},{"field":"treatmentAdvised","name":"Acne treatment plan","content":"Acne management options discussed based on assessment. Recommended plan: ____. Home care: ____. Review: ____."},{"field":"treatmentAdvised","name":"Pigmentation treatment plan","content":"Pigmentation management options discussed. Recommended plan: ____. Sun protection/home care: ____. Review: ____."},{"field":"treatmentAdvised","name":"Hair fall treatment plan","content":"Hair fall management options discussed based on assessment. Recommended plan: ____. Investigations if required: ____. Review: ____."},{"field":"treatmentAdvised","name":"Scalp care plan","content":"Scalp care plan discussed. Recommended products/procedures: ____. Frequency: ____. Review: ____."},{"field":"treatmentAdvised","name":"Laser hair reduction plan","content":"Laser hair reduction plan discussed for selected area(s). Session schedule, preparation and precautions explained."},{"field":"treatmentAdvised","name":"Hair restoration plan","content":"Hair restoration options discussed based on assessment. Recommended procedure/plan: ____. Expected follow-up: ____."},{"field":"treatmentAdvised","name":"PMU aftercare plan","content":"Procedure and aftercare instructions discussed. Expected healing course and precautions explained."},{"field":"treatmentAdvised","name":"Chemical peel plan","content":"Peel treatment plan discussed according to assessment. Preparation, expected response, aftercare and review instructions explained."},{"field":"treatmentAdvised","name":"Follow-up treatment plan","content":"Response to previous treatment reviewed. Continue/modify the plan as documented: ____. Next review: ____."},{"field":"procedurePerformed","name":"Consultation only","content":"Clinical consultation and assessment completed. No procedure performed during this visit."},{"field":"procedurePerformed","name":"Hydrafacial procedure","content":"Hydrafacial performed as planned. Procedure details/parameters: ____. Patient response: ____."},{"field":"procedurePerformed","name":"Chemical peel procedure","content":"Chemical peel performed as planned. Peel/product and exposure details: ____. Immediate response: ____."},{"field":"procedurePerformed","name":"Laser hair reduction","content":"Laser hair reduction performed on: ____. Device/parameters: ____. Skin response: ____."},{"field":"procedurePerformed","name":"Carbon laser facial","content":"Carbon laser facial performed as planned. Treatment area and parameters: ____. Immediate response: ____."},{"field":"procedurePerformed","name":"MediFacial procedure","content":"MediFacial performed as planned. Products/steps: ____. Patient response: ____."},{"field":"procedurePerformed","name":"Hair PRP procedure","content":"Hair PRP procedure performed as planned. Treatment area and procedural details: ____. Patient response: ____."},{"field":"procedurePerformed","name":"Hair GFC procedure","content":"Hair GFC procedure performed as planned. Treatment area and procedural details: ____. Patient response: ____."},{"field":"procedurePerformed","name":"PMU procedure","content":"PMU procedure performed as planned. Procedure/site/details: ____. Immediate response: ____."},{"field":"procedurePerformed","name":"Minor procedure","content":"Minor procedure performed as planned. Site/procedure details: ____. Immediate findings and response: ____."},{"field":"prescription","name":"No prescription","content":"No medication prescription provided today. Continue previously prescribed medicines only as directed. New/changed medicines: ____."},{"field":"prescription","name":"Acne – topical regimen","content":"Rx / Topical plan:\n1. Cleanser: ____ | Strength: ____ | Use: ____ | Frequency: ____\n2. Acne active: ____ | Strength: ____ | Apply: ____ | Frequency: ____\n3. Moisturizer: ____ | Frequency: ____\n4. Sunscreen: ____ | SPF: ____ | Frequency: ____\nInstructions: Introduce/adjust actives according to tolerance. Avoid picking/scrubbing. Review: ____."},{"field":"prescription","name":"Acne + post-inflammatory pigmentation","content":"Rx / Topical plan:\n1. Acne treatment: ____ | Strength: ____ | Application: ____ | Frequency: ____\n2. Pigmentation treatment: ____ | Strength: ____ | Application: ____ | Frequency: ____\n3. Moisturizer: ____\n4. Broad-spectrum sunscreen: ____ | SPF: ____ | Frequency: ____\nAdditional advice: Avoid picking and monitor irritation. Review: ____."},{"field":"prescription","name":"Pigmentation / melasma regimen","content":"Rx / Pigmentation plan:\n1. Pigment-control product: ____ | Strength: ____ | Application: ____ | Frequency: ____\n2. Supportive skincare: ____\n3. Sunscreen: ____ | SPF: ____ | Reapplication: ____\n4. Night-care product, if indicated: ____ | Strength: ____ | Frequency: ____\nCounselling: Strict photoprotection and adherence discussed. Review: ____."},{"field":"prescription","name":"Hair fall / hair thinning regimen","content":"Rx / Hair & scalp plan:\n1. Scalp treatment: ____ | Strength/form: ____ | Application: ____ | Frequency: ____\n2. Oral supplement/medicine, if indicated: ____ | Strength: ____ | Dose: ____ | Frequency: ____\n3. Hair/scalp care product: ____ | Frequency: ____\nInvestigations, if required: ____. Review: ____."},{"field":"prescription","name":"Dandruff / seborrheic scalp regimen","content":"Rx / Scalp plan:\n1. Medicated shampoo: ____ | Active/strength: ____ | Contact time: ____ | Frequency: ____\n2. Scalp treatment: ____ | Strength: ____ | Application: ____ | Frequency: ____\n3. Maintenance shampoo/care: ____\nAdvice: Avoid scratching and use products as directed. Review: ____."},{"field":"prescription","name":"Post-chemical-peel care","content":"Post-procedure Rx / care:\n1. Gentle cleanser: ____ | Frequency: ____\n2. Barrier-repair moisturizer: ____ | Frequency: ____\n3. Sunscreen: ____ | SPF: ____ | Reapplication: ____\n4. Post-peel medication/product, if indicated: ____ | Application: ____ | Frequency: ____ | Duration: ____\nAvoid: picking/peeling skin, unapproved actives, waxing or additional procedures until cleared. Review: ____."},{"field":"prescription","name":"Post-laser procedure care","content":"Post-laser Rx / care:\n1. Gentle cleanser: ____ | Frequency: ____\n2. Soothing/barrier product: ____ | Frequency: ____\n3. Sunscreen: ____ | SPF: ____ | Reapplication: ____\n4. Medication/product, if clinically indicated: ____ | Application: ____ | Frequency: ____ | Duration: ____\nPrecautions and expected post-treatment changes explained. Review: ____."},{"field":"prescription","name":"Hair PRP / GFC aftercare","content":"Post-procedure care:\n1. Scalp cleansing: ____ | Start after: ____ | Frequency: ____\n2. Scalp medication/product, if prescribed: ____ | Application: ____ | Frequency: ____\n3. Oral medicine/supplement, if indicated: ____ | Strength: ____ | Dose: ____ | Frequency: ____\n4. Usual hair-care plan: ____\nProcedure-specific precautions explained. Review/session: ____."},{"field":"prescription","name":"Eczema / dermatitis-type regimen","content":"Rx / Skin barrier plan:\n1. Gentle cleanser: ____ | Frequency: ____\n2. Emollient/moisturizer: ____ | Frequency: ____\n3. Anti-inflammatory topical, if indicated: ____ | Strength: ____ | Application: ____ | Frequency: ____ | Duration: ____\n4. Other treatment, if indicated: ____\nAvoid identified triggers/irritants. Review: ____."},{"field":"doctorNotes","name":"Routine consultation note","content":"Patient assessed and findings discussed. Treatment options, expected course and relevant precautions explained. Patient questions addressed."},{"field":"doctorNotes","name":"Treatment consent discussed","content":"Planned treatment, expected benefits, limitations, possible side effects/risks and aftercare were discussed. Patient questions addressed."},{"field":"doctorNotes","name":"Procedure tolerated well","content":"Procedure completed as planned. Patient tolerated the procedure without immediate significant concern. Post-procedure instructions provided."},{"field":"doctorNotes","name":"Aftercare explained","content":"Aftercare instructions explained verbally and provided as applicable. Expected changes and precautions discussed."},{"field":"doctorNotes","name":"Before/after photographs","content":"Clinical photographs were discussed/taken as applicable for treatment documentation, with patient consent where required."},{"field":"doctorNotes","name":"Follow-up planned","content":"Follow-up advised on/around: ____. Patient advised to return earlier if clinically concerning symptoms occur."},{"field":"doctorNotes","name":"Patient counselling","content":"Patient counselling provided regarding treatment expectations, adherence, skin/scalp care and follow-up."},{"field":"doctorNotes","name":"Treatment options discussed","content":"Available treatment options and their expected course were discussed. Patient selected the documented plan after discussion."},{"field":"doctorNotes","name":"No procedure today","content":"Consultation completed today. Procedure deferred/not performed. Further plan: ____."},{"field":"doctorNotes","name":"Review note","content":"Patient reviewed after previous treatment. Progress and current concerns discussed. Plan updated as documented."}];

const fields = ["chiefComplaint","examinationFindings","diagnosis","treatmentAdvised","procedurePerformed","prescription","doctorNotes"] as const;
const schema = z.object({
  field: z.enum(fields),
  name: z.string().trim().min(1).max(120),
  content: z.string().trim().min(1).max(6000),
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0)
});

async function listTemplates(organizationId: string, actorUserId: string) {
  const events = await db.auditEvent.findMany({
    where: { organizationId, resourceType: "CONSULTATION_TEMPLATE" },
    orderBy: { occurredAt: "desc" },
    take: 2000
  });

  const resetMarker = await db.auditEvent.findFirst({
    where: { organizationId, resourceType: "CONSULTATION_TEMPLATE_RESET", resourceId: "starter-v3" }
  });

  if (!resetMarker) {
    const seeded = await db.$transaction(async (tx) => {
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${"skintech-consultation-template-reset:" + organizationId}))`);

      const marker = await tx.auditEvent.findFirst({
        where: { organizationId, resourceType: "CONSULTATION_TEMPLATE_RESET", resourceId: "starter-v3" }
      });
      if (marker) return null;

      const currentEvents = await tx.auditEvent.findMany({
        where: { organizationId, resourceType: "CONSULTATION_TEMPLATE" },
        orderBy: { occurredAt: "desc" },
        select: { resourceId: true, metadata: true }
      });
      const latest = new Map<string, typeof currentEvents[number]>();
      for (const event of currentEvents) {
        if (!event.resourceId || latest.has(event.resourceId)) continue;
        latest.set(event.resourceId, event);
      }
      const prescriptionStarterIds = Array.from({ length: 10 }, (_, index) =>
        "starter-v1-" + String(51 + index).padStart(3, "0")
      );
      const deleteEvents = Array.from(latest.values())
        .filter((event) =>
          event.resourceId &&
          prescriptionStarterIds.includes(event.resourceId) &&
          (event.metadata as Record<string, unknown> | null)?.field === "prescription"
        )
        .map((event) => ({
          organizationId,
          actorUserId,
          resourceType: "CONSULTATION_TEMPLATE",
          resourceId: event.resourceId as string,
          action: "CONSULTATION_TEMPLATE_DELETED",
          metadata: { id: event.resourceId, reason: "Replace prescription starter templates" }
        }));
      if (deleteEvents.length) await tx.auditEvent.createMany({ data: deleteEvents });

      const prescriptionTemplates = starterTemplates.filter((template) => template.field === "prescription");
      const data = prescriptionTemplates.map((template, index) => ({
        organizationId, actorUserId, resourceType: "CONSULTATION_TEMPLATE",
        resourceId: "starter-v3-prescription-" + String(index + 1).padStart(3, "0"),
        action: "CONSULTATION_TEMPLATE_CREATED",
        metadata: {
          id: "starter-v3-prescription-" + String(index + 1).padStart(3, "0"),
          ...template,
          active: true,
          sortOrder: 50 + index
        }
      }));
      await tx.auditEvent.createMany({ data });
      await tx.auditEvent.create({
        data: {
          organizationId, actorUserId, resourceType: "CONSULTATION_TEMPLATE_RESET",
          resourceId: "starter-v3", action: "CONSULTATION_TEMPLATE_RESET_COMPLETED",
          metadata: { templateCount: data.length, version: "starter-v3", scope: "prescription" }
        }
      });
      return data.map((event) => event.metadata as Record<string, unknown>);
    });

    if (seeded) return seeded;
  }
  const latest = new Map<string, any>();
  for (const event of events) {
    if (!event.resourceId || latest.has(event.resourceId)) continue;
    latest.set(event.resourceId, event);
  }
  return [...latest.values()]
    .filter((event) => event.action !== "CONSULTATION_TEMPLATE_DELETED")
    .map((event) => ({ id: event.resourceId, ...(event.metadata as Record<string, unknown>) }))
    .sort((a, b) => Number(a.sortOrder ?? 0) - Number(b.sortOrder ?? 0) || String(a.name).localeCompare(String(b.name)));
}

export async function GET() {
  const user = await requirePermission("clinical.read");
  return NextResponse.json({ templates: await listTemplates(user.organizationId, user.id) });
}

export async function POST(request: Request) {
  const user = await requirePermission("staff.manage");
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Please check the template details." }, { status: 400 });
  const id = crypto.randomUUID();
  const metadata = { id, ...parsed.data };
  await db.auditEvent.create({
    data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "CONSULTATION_TEMPLATE", resourceId: id, action: "CONSULTATION_TEMPLATE_CREATED", metadata }
  });
  return NextResponse.json({ template: metadata }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await requirePermission("staff.manage");
  const body = await request.json();
  const id = z.string().uuid().safeParse(body.id);
  const parsed = schema.safeParse(body);
  if (!id.success || !parsed.success) return NextResponse.json({ error: "Please check the template details." }, { status: 400 });
  const metadata = { id: id.data, ...parsed.data };
  await db.auditEvent.create({
    data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "CONSULTATION_TEMPLATE", resourceId: id.data, action: "CONSULTATION_TEMPLATE_UPDATED", metadata }
  });
  return NextResponse.json({ template: metadata });
}

export async function DELETE(request: Request) {
  const user = await requirePermission("staff.manage");
  const id = z.string().uuid().safeParse((await request.json()).id);
  if (!id.success) return NextResponse.json({ error: "Invalid template." }, { status: 400 });
  await db.auditEvent.create({
    data: { organizationId: user.organizationId, actorUserId: user.id, resourceType: "CONSULTATION_TEMPLATE", resourceId: id.data, action: "CONSULTATION_TEMPLATE_DELETED", metadata: { id: id.data } }
  });
  return NextResponse.json({ success: true });
}
