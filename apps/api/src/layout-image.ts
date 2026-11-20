export type LayoutImageResult = {ok:true;data:string}|{ok:false;error:string};
export function normalizeLayoutImage(data:string):LayoutImageResult{
 const match=/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(data);
 if(!match)return {ok:false,error:'Choose a PNG, JPEG or WebP image.'};
 const bytes=Buffer.from(match[2],'base64');
 if(bytes.length>2*1024*1024||bytes.toString('base64')!==match[2])return {ok:false,error:'Image must be at most 2 MB and contain valid image data.'};
 let type:string|undefined;
 if(bytes.length>=8&&bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))type='png';
 else if(bytes.length>=3&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)type='jpeg';
 else if(bytes.length>=12&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP')type='webp';
 if(!type)return {ok:false,error:'This file is not a PNG, JPEG or WebP image. Please export the layout as one of those formats.'};
 return {ok:true,data:`data:image/${type};base64,${match[2]}`};
}
