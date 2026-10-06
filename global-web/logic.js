(function(root){'use strict';const keys=['SAP','AV','MTG','TX','SI','OTA'];const labels={SAP:'Montage SAP',AV:'Déclaration AirVantage',MTG:'Montage véhicule',TX:'Déclaration TX',SI:'Déclaration Nexus',OTA:'Vérification Réception Trace'};
const valid=v=>!!String(v??'').trim();function color(f){if(valid(f.OTA)&&!valid(f.SAP))return 'white';const n=keys.filter(k=>valid(f[k])).length;return n===6?'green':n?'amber':'red'}
function initials(name){return String(name).trim().split(/[\s-]+/).filter(Boolean).map(x=>x[0]).join('').toUpperCase().slice(0,8)}
function date(value){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value))}
function today(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Paris',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())}
function monday(value){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7));return d.toISOString().slice(0,10)}
function shift(value,n){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)}
function iso(value){const d=new Date(value+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+3-((d.getUTCDay()+6)%7));const year=d.getUTCFullYear(),jan=new Date(Date.UTC(year,0,4,12));return {year,week:1+Math.round((d-jan+(jan.getUTCDay()+6)%7*86400000-3*86400000)/604800000)}}
function fromWeek(v){const [y,w]=v.split('-W').map(Number);return shift(monday(y+'-01-04'),(w-1)*7)}
function mallette(aff){return [...new Set(aff.map(a=>String(a.fields.Commentaire||'').match(/^Mallette\s*:\s*(.+)$/i)?.[1]).filter(Boolean))].join(', ')}
const api={keys,labels,valid,color,initials,date,today,monday,shift,iso,fromWeek,mallette};if(typeof module==='object')module.exports=api;else root.GlobalLogic=api})(typeof globalThis!=='undefined'?globalThis:this);