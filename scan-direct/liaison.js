'use strict';
const $=id=>document.getElementById(id);let person='QUENTIN',peer=null,conn=null,task=null,batch={items:[],mallette:''},nonce='',sent=null,result=null,ready=false,attemptTimer=null;
const status=x=>$('status').textContent=x;
const random=()=>Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
const hash=async x=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(x))),x=>x.toString(16).padStart(2,'0')).join('');
const room=()=>$('room').value.trim();const role=()=>$('role').value;
function reset(){if(attemptTimer)clearTimeout(attemptTimer);attemptTimer=null;const old=peer;peer=null;conn=null;if(old)old.destroy();ready=false;$('send').disabled=true;$('link').hidden=true;status('Non connecté');}
$('role').onchange=()=>{if(task||sent){$('role').value=task?'mobile':'pc';status('Termine la demande avant de changer de mode.');return}reset();$('pc').hidden=role()!=='pc'};
$('names').onclick=e=>{const n=e.target.dataset.name;if(!n)return;if(task||sent){status('Termine la demande avant de changer de prénom.');return}reset();person=n;document.querySelectorAll('[data-name]').forEach(b=>b.classList.toggle('active',b.dataset.name===n));};
$('generate').onclick=()=>{if(task||sent)return;reset();$('room').value=random()};
$('room').onchange=()=>{if(!task&&!sent)reset()};
function cancelAttempt(message){if(attemptTimer)clearTimeout(attemptTimer);attemptTimer=null;if(role()==='pc')sent=null;$('send').disabled=!ready;status(message)}
async function target(){return 'inst-'+await hash(room()+':'+person)}
function bind(c,expected){c.on('error',e=>{if(conn!==c)return;cancelAttempt('Erreur de connexion : '+(e.type||'webrtc')+'.');});c.on('close',()=>{if(conn!==c)return;if(sent){cancelAttempt('Connexion fermée. Tu peux renvoyer la demande.');}else status('Connexion directe fermée. Les codes restent affichés sur le téléphone.');$('send').disabled=!ready;});c.on('data',data=>{
 if(!data||typeof data!=='object')return;
 if(role()==='mobile'&&data.type==='task'){
  if(task&&task.id!==data.id){c.send({type:'busy',id:data.id});return}
  if(typeof data.id!=='string'||typeof data.cm!=='string'||data.cm.length>80)return;
  task={id:data.id,cm:data.cm};conn=c;$('task').hidden=false;$('taskTitle').textContent='Véhicule '+task.cm;status('Demande reçue. Appuie sur Scanner pour autoriser la caméra.');
 }else if(role()==='pc'&&data.type==='result'&&sent&&data.id===sent.id&&data.cm===sent.cm&&c.peer===expected){
  if(!Array.isArray(data.items)||data.items.length>1000||!data.items.every(x=>typeof x==='string'&&x.length<=255&&!/[|\r\n\0]/.test(x))||typeof data.mallette!=='string'||data.mallette.length>255)return;
  result={request:data.id,contreMarque:data.cm,operateur:person,mallette:data.mallette,materiels:[...new Set(data.items)]};$('result').textContent=JSON.stringify(result,null,2);$('output').hidden=false;c.send({type:'ack',id:data.id});status('Résultat reçu. Aucune écriture SharePoint effectuée.');sent=null;$('send').disabled=false;
 }else if(role()==='mobile'&&data.type==='ack'&&task&&data.id===task.id){task=null;batch={items:[],mallette:''};$('task').hidden=true;$('batch').textContent='';status('Le PC a confirmé la réception. Aucun enregistrement SharePoint automatique.');
 }else if(data.type==='busy'){sent=null;$('send').disabled=false;status('Ce téléphone traite déjà une autre demande.');}
 });}
$('connect').onclick=async()=>{
 if(task||sent){status('Demande en cours. Conserve cette page ouverte.');return}
 if(!/^[a-f0-9]{64}$/.test(room())){status('Crée un code sur le PC, puis copie-le sur le téléphone.');return}
 reset();if(typeof Peer==='undefined'){status('Bibliothèque de liaison indisponible. Vérifie l’accès Internet.');return}
 const dest=await target();peer=role()==='mobile'?new Peer(dest):new Peer();
 const active=peer;const signature=dest.slice(-12);$('signature').textContent='Prénom : '+person+' · Liaison : '+signature+' · Version 2';
 peer.on('error',e=>{if(peer!==active)return;const messages={'peer-unavailable':'Téléphone absent du service de liaison. Compare le prénom et les 12 caractères de liaison sur les deux écrans.','unavailable-id':'Ce prénom est déjà connecté avec ce code. Ferme l’autre page téléphone.','network':'Service de liaison inaccessible ou déconnecté.','server-error':'Service de liaison inaccessible.','webrtc':'La connexion WebRTC entre les appareils a échoué.'};if(e.type!=='peer-unavailable')ready=false;cancelAttempt(messages[e.type]||('Erreur : '+e.type));});
 peer.on('disconnected',()=>{if(peer!==active)return;ready=false;cancelAttempt('Déconnexion du service de liaison. Clique sur Connecter pour rétablir la session.');});
 peer.on('open',()=>{if(peer!==active)return;ready=true;status(role()==='mobile'?'En attente d’une demande pour '+person:'PC prêt. Connecte le téléphone avec le même code et le même prénom.');$('send').disabled=role()!=='pc';$('link').hidden=role()!=='pc'});
 peer.on('connection',c=>{if(peer!==active){c.close();return}status('Le PC est détecté. Ouverture de la connexion directe…');if(role()!=='mobile'||(conn&&conn.open&&conn.peer!==c.peer)){c.close();return}conn=c;bind(c,null)});
};
$('send').onclick=async()=>{
 const cm=$('cm').value.trim().toUpperCase();if(!cm){status('Renseigne la contre-marque.');return}if(!ready)return;
 const dest=await target();sent={type:'task',id:crypto.randomUUID(),cm};$('send').disabled=true;status('Connexion au téléphone…');conn=peer.connect(dest,{reliable:true});bind(conn,dest);
 const current=conn;attemptTimer=setTimeout(()=>{if(conn!==current||!sent||current.open)return;cancelAttempt('Connexion directe non établie après 30 secondes. Si le téléphone affiche « Le PC est détecté », le blocage concerne la connexion entre appareils ; sinon compare les signatures de liaison.');conn=null;current.close();},30000);
 conn.on('open',()=>{if(conn!==current||!sent){current.close();return}if(attemptTimer)clearTimeout(attemptTimer);attemptTimer=null;current.send(sent);status('Connexion établie. Demande envoyée ; en attente des scans…')});
};
function scan(mode){if(!task)return;nonce=crypto.randomUUID();const u=new URL('scan-mobile.html',location.href);u.search=new URLSearchParams({mode,cm:task.cm,mallette:batch.mallette,items:batch.items.join('|'),nonce,scanSessionId:nonce,scanRequest:task.id});$('scanner').src=u.href;$('scanner').hidden=false}
$('scan').onclick=()=>scan('materiel');$('case').onclick=()=>scan('mallette');
window.addEventListener('message',e=>{const d=e.data;if(e.origin!==location.origin||e.source!==$('scanner').contentWindow||!task||!d||d.type!=='instrumentation-mobile-batch'||d.nonce!==nonce||d.request!==task.id||d.cm!==task.cm)return;if(!Array.isArray(d.items)||d.items.length>1000||!d.items.every(x=>typeof x==='string'&&x.length<=255&&!/[|\r\n\0]/.test(x))||typeof d.mallette!=='string'||d.mallette.length>255)return;batch={items:[...new Set(d.items)],mallette:d.mallette};$('scanner').hidden=true;$('scanner').src='about:blank';$('batch').textContent=batch.items.length+' matériel(s) · Mallette : '+(batch.mallette||'aucune');});
$('finish').onclick=()=>{if(!task||!conn||!conn.open){status('PC déconnecté. Le lot est conservé dans cette page.');return}if(!batch.items.length&&!batch.mallette){status('Scanne au moins un matériel ou une mallette.');return}conn.send({type:'result',id:task.id,cm:task.cm,...batch});status('Résultat envoyé. En attente de confirmation du PC ; conserve cette page ouverte.')};
$('copy').onclick=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(result));status('Résultat copié. Il reste à l’enregistrer dans le global.')}catch{status('Copie indisponible : sélectionne le résultat affiché.')}};
$('link').onclick=async()=>{const u=new URL(location.href);u.hash=new URLSearchParams({room:room(),person,role:'mobile'});try{await navigator.clipboard.writeText(u.href);status('Lien privé copié. Ouvre-le sur le téléphone ; ne le publie pas.')}catch{status('Copie indisponible. Copie le code sur le téléphone manuellement.')}};
const params=new URLSearchParams(location.hash.slice(1));if(/^[a-f0-9]{64}$/.test(params.get('room')||''))$('room').value=params.get('room');if(['LUCAS','QUENTIN','THEO'].includes(params.get('person'))){person=params.get('person');document.querySelectorAll('[data-name]').forEach(b=>b.classList.toggle('active',b.dataset.name===person))}if(params.get('role')==='mobile'){$('role').value='mobile';$('pc').hidden=true}history.replaceState(null,'',location.pathname+location.search);
window.addEventListener('beforeunload',e=>{if(task||sent){e.preventDefault();e.returnValue=''}});
