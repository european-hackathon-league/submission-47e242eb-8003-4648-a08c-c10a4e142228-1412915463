import {diaryEntries} from './project-diary.mjs';
const validDay=value=>{if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;const date=new Date(`${value}T12:00:00Z`);return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value};
export function prepareDiarySummary(request,records){
  if(Object.hasOwn(request,'events'))throw new Error('Summary sources must come from server records, not supplied events.');
  const start=request.day||request.start,end=request.day||request.end;
  if(!validDay(start)||!validDay(end)||start>end)throw new Error('Choose valid inclusive dates in chronological order.');
  const timeZone=request.timeZone||'Europe/Berlin';
  let formatter;try{formatter=new Intl.DateTimeFormat('en-CA',{timeZone,year:'numeric',month:'2-digit',day:'2-digit'})}catch{throw new Error('Invalid time zone.')}
  const project=request.project;
  if(project&&(!['G60','F70','G70'].includes(project.vehicle)||!/^\w{2}$/.test(project.market||'')))throw new Error('Invalid product project.');
  const localDay=at=>{const parts=Object.fromEntries(formatter.formatToParts(new Date(at)).map(part=>[part.type,part.value]));return `${parts.year}-${parts.month}-${parts.day}`};
  const events=diaryEntries(records,project||null).filter(event=>{const day=localDay(event.at);return day>=start&&day<=end}).map(event=>({id:event.id,at:event.at,type:event.type,title:event.title,description:event.description,provenance:event.provenance,data:{rationale:event.data?.rationale||event.data?.pmReasoning||'',synthetic:Boolean(event.data?.synthetic),project:event.data?.project||{vehicle:event.data?.vehicle,market:event.data?.market}}}));
  if(!events.length)throw new Error('No recorded changes in this project and date range.');
  return {day:request.day,start,end,project:project||null,onboarding:Boolean(request.onboarding),timeZone,events};
}
export async function summarizeStoredDiary(request,records,summarize){const input=prepareDiarySummary(request,records);const result=await summarize(input);return {...result,sourceScope:{start:input.start,end:input.end,timeZone:input.timeZone,project:input.project,eventCount:input.events.length,eventIds:input.events.map(event=>event.id)}}}
