'use strict';
const $=id=>document.getElementById(id),NAMES=['LUCAS','QUENTIN','THEO'];
let registry=null,session=null,person='QUENTIN',task=null,result=null,batch={items:[],mallette:''},pending=null,taskMeta=null,handoff=null,submitted=false,nonce='',busy=false,loading=false;
const status=s=>$('status').textContent=s;
const valid=s=>typeof s==='string'&&s.length>0&&s.length<=255&&!/[|\r\n\0]/.test(s);
function base(value){const u=new URL(value);if(u.protocol!=='https:'||!u.hostname.endsWith('.workers.dev')||u.username||u.password)throw Error('Utilisez l’adresse HTTPS workers.dev du relais.');return u.origin}
function store(key,value){try{localStorage.setItem(key,JSON.stringify(value));return true}catch{status('Stockage indisponible : gardez la page ouverte et conservez votre lien privé.');return false}}
function read(key){try{return JSON.parse(localStorage.getItem(key)||'null')}catch{return null}}
function validateRegistry(r){if(!r||!['pc','mobile'].includes(r.role)||!Array.isArray(r.stations)||r.stations.length>3)throw Error('Lien téléphone invalide.');r.url=base(r.url);const names=new Set();for(const s of r.stations){if(!NAMES.includes(s.person)||names.has(s.person)||!/^[-a-f0-9]{36}$/.test(s.id)||! /^[a-f0-9]{64}$/.test(s.token)||(r.role==='pc'&&!/^[a-f0-9]{64}$/.test(s.mobileToken)))throw Error('Profil invalide.');names.add(s.person)}return r}
function stateKey(){return 'inst-v7-state-'+registry.role+'-'+person}
function save(){if(!registry)return;store('inst-v7-registry-'+registry.role,registry);store('inst-v7-last-role',registry.role);store('inst-v7-person-'+registry.role,person);if(session)store(stateKey(),{id:session.id,token:session.token,task,result,batch,pending,taskMeta,submitted,handoff:registry.role==='pc'&&handoff?.person===person?handoff:null})}
function selectPerson(next){if(busy||loading||!$('scanner').hidden)return;$('feedbackPanel').hidden=true;save();person=next;session=null;task=null;result=null;batch={items:[],mallette:''};pending=null;taskMeta=null;submitted=false;const station=registry?.stations.find(s=>s.person===person);if(station){session={...station,url:registry.url,role:registry.role};const cached=read(stateKey());if(cached?.id===session.id&&cached.token===session.token){task=cached.task;result=cached.result;batch=cached.batch||batch;pending=cached.pending;taskMeta=cached.taskMeta;submitted=!!cached.submitted;if(!handoff&&cached.handoff)handoff=cached.handoff}}if(handoff&&person===handoff.person)$('cm').value=handoff.cm;else $('cm').value=task?.cm||'';save();render();status(session?'En attente d’une demande pour '+person:'Configurez ou renouvelez le profil '+person+'.');poll()}
async function call(url,options){const r=await fetch(url,{...options,cache:'no-store',signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok){const e=Error(data.error||'Erreur du relais');e.status=r.status;throw e}return data}
async function api(path,body){if(!session)throw Error('Profil non connecté.');return call(session.url+'/rooms/'+session.id+'/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+session.token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})}
function phoneLink(){const u=new URL('telephone.html?v=9',location.href);u.hash=new URLSearchParams({relay:registry.url,stations:JSON.stringify(registry.stations.map(s=>({person:s.person,id:s.id,token:registry.role==='pc'?s.mobileToken:s.token})))});return u.href}
function listInto(id,items){const list=$(id);list.replaceChildren();for(const code of items){const row=document.createElement('div');row.className='item';const icon=document.createElement('span');icon.textContent='✓';const strong=document.createElement('strong');strong.textContent=code;row.append(icon,strong);list.append(row)}}
function render(){const mobile=registry?.role==='mobile';$('setup').hidden=!!session||mobile;$('pc').hidden=!session||mobile;$('task').hidden=!session||!mobile||!task;$('output').hidden=!session||mobile||!result;$('link').hidden=!registry||registry.stations.length===0;$('disconnect').hidden=!registry;$('revoke').hidden=!session||mobile;$('identity').textContent=session?person+' · '+(mobile?'Téléphone':'PC')+' · liaison permanente':'';$('soundPanel').hidden=!mobile;$('profiles').querySelector('h2').textContent=mobile?'Qui utilise ce téléphone ?':'Destinataire du scan';document.querySelectorAll('[data-name]').forEach(b=>{b.classList.toggle('active',b.dataset.name===person);b.disabled=busy||loading||!$('scanner').hidden});$('connect').disabled=busy;$('send').disabled=busy||loading||!handoff;$('finish').disabled=busy||loading;$('scan').disabled=busy||submitted;$('case').disabled=busy||submitted;if(task)$('taskTitle').textContent='Véhicule '+task.cm;$('batch').textContent=batch.items.length+' matériel(s) · Mallette : '+(batch.mallette||'aucune');listInto('mobileItems',batch.items);$('cm').readOnly=!!handoff&&handoff.person===person;$('contextNote').textContent=handoff?'Fiche n° '+handoff.planning+' · destinée à '+handoff.person:'Ouvrez la liaison depuis le global pour recevoir sa référence de fiche.';renderForms();if(result){listInto('pcItems',result.items);$('resultCase').textContent='Véhicule '+result.cm+' · '+result.person+' · Mallette : '+(result.mallette||'aucune');try{$('import').href=RetourCore.importURL($('appLink').value,result,taskMeta);$('import').setAttribute('aria-disabled','false');$('importNote').textContent='Ouvrez le lot et confirmez dans Power Apps.'}catch(e){$('import').href='#';$('import').setAttribute('aria-disabled','true');$('importNote').textContent=e.message}}}
async function armPhoneSound(test=true){if(registry?.role!=='mobile')return;const r=await PhoneAlerts.enable(test);$('soundNote').textContent=r.message;$('sound').textContent=r.ok?'Tester le bip':'Activer le son';}
$('sound').onclick=()=>armPhoneSound(true);
$('names').onclick=e=>{const name=e.target.dataset.name;if(NAMES.includes(name)){if(registry?.role==='mobile')armPhoneSound(false);selectPerson(name)}};
$('connect').onclick=async()=>{if(busy||loading)return;busy=true;render();try{const url=base($('url').value.trim()),key=$('access').value;if(key.length<32)throw Error('Renseignez votre ACCESS_KEY (32 caractères minimum).');const stations=[];for(const name of NAMES){const r=await call(url+'/rooms',{method:'POST',headers:{'Content-Type':'application/json','X-Access-Key':key},body:JSON.stringify({person:name})});if(r.permanent!==true)throw Error('Mettez d’abord le relais Cloudflare à jour avec le Worker V7.');stations.push({person:r.person,id:r.id,token:r.pcToken,mobileToken:r.mobileToken})}registry=validateRegistry({role:'pc',url,stations});$('access').value='';status('Trois profils configurés. Copiez le lien permanent sur les téléphones.')}catch(e){status(e.message)}finally{busy=false;if(registry)selectPerson(person);else render()}};
$('link').onclick=async()=>{try{const link=phoneLink();try{await navigator.clipboard.writeText(link);status('Lien permanent copié. Gardez-le en favori privé sur le téléphone.')}catch{$('linkText').hidden=false;$('linkText').value=link;status('Copiez le lien permanent affiché.')}}catch(e){status(e.message)}};
let autoAttempted=false;
function archiveResult(value){if(value&&!store('inst-v9-last-relay-'+person,value))throw Error('Sauvegarde locale indisponible : liaison conservée.');}
async function sendTask(){
 if(busy||loading||!session||session.role!=='pc')return;
 busy=true;render();
 try{
  if(!handoff||handoff.person!==person||! /^[a-f0-9-]{36}$/.test(handoff.jeton))throw Error('Ouvrez la fiche depuis le global V9.');
  if(handoff.feedback){await api('feedback',{id:handoff.jeton,message:handoff.feedback});status('Anomalie transmise au téléphone. Revenez dans Power Apps pour relancer le scan.');return;}
  // A new request is an explicit handoff. Retain the previous transport result before releasing its slot.
  if(result&&result.id!==handoff.jeton){archiveResult(result);await api('ack',{id:result.id});result=null;task=null;pending=null;}
  if(task&&task.id!==handoff.jeton){throw Error('Une autre demande est encore en cours pour '+person+'. Terminez-la, ou libérez-la avec le bouton ci-dessous après annulation sur le PC.');}
  const cm=handoff.cm;
  pending={id:handoff.jeton,cm};taskMeta={...handoff,id:handoff.jeton};save();
  const r=await api('task',pending);task=r.task;pending=null;save();
  status('Demande envoyée à '+person+'. Revenez dans Power Apps : la fiche reste ouverte et recevra le lot après l’envoi Forms.');
 }catch(e){status(e.message);save()}finally{busy=false;render()}
}
$('send').onclick=sendTask;

async function poll(){if(!session||loading||busy||document.hidden)return;loading=true;const identity=session.token;try{const r=await api('status');$('feedbackPanel').hidden=!(session.role==='mobile'&&r.feedback);$('feedbackText').textContent=r.feedback?.message||'';if(identity!==session?.token)return;if(session.role==='pc'){task=r.task;result=r.result;if(result){pending=null;status('Lot préparé pour Forms. Sa réception SharePoint et le montage sont à vérifier dans Power Apps.')}else status(task?(r.mobileOnline?'Téléphone connecté · demande en cours.':'Demande conservée · sélectionnez '+person+' sur le téléphone.'):(r.mobileOnline?'Téléphone prêt pour '+person+'.':'En attente du téléphone sélectionné sur '+person+'.'))}else{if(r.task&&r.task.id!==task?.id){task=r.task;batch={items:[],mallette:''};submitted=false}if(!r.task){task=null;batch={items:[],mallette:''};PhoneAlerts.forget(person)}submitted=!!r.received;if(task&&!submitted){PhoneAlerts.arrival(person,task.id);if(!PhoneAlerts.running())$('soundNote').textContent='Alerte visuelle active · touchez Activer le son pour le bip.';}status(!task?'En attente d’une demande pour '+person:submitted?'Lot conservé. Si nécessaire, rouvrez Forms ci-dessous puis appuyez sur Envoyer.':'Demande reçue pour '+task.cm+'. Vous pouvez scanner.')}save()}catch(e){if([403,410].includes(e.status))status('Ce lien pour '+person+' a été révoqué ou remplacé. Les scans locaux restent conservés. Demandez un nouveau lien au PC.');else status(e.message+' · Scans locaux conservés.')}finally{loading=false;render();if(session?.role==='pc'&&handoff&&handoff.person===person&&!autoAttempted&&!location.pathname.endsWith('/acces-scanner.html')){autoAttempted=true;sendTask()}}}
function scan(mode){if(!task||busy||submitted)return;nonce=crypto.randomUUID();const u=new URL('scan-mobile.html',location.href);u.search=new URLSearchParams({mode,cm:task.cm,items:batch.items.join('|'),mallette:batch.mallette,nonce,scanSessionId:task.id,scanRequest:task.id});$('scanner').src=u.href;$('scanner').hidden=false;render()}
$('scan').onclick=()=>scan('materiel');$('case').onclick=()=>scan('mallette');
window.addEventListener('message',e=>{const d=e.data;if(e.origin!==location.origin||e.source!==$('scanner').contentWindow||!task||!d||d.type!=='instrumentation-mobile-batch'||d.nonce!==nonce||d.request!==task.id||d.cm!==task.cm)return;if(!Array.isArray(d.items)||d.items.length>200||!d.items.every(valid)||typeof d.mallette!=='string'||d.mallette.length>255||/[|\r\n\0]/.test(d.mallette)){status('Lot invalide.');return}batch={items:[...new Set(d.items)],mallette:d.mallette};$('scanner').hidden=true;$('scanner').src='about:blank';save();render()});
function formsKey(){return 'inst-v9-forms-'+person}
function renderForms(){
 const saved=read(formsKey());const show=registry?.role==='mobile'&&saved;
 $('formsRecovery').hidden=!show;
 if(show){$('formsSummary').textContent=saved.payload.cm+' · '+saved.payload.items.length+' matériel(s). Ouvrir Forms ne prouve pas l’envoi : appuyez sur Envoyer dans le formulaire, puis vérifiez la réception sur le PC.';}
}
$('finish').onclick=async()=>{
 if(!task||busy||loading)return;
 busy=true;render();
 try{
  const data=FormsCore.payload(task,batch),url=FormsCore.url(data);
  const saved={payload:data,url,createdAt:Date.now()};
  if(!store(formsKey(),saved))throw Error('Impossible de conserver le lot sur ce téléphone. Ne quittez pas la page.');
  // Transport backup only; this never means Forms has been submitted or the montage committed.
  await api('result',{id:task.id,cm:task.cm,...batch});submitted=true;save();
  location.assign(url);
 }catch(e){status(e.message+' · Les scans restent sur ce téléphone.')}finally{busy=false;render();renderForms()}
};
$('reopenForms').onclick=()=>{try{const saved=read(formsKey());if(!saved)throw Error('Aucun lot conservé.');location.assign(FormsCore.url(saved.payload))}catch(e){status(e.message)}};
$('archiveForms').onclick=()=>{
 const saved=read(formsKey());if(!saved)return;
 if(!confirm('Le PC a-t-il bien reçu ce lot ? Le lot sera gardé en sauvegarde locale, et ce téléphone restera en attente de la prochaine demande.'))return;
 const history=read('inst-v9-history-'+person)||[];
 if(!store('inst-v9-history-'+person,[saved,...history.filter(x=>x.payload.request!==saved.payload.request)].slice(0,20)))return;
 try{localStorage.removeItem(formsKey())}catch{};renderForms();status('En attente de la prochaine demande pour '+person+'. La confirmation du montage se fait sur le PC.');
};
$('release').onclick=async()=>{
 if(!session||session.role!=='pc'||busy||loading||!task)return;
 if(!confirm('La demande a-t-elle été annulée ou terminée dans Power Apps ? Libérer la liaison ne modifie pas SharePoint.'))return;
 busy=true;
 try{archiveResult(result);await api('cancel',{id:task.id});task=null;result=null;pending=null;save();status('Liaison libérée. Vous pouvez réessayer l’envoi de la nouvelle fiche.')}catch(e){status(e.message)}finally{busy=false;render()}
};

$('import').onclick=e=>{if($('import').getAttribute('aria-disabled')==='true')e.preventDefault()};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify({...result,planning:taskMeta?.planning,jeton:taskMeta?.jeton}));status('Lot copié. Collez-le dans la fiche Power Apps restée ouverte, puis cliquez sur Charger le lot.')}catch{status('Copie impossible dans ce navigateur. Conservez cette page.')}};
$('ack').onclick=async()=>{if(!result||busy||loading)return;if(!confirm('Le montage est-il confirmé ou annulé dans Power Apps ? Ce bouton efface le lot du relais.'))return;busy=true;try{await api('ack',{id:result.id});result=null;task=null;pending=null;taskMeta=null;handoff=null;$('cm').value='';save();status('Prêt pour le véhicule suivant. Le lien téléphone reste valide.')}catch(e){status(e.message)}finally{busy=false;render()}};
$('disconnect').onclick=()=>{if(busy||loading)return;if(!confirm('Déconnecter cet appareil ? Les liens restent valides. Conservez les lots avant de continuer.'))return;save();registry=null;session=null;task=null;result=null;batch={items:[],mallette:''};$('linkText').hidden=true;render();status('Appareil déconnecté. Votre lien permanent reste utilisable.')};
$('revoke').onclick=async()=>{if(!session||session.role!=='pc'||busy||loading)return;if(!confirm('Révoquer '+person+' pour tous les téléphones ? Les anciennes clés de ce prénom cesseront de fonctionner, et son lot du relais sera supprimé. SharePoint reste inchangé.'))return;busy=true;try{await api('close',{});registry.stations=registry.stations.filter(s=>s.person!==person);try{localStorage.removeItem(stateKey())}catch{};store('inst-v7-registry-pc',registry);session=null;task=null;result=null;pending=null;taskMeta=null;batch={items:[],mallette:''};status('Profil '+person+' révoqué. Reconfigurez les trois prénoms avec ACCESS_KEY pour générer le nouveau lien.')}catch(e){status(e.message)}finally{busy=false;render()}};
try{const p=new URLSearchParams(location.hash.slice(1));if(p.has('stations')){registry=validateRegistry({role:'mobile',url:p.get('relay'),stations:JSON.parse(p.get('stations'))});person=read('inst-v7-person-mobile')||'QUENTIN'}else{if(p.has('planning')){handoff={cm:p.get('cm'),planning:p.get('planning'),jeton:p.get('jeton'),person:p.get('person'),feedback:p.get('feedback')||''};if(!NAMES.includes(handoff.person))throw Error('Destinataire invalide.');person=handoff.person;registry=read('inst-v7-registry-pc');history.replaceState(null,'',location.pathname+location.search)}else{const role=location.pathname.endsWith('/telephone.html')?'mobile':location.pathname.endsWith('/acces-scanner.html')?'pc':read('inst-v7-last-role')||'pc';registry=read('inst-v7-registry-'+role);person=read('inst-v7-person-'+role)||'QUENTIN'}if(registry)validateRegistry(registry)}$('appLink').value=read('inst-v7-app-link')||localStorage.getItem('instrumentation-global-link')||''}catch(e){registry=null;status(e.message)}
$('appLink').oninput=()=>{try{RetourCore.appURL($('appLink').value);store('inst-v7-app-link',$('appLink').value)}catch{};render()};
selectPerson(NAMES.includes(person)?person:'QUENTIN');setInterval(poll,5000);document.addEventListener('visibilitychange',()=>{if(!document.hidden)poll()});

if(location.pathname.endsWith('/acces-scanner.html')){document.body.classList.add('admin-page');document.querySelector('h1').textContent='Accès scanner';document.querySelector('header p').textContent='Configurer les téléphones, copier leur lien privé et révoquer un prénom.';}
if(location.pathname.endsWith('/telephone.html')){document.body.classList.add('phone-page');document.querySelector('h1').textContent='Votre atelier, en poche.';document.querySelector('header p').textContent='Choisissez votre prénom. Recevez une fiche, scannez et envoyez le lot au PC.';}

if(location.pathname.endsWith('/telephone.html')&&!registry){status('Ce téléphone n’est pas encore raccordé. Ouvrez une fois le lien privé généré par Accès scanner sur le PC, puis gardez cette page en favori.');$('profiles').querySelector('h2').textContent='Scanner téléphone';}
