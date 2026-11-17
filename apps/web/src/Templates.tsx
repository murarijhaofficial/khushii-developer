import React,{useEffect,useState} from 'react';

type Template={id:string;name:string;language:string;category?:string;body:string;parameterCount:number;supported:boolean};
type Client=<T>(path:string,token:string,init?:RequestInit)=>Promise<T>;

export function Templates({token,request,onSelect}:{token:string;request:Client;onSelect?:(name:string)=>void}){
 const [templates,setTemplates]=useState<Template[]>([]);
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 async function load(){setLoading(true);setError('');try{setTemplates(await request<Template[]>('/communication/templates',token))}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
 useEffect(()=>{void load()},[token]);
 return <section className="panel"><div className="panel-title"><div><h2>WhatsApp templates</h2><p>Approved templates from your connected Meta account.</p></div><button className="outline" disabled={loading} onClick={()=>void load()}>{loading?'Loading...':'Refresh templates'}</button></div>
 {error&&<p className="error" role="alert">{error}</p>}
 {!loading&&!error&&templates.length===0&&<p className="empty">No approved templates found.</p>}
 <div className="integration-grid">{templates.map(template=><article className="form-card" key={template.id}><div><strong>{template.name}</strong> <span className="pill success">Approved</span><p className="muted">{template.category||'WhatsApp'} · {template.language} · {template.parameterCount} variables</p></div><p className="preserve-text">{template.body||'No text body'}</p>{!template.supported&&<p className="info">This template uses components that the CRM does not support yet.</p>}{onSelect&&<button type="button" className="outline" disabled={!template.supported} onClick={()=>onSelect(template.name)}>Use in campaign draft</button>}</article>)}</div></section>;
}
