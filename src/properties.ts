export type PropertyId = "closet" | "corner" | "warehouse";
export const PROPERTIES = {
 closet: {name:"The Iron Closet",lease:300,rent:70,pitch:"A former high-street shop. Cheap rent. Absolutely no room for your ego.",color:"#596d58"},
 corner: {name:"Corner Gains",lease:500,rent:95,pitch:"An L-shaped corner shop. Two workout wings, one awkward connecting corner.",color:"#b47754"},
 warehouse: {name:"Big Unit Energy",lease:750,rent:130,pitch:"A wide industrial unit. Plenty of floor. Less money to fill it.",color:"#687982"},
};
export function roomContains(id: PropertyId | undefined, c: {x:number;z:number}, expanded=false) {
 if(expanded && expansionContains(id,c))return true;
 if(c.x<0||c.z<0||c.x>=12||c.z>=12)return false;
 if(id==="closet")return c.x>=3&&c.x<=8&&c.z>=2;
 if(id==="corner")return c.x>=1&&c.x<=10&&c.z>=2&&!(c.x>=7&&c.z<=6);
 return true;
}
export function roomTiles(id: PropertyId) {
 return Array.from({length:144},(_,n)=>({x:n%12,z:Math.floor(n/12)})).filter(c=>roomContains(id,c));
}

export const EXPANSIONS = {
 closet: {name:"Back stockroom",cost:450,rent:30,door:{x:8,z:4},outside:{x:9,z:4},approach:{x:7,z:4},minX:11,maxX:16,minZ:1,maxZ:8},
 corner: {name:"Neighboring unit",cost:650,rent:45,door:{x:1,z:6},outside:{x:0,z:6},approach:{x:2,z:6},minX:-10,maxX:-2,minZ:3,maxZ:9},
 warehouse: {name:"Side warehouse bay",cost:900,rent:70,door:{x:11,z:6},outside:{x:12,z:6},approach:{x:10,z:6},minX:12,maxX:17,minZ:2,maxZ:11},
};
export function expansionContains(id:PropertyId|undefined,c:{x:number;z:number}) {
 if(!id)return false;
 if(id==="closet" && c.z===4 && c.x>=9 && c.x<=10)return true;
 if(id==="corner" && c.z===6 && c.x>=-1 && c.x<=0)return true;
 const e=EXPANSIONS[id];return c.x>=e.minX&&c.x<=e.maxX&&c.z>=e.minZ&&c.z<=e.maxZ;
}
export function doorwayReserved(id:PropertyId|undefined,c:{x:number;z:number}) {
 if(!id)return false;
 if(id==="closet" && c.z===4 && c.x>=9 && c.x<=11)return true;
 if(id==="corner" && c.z===6 && c.x>=-2 && c.x<=0)return true;
 const e=EXPANSIONS[id];return [e.door,e.outside,e.approach].some(p=>p.x===c.x&&p.z===c.z);
}
export function canStep(id:PropertyId|undefined,a:{x:number;z:number},b:{x:number;z:number}) {
 if(!id||expansionContains(id,a)===expansionContains(id,b))return true;
 const e=EXPANSIONS[id];return (a.x===e.door.x&&a.z===e.door.z&&b.x===e.outside.x&&b.z===e.outside.z)||(b.x===e.door.x&&b.z===e.door.z&&a.x===e.outside.x&&a.z===e.outside.z);
}
