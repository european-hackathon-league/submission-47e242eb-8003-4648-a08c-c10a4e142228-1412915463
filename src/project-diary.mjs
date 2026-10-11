export const DIARY_TYPES = new Set(['requirement-approved','requirement-approved-with-conditions','requirement-rejected','requirement-deleted','requirement-edited','group-renamed','ranking-changed','requirement-grouped','group-split','group-merged','responsible-entity-corrected','interpretation-confirmed','project-created']);
export const isDiaryEvent = event => Boolean(event?.id && DIARY_TYPES.has(event.type) && Number.isFinite(Date.parse(event.at)));
export function dayKey(at) {
  const date=new Date(at);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function diaryEntries(events, project, day='') {
  return [...new Map(events.filter(isDiaryEvent).filter(event => !project || (event.data?.project?.vehicle===project.vehicle && event.data?.project?.market===project.market) || (event.data?.vehicle===project.vehicle && event.data?.market===project.market)).filter(event=>!day||dayKey(event.at)===day).map(event=>[event.id,event])).values()].sort((a,b)=>Date.parse(b.at)-Date.parse(a.at));
}

export function diaryRange(preset,events=[],now=new Date()) {
  const today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
  let start,end;
  if(preset==='week'){
    end=new Date(today);const sinceFriday=(today.getDay()+2)%7;end.setDate(end.getDate()-(sinceFriday===0?7:sinceFriday));
    start=new Date(end);start.setDate(start.getDate()-4);
  }else if(preset==='month'){
    start=new Date(today.getFullYear(),today.getMonth()-1,1,12);end=new Date(today.getFullYear(),today.getMonth(),0,12);
  }else if(preset==='quarter'){
    const currentQuarter=Math.floor(today.getMonth()/3)*3;start=new Date(today.getFullYear(),currentQuarter-3,1,12);end=new Date(today.getFullYear(),currentQuarter,0,12);
  }else if(preset==='onboarding'){
    const dates=events.map(event=>Date.parse(event.at)).filter(Number.isFinite);start=dates.length?new Date(Math.min(...dates)):today;end=today;
  }else throw new Error('Unknown timeline preset.');
  return {start:dayKey(start),end:dayKey(end)};
}
export function eventsInRange(events,start,end){return diaryEntries(events,null).filter(event=>dayKey(event.at)>=start&&dayKey(event.at)<=end)}
