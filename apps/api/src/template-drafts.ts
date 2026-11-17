import {z} from 'zod';

export function templateParameterCount(body:string):number|null {
 const values=[...body.matchAll(/\{\{([1-9]\d?)\}\}/g)].map(match=>Number(match[1]));
 if(/\{\{|\}\}/.test(body.replace(/\{\{[1-9]\d?\}\}/g,'')))return null;
 const count=values.length?Math.max(...values):0;
 if(count>20||Array.from({length:count},(_,i)=>i+1).some(value=>!values.includes(value)))return null;
 return count;
}
export const templateDraftInput=z.object({name:z.string().trim().min(1).max(120).regex(/^[a-z0-9_]+$/),language:z.string().trim().min(2).max(20).regex(/^[A-Za-z]{2,3}(?:_[A-Za-z0-9]{2,8})?$/),body:z.string().trim().min(1).max(1024).refine(body=>templateParameterCount(body)!==null,'Use consecutive numbered variables such as {{1}} and {{2}}.')}).strict();
