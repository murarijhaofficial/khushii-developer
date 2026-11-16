export type EnquiryDetails = {project?:string;interest?:string;plotSize?:string;budget?:string;preferredVisit?:string;message?:string;sourcePage?:string};
const keys: Record<string,keyof EnquiryDetails> = {'project':'project','interest':'interest','plot size':'plotSize','budget':'budget','preferred visit':'preferredVisit','message':'message','source page':'sourcePage'};
const order = ['project','interest','plot size','budget','preferred visit','message','source page'];

/** Read both multiline connector notes and older WordPress notes with collapsed whitespace. */
export function parseEnquiryDetails(text:string|null|undefined):EnquiryDetails {
  if(!text?.trim())return {};
  const raw=text.trim();
  if(!/^(?:Project|Interest)\s*:/i.test(raw))return {message:raw};
  const found=[...raw.matchAll(/(?:^|\s)(Project|Interest|Plot size|Budget|Preferred visit|Message|Source page)\s*:\s*/gi)];
  const accepted:typeof found=[];let previous=-1;
  for(const match of found){
    const label=match[1].toLowerCase();const index=order.indexOf(label);
    // Message content can contain field-like words; only the final source marker terminates it.
    if(label==='source page' && found.some(other=>other.index!>match.index!&&other[1].toLowerCase()==='source page'))continue;
    if(index>previous){accepted.push(match);previous=index;}
  }
  const result:EnquiryDetails={};
  accepted.forEach((match,i)=>{const value=raw.slice(match.index!+match[0].length,accepted[i+1]?.index??raw.length).trim();if(value)result[keys[match[1].toLowerCase()]]=value;});
  return result;
}
export function safeSourceUrl(value:string|undefined):string|undefined {
  if(!value)return;try{const url=new URL(value);if(['http:','https:'].includes(url.protocol)&&!url.username&&!url.password)return url.href;}catch{/* Show unrecognized URLs as plain text. */}
}
export function formatBudget(value:string):string {
  if(!/^\d+(?:\.\d{1,2})?$/.test(value)||!Number.isSafeInteger(Math.trunc(Number(value))))return value;
  return new Intl.NumberFormat('en-IN',{maximumFractionDigits:2}).format(Number(value));
}
export function formatVisitDate(value:string):string {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return value;
  const date=new Date(value+'T00:00:00Z');
  if(Number.isNaN(date.getTime())||date.toISOString().slice(0,10)!==value)return value;
  return new Intl.DateTimeFormat('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(date);
}
