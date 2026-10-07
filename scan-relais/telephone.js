'use strict';
const $=id=>document.getElementById(id),NAMES=['LUCAS','QUENTIN','THEO'];
const valid=s=>typeof s==='string'&&s.trim().length>0&&s.length<=255&&!/[|\r\n\0]/.test(s)&&!s.includes('[object Object]');
let registry=null,session=null,person='QUENTIN',task=null,batch={items:[],mallette:''};
let seq=0,submitted=false,stagedRevision=0,revision=0,nonce='',sending=false,finishing=false,queued=null;
let progressTimer=null,pollTimer=null,pollController=null,pollGeneration=0,lastList='';
function read(k){try{return JSON.parse(localStorage.getItem(k)||'null')}catch{return null}}
function store(k,v){try{localStorage.setItem(k,JSON.stringify(v));return true}catch{$('status').textContent='Stockage local indisponible : gardez cette page ouverte.';return false}}
let device=read('inst-v10-device');if(!device){device=crypto.randomUUID();store('inst-v10-device',device)}
const key=()=> 'inst-v10-phone-'+person;
function save(){if(!registry||!session)return;store(key(),{station:session.id,token:session.token,task,batch,seq,submitted,revision,stagedRevision});store('inst-v7-registry-mobile',registry);store('inst-v7-person-mobile',person)}
function validateRegistry(r){
  if(!r||!Array.isArray(r.stations)||!r.stations.length)throw Error('Téléphone non raccordé. Ouvrez son lien privé une fois depuis Accès scanner.');
  const u=new URL(r.url);if(u.protocol!=='https:'||!u.hostname.endsWith('.workers.dev')||u.username||u.password)throw Error('Relais invalide.');
  r.url=u.origin;r.role='mobile';const names=new Set();
  for(const s of r.stations){if(!NAMES.includes(s.person)||names.has(s.person)||!/^[-a-f0-9]{36}$/.test(s.id)||!/^[a-f0-9]{64}$/.test(s.token))throw Error('Lien téléphone invalide.');names.add(s.person)}return r;
}
async function api(path,body,captured=session,signal){
  if(!captured)throw Error('Téléphone non raccordé.');
  const controller=signal?null:new AbortController(),timer=controller?setTimeout(()=>controller.abort(),15000):null;
  try{
    const fresh=path==='status'?'?t='+Date.now():'';
    const r=await fetch(captured.url+'/rooms/'+captured.id+'/'+path+fresh,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+captured.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',signal:signal||controller.signal});
    const d=await r.json();if(!r.ok){const e=Error(d.error||'Relais indisponible');e.status=r.status;throw e}return d;
  }finally{if(timer)clearTimeout(timer)}
}
function stopScanner(){nonce='';$('scanner').hidden=true;$('scanner').src='about:blank'}
function materialTitle(code){const m=code.match(/^(?:PS|PAS)-([A-Z]-\d+)-(\d+)$/);return m?'Passerelle '+m[1]+' · n° '+m[2]:'Matériel scanné'}
function render(){
  const blocked=finishing||sending||!$('scanner').hidden;
  document.querySelectorAll('[data-person]').forEach(b=>{b.classList.toggle('active',b.dataset.person===person);b.disabled=blocked});
  $('identity').textContent=session?person+' · téléphone raccordé jusqu’à révocation':'Ouvrez le lien privé de ce téléphone.';
  $('task').hidden=!task||submitted;$('vehicle').textContent='Véhicule '+(task?.cm||'');
  $('count').textContent=batch.items.length+' matériel(s)';$('caseNumber').textContent='Mallette : '+(batch.mallette||'—');
  $('scan').disabled=finishing||submitted||!!task?.feedback;$('case').disabled=$('scan').disabled;
  $('finish').disabled=finishing||sending||!batch.items.length||!!task?.feedback;
  $('finish').textContent=finishing?'Enregistrement…':'✓  Terminer le scan';
  const fingerprint=JSON.stringify([task?.id,batch,submitted]);
  if(fingerprint!==lastList){
    lastList=fingerprint;const list=$('items');list.replaceChildren();
    for(const code of batch.items){
      const row=document.createElement('div');row.className='item';
      const check=document.createElement('span');check.className='check';check.textContent='✓';
      const detail=document.createElement('div');detail.className='item-detail';
      const title=document.createElement('strong');title.textContent=materialTitle(code);
      const label=document.createElement('small');label.textContent=code;detail.append(title,label);row.append(check,detail);
      if(!submitted){const remove=document.createElement('button');remove.textContent='×';remove.setAttribute('aria-label','Retirer '+code);remove.onclick=()=>{batch.items=batch.items.filter(x=>x!==code);save();render();queueProgress()};row.append(remove)}list.append(row);
    }
  }
  $('delivery').textContent='Les codes confirmés sont transmis progressivement au PC. Terminez ici, puis confirmez le montage dans le global.';
  $('receipt').hidden=!task||!submitted;
  $('receiptTitle').textContent=task?'Lot envoyé · '+task.cm:'Lot envoyé';
  $('receiptText').textContent=stagedRevision>=revision&&revision>0?'Lot reçu dans SharePoint. La confirmation du montage se fait sur le PC.':'Lot enregistré dans le relais. Transfert vers SharePoint en cours ; vous pouvez rester sur cet accueil.';
}
function archive(){if(!task)return;const history=read('inst-v10-history-'+person)||[];store('inst-v10-history-'+person,[{task,batch,submitted,at:Date.now()},...history.filter(x=>x.task.id!==task.id)].slice(0,20))}
function schedulePoll(delay=1500){if(pollTimer)clearTimeout(pollTimer);pollTimer=null;if(session&&!document.hidden)pollTimer=setTimeout(()=>poll(),delay)}
function select(next){
  if(finishing||sending||!$('scanner').hidden)return;save();pollGeneration++;pollController?.abort();pollController=null;if(progressTimer)clearTimeout(progressTimer);
  person=next;session=registry?.stations.find(s=>s.person===person);if(session)session={...session,url:registry.url};
  task=null;batch={items:[],mallette:''};submitted=false;seq=0;revision=0;stagedRevision=0;queued=null;
  const cached=read(key());
  if(session&&cached?.station===session.id&&cached.token===session.token){task=cached.task;batch=cached.batch||batch;submitted=!!cached.submitted;seq=cached.seq||0;revision=cached.revision||0;stagedRevision=cached.stagedRevision||0}
  else if(session){const old=read('inst-v7-state-mobile-'+person);if(old?.id===session.id&&old.token===session.token&&old.task){task=old.task;batch=old.batch||batch}}
  save();render();$('status').textContent=session?'En attente d’une demande pour '+person:'Ouvrez le lien privé de ce téléphone.';poll(true);
}
async function poll(force=false){
  if(!session||finishing||document.hidden)return;
  if(pollController&&!force)return;
  if(pollTimer)clearTimeout(pollTimer);pollTimer=null;
  if(force)pollController?.abort();
  const controller=new AbortController(),generation=++pollGeneration,captured=session;let showReceived=false;
  pollController=controller;const timeout=setTimeout(()=>controller.abort(),12000);
  try{
    const d=await api('status',null,captured,controller.signal);
    if(generation!==pollGeneration||captured.token!==session?.token||controller.signal.aborted)return;
    if(d.task&&d.task.id!==task?.id){stopScanner();archive();task=d.task;batch={items:[],mallette:''};seq=0;submitted=false;revision=0;stagedRevision=0;queued=null;showReceived=true;PhoneAlerts.arrival(person,task.id)}
    else if(d.task)task=d.task;
    if(!d.task){stopScanner();if(task)archive();task=null;batch={items:[],mallette:''};submitted=false;queued=null;PhoneAlerts.forget(person)}
    if(task){task.feedback=!!d.feedback;submitted=submitted||!!d.received;stagedRevision=Math.max(stagedRevision,d.stagedRevision||0);revision=Math.max(revision,d.revision||0);if(task.feedback&&!$('scanner').hidden)stopScanner();if(!submitted&&!task.feedback)PhoneAlerts.arrival(person,task.id)}
    $('lastCheck').textContent='Actualisation automatique · '+new Date().toLocaleTimeString('fr-FR');
    $('feedback').hidden=!d.feedback;$('feedbackText').textContent=d.feedback?.message||'';
    $('status').textContent=!task?(d.lastCompletion?.status==='Terminé'?'Montage confirmé sur le PC. En attente pour '+person+'.':'En attente d’une demande pour '+person):d.feedback?'Anomalie signalée sur le PC. En attente de la nouvelle demande.':submitted?(stagedRevision>=revision&&revision>0?'Lot reçu sur le PC. En attente d’une nouvelle demande pour '+person+'.':'Lot transmis. Vous pouvez choisir un prénom ; le transfert SharePoint continue.'):'Demande reçue pour '+task.cm+'. Vous pouvez scanner.';
    save();if(task&&!submitted&&!queued&&!sending&&seq>0&&seq>(d.clientSeq??-1))queueProgress();
  }catch(e){if(generation===pollGeneration){$('status').textContent=e.status===403||e.status===410?'Accès révoqué. Demandez le nouveau lien privé. Scans locaux conservés.':e.name==='AbortError'?'Connexion ralentie. Nouvelle vérification automatique…':e.message+' · Nouvelle vérification automatique. Scans locaux conservés.'}}
  finally{clearTimeout(timeout);if(generation===pollGeneration){pollController=null;render();if(showReceived&&!submitted)$('task').scrollIntoView?.({behavior:'smooth',block:'start'});schedulePoll()}}
}
function payload(){return {id:task.id,cm:task.cm,items:[...batch.items],mallette:batch.mallette,device,seq:++seq}}
function queueProgress(){if(!task||submitted||finishing)return;queued=payload();save();if(progressTimer)clearTimeout(progressTimer);progressTimer=setTimeout(flushProgress,350)}
async function flushProgress(){
  if(sending||finishing||!queued||!task)return;sending=true;const body=queued,captured=session;queued=null;
  try{const d=await api('progress',body,captured);if(captured.token===session?.token&&task?.id===body.id){revision=Math.max(revision,d.revision||0);save()}}
  catch(e){if(captured.token===session?.token&&task?.id===body.id){if(!queued&&![400,403,409,410].includes(e.status))queued=body;$('status').textContent=e.message+' · Liste conservée. Réessai automatique.'}}
  finally{sending=false;render();if(queued&&!finishing)progressTimer=setTimeout(flushProgress,1500)}
}
async function finish(){
  if(!task||finishing||sending)return;if(!batch.items.length){$('status').textContent='Confirmez au moins un matériel.';return}
  finishing=true;pollGeneration++;pollController?.abort();pollController=null;queued=null;if(progressTimer)clearTimeout(progressTimer);render();
  const captured=session,body=payload();save();
  try{const d=await api('result',body,captured);if(captured.token!==session?.token||task?.id!==body.id)return;submitted=true;revision=Math.max(revision,d.revision||0);stopScanner();save();archive();$('status').textContent='Lot envoyé. La confirmation du montage se fait maintenant sur le PC.';window.scrollTo?.({top:0,behavior:'smooth'})}
  catch(e){$('status').textContent=(e.name==='AbortError'?'Envoi non confirmé.':e.message)+' · Lot conservé : touchez Terminer pour réessayer.'}
  finally{finishing=false;render();poll(true)}
}
async function scan(mode){
  if(!task||submitted||finishing)return;queueProgress();nonce=crypto.randomUUID();
  const u=new URL('scan-mobile.html?v=10.2',location.href);
  const cached=store('instrumentation-batch-'+task.id+'-'+task.cm,{items:[...batch.items],mallette:batch.mallette,cm:task.cm,at:Date.now()});
  for(const [k,v] of Object.entries({mode,cm:task.cm,items:cached?'':batch.items.join('|'),mallette:cached?'':batch.mallette,nonce,scanSessionId:task.id,scanRequest:task.id}))u.searchParams.set(k,v);
  $('scanner').src=u.href;$('scanner').hidden=false;render();
}
window.addEventListener('message',async e=>{
  const d=e.data;if(e.origin!==location.origin||e.source!==$('scanner').contentWindow||!task||!d||d.nonce!==nonce||d.request!==task.id||d.cm!==task.cm||submitted)return;
  if(!['instrumentation-mobile-batch','instrumentation-mobile-progress','instrumentation-mobile-abandon'].includes(d.type))return;
  if(!Array.isArray(d.items)||d.items.length>200||!d.items.every(valid)||typeof d.mallette!=='string'||d.mallette.length>255||/[|\r\n\0]/.test(d.mallette)){$('status').textContent='Lot invalide : un code reçu n’est pas du texte. Les scans précédents sont conservés.';return}
  batch={items:[...new Set(d.items)],mallette:d.mallette};save();
  if(d.type==='instrumentation-mobile-batch'){
    const id=task.id;stopScanner();queued=null;if(progressTimer)clearTimeout(progressTimer);
    while(sending)await new Promise(r=>setTimeout(r,80));
    if(task?.id===id&&!task.feedback)await finish();
  }else{if(d.type==='instrumentation-mobile-abandon')stopScanner();render();queueProgress()}
});
$('scan').onclick=()=>scan('materiel');$('case').onclick=()=>scan('mallette');$('finish').onclick=finish;
$('names').onclick=async e=>{const next=e.target.closest?.('[data-person]')?.dataset.person||e.target.dataset.person;if(NAMES.includes(next)){const d=await PhoneAlerts.enable(false);$('soundNote').textContent=d.message;select(next)}};
$('sound').onclick=async()=>{const d=await PhoneAlerts.enable(true);$('soundNote').textContent=d.message};
$('refresh').onclick=()=>poll(true);
function wake(){if(!document.hidden){PhoneAlerts.resume?.();poll(true)}}
window.addEventListener('focus',wake);window.addEventListener('pageshow',wake);window.addEventListener('online',wake);
document.addEventListener('visibilitychange',()=>{if(document.hidden){pollGeneration++;pollController?.abort();pollController=null;if(pollTimer)clearTimeout(pollTimer)}else wake()});
function keepPermanentLink(){if(!registry)return;const u=new URL('telephone.html',location.href);u.hash=new URLSearchParams({relay:registry.url,stations:JSON.stringify(registry.stations.map(s=>({person:s.person,id:s.id,token:s.token})))});history.replaceState(null,'',u.href)}
try{const h=new URLSearchParams(location.hash.slice(1));registry=validateRegistry(h.has('stations')?{url:h.get('relay'),stations:JSON.parse(h.get('stations'))}:read('inst-v7-registry-mobile'));keepPermanentLink();person=read('inst-v7-person-mobile')||'QUENTIN'}catch(e){$('status').textContent=e.message}
$('pair').hidden=!!registry;
$('pairConfirm').onclick=()=>{try{const u=new URL($('pairLink').value.trim());if(u.origin!==location.origin)throw Error('Utilisez le lien privé de cette page scanner.');const h=new URLSearchParams(u.hash.slice(1));registry=validateRegistry({url:h.get('relay'),stations:JSON.parse(h.get('stations')||'null')});$('pairLink').value='';keepPermanentLink();$('pair').hidden=true;select(person)}catch(e){$('status').textContent=e.message}};
select(NAMES.includes(person)?person:'QUENTIN');
