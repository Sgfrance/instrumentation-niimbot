(function(root){
  'use strict';
  const FORM='https://forms.cloud.microsoft/Pages/ResponsePage.aspx';
  const FORM_ID='zdVS2ExyKEGIEv-l2z-FBwqFylCgRvZHvSi7t1k5i55UN1hJODZVRldHQ0RQTUxKVEJFWEpDUE9INi4u';
  const FIELD='rf48cfb7f639c4e96bde8447f8a2c239d';
  const MAX_URL=1900;
  const code=x=>typeof x==='string'&&x.trim().length>0&&x.length<=255&&!/[|\r\n\0]/.test(x);
  function payload(task,batch){
    if(!task||! /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(task.id))throw Error('Demande invalide : relancez-la depuis le global V9.');
    if(!['QUENTIN','LUCAS','THEO'].includes(task.person)||!code(task.cm)||task.cm.length>80)throw Error('Fiche ou prénom invalide.');
    if(!Array.isArray(batch.items)||batch.items.length===0||batch.items.length>200||!batch.items.every(code))throw Error('Scannez au moins un matériel valide.');
    if(typeof batch.mallette!=='string'||batch.mallette.length>255||/[|\r\n\0]/.test(batch.mallette))throw Error('Numéro de mallette invalide.');
    return {v:9,request:task.id,person:task.person,cm:task.cm,items:[...new Set(batch.items)],mallette:batch.mallette};
  }
  function url(data){
    const u=new URL(FORM);u.searchParams.set('id',FORM_ID);u.searchParams.set(FIELD,JSON.stringify(data));
    if(u.href.length>MAX_URL)throw Error('Lot trop long pour le lien Forms sécurisé. Aucun code n’a été retiré. Conservez le lot et utilisez la saisie manuelle sur le PC pour ce montage.');
    return u.href;
  }
  const api={payload,url,MAX_URL,FIELD};root.FormsCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof globalThis==='undefined'?this:globalThis);
