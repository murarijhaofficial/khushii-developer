export type BookingLead={id:string;name:string;phone:string;email?:string|null};
export function findBookingLeads(leads:BookingLead[],query:string):BookingLead[]{
 const search=query.trim().toLowerCase();
 return search.length<2?[]:leads.filter(lead=>[lead.name,lead.phone,lead.email||''].some(value=>value.toLowerCase().includes(search)));
}
