export type DirectoryProject={name:string;location:string|null;status:string};
export function filterProjects<T extends DirectoryProject>(projects:T[],query:string,status:string):T[]{
 const search=query.trim().toLowerCase();
 return projects.filter(project=>(status==='ALL'||project.status===status)&&(!search||`${project.name} ${project.location||''}`.toLowerCase().includes(search)));
}
