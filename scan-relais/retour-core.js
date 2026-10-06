'use strict';
(function(root){
 function appURL(value){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!=='apps.powerapps.com'||u.username||u.password||!/^\/play\//.test(u.pathname))throw Error('Collez le lien web du global : https://apps.powerapps.com/play/…');u.hash='';return u}
 function importURL(link,result,meta){
  if(!meta||meta.id!==result.id||meta.cm!==result.cm||!/^\d+$/.test(meta.planning)||!/^[-a-f0-9]{36}$/i.test(meta.jeton)||meta.person!==result.person)throw Error('Lot sans fiche correspondante. Ouvrez la liaison depuis « Créer un véhicule » dans le global.');
  if(!Array.isArray(result.items)||!result.items.length||result.items.length>200||!result.items.every(s=>typeof s==='string'&&s.length>0&&s.length<=255&&!/[|\r\n\0]/.test(s)))throw Error('Liste de matériels invalide.');
  if(typeof result.mallette!=='string'||result.mallette.length>255||/[|\r\n\0]/.test(result.mallette))throw Error('Mallette invalide.');
  const u=appURL(link);for(const k of [...u.searchParams.keys()])if(k.startsWith('scan')||['items','mallette','source','hint','sourcetime'].includes(k))u.searchParams.delete(k);
  const fields={scanMode:'pcbatch',scanPlanning:meta.planning,scanJeton:meta.jeton,scanStation:result.person,scanCM:result.cm,items:[...new Set(result.items)].join('|'),mallette:result.mallette};for(const [k,v]of Object.entries(fields))u.searchParams.set(k,v);
  if(u.href.length>8000)throw Error('Lot trop long pour un lien web. Conservez-le et répartissez les scans en lots plus courts avant l’envoi.');return u.href;
 }
 root.RetourCore={appURL,importURL};if(typeof module!=='undefined')module.exports=root.RetourCore;
})(typeof window==='undefined'?globalThis:window);
