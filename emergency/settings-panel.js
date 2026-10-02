(function(){
  const rootId='emergencySettingsPanel';
  const tabMeta={
    overview:['Overview','Emergency configuration and operational readiness'],
    types:['Incident Types','Control the Incident Type dropdown and default severity'],
    templates:['Message Templates','Customize emergency message templates'],
    groups:['Contact / WhatsApp Groups','Configure groups and membership'],
    contacts:['Emergency Contacts','Maintain people available for emergency notification'],
    channels:['Notification Channels','Review notification channel readiness'],
    system:['System Settings','Manage emergency defaults and safety controls'],
    smtp:['SMTP Email','Configure secure email delivery settings'],
    audit:['Audit Log','Review configuration and emergency activity changes']
  };
  let state={types:[],templates:[],groups:[],contacts:[],members:[],settings:[],audit:[],smtp:{},profile:{}};
  let loadPromise=null, saveInFlight=new Map(), actionInFlight=new Map(), activeTab='overview';

  const q=(id)=>document.getElementById(id);
  const esc2=(v)=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

  async function sApi(action,method='GET',body=null){
    const r=await fetch(window.SECUREOPS_CONFIG.SUPABASE_URL+'/functions/v1/emergency-api?action='+encodeURIComponent(action),{
      method,
      headers:{apikey:window.SECUREOPS_CONFIG.SUPABASE_PUBLISHABLE_KEY,Authorization:'Bearer '+session.access_token,'Content-Type':'application/json'},
      body:body?JSON.stringify(body):undefined
    });
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw Error(j.error||'Request failed');
    return j;
  }

  function setting(k,d){const x=state.settings.find(x=>x.setting_key===k);return x?x.setting_value:d}
  function superAdmin(){return state.profile?.role==='SUPERADMIN'}
  function memberCount(id){return state.members.filter(x=>x.group_id===id).length}

  async function load(){
    if(loadPromise)return loadPromise;
    loadPromise=(async()=>{
      const r=await sApi('settings_bootstrap');
      state={...r,settings:r.settings||[],types:r.types||[],templates:r.templates||[],groups:r.groups||[],contacts:r.contacts||[],members:r.members||[],audit:r.audit||[],smtp:r.smtp||{},profile:r.profile||{}};
      render();
    })();
    try{return await loadPromise}finally{loadPromise=null}
  }

  async function save(resource,data){
    const key=resource+':'+String(data.id||data.group_id||'new');
    if(saveInFlight.has(key))return saveInFlight.get(key);
    const work=(async()=>{
      const r=await sApi('settings_mutation','POST',{resource,op:data.id?'update':'create',data});
      await load();
      return r;
    })();
    saveInFlight.set(key,work);
    try{return await work}finally{saveInFlight.delete(key)}
  }

  async function saveSetting(k,v){return sApi('settings_mutation','POST',{resource:'setting',op:'update',data:{setting_key:k,setting_value:v}})}

  function render(){
    const panel=q(rootId); if(!panel)return;
    panel.innerHTML='<div class="es-toolbar"><div><div class="es-kicker">EMERGENCY SETTINGS</div><h2>'+esc2(tabMeta[activeTab][0])+'</h2><p>'+esc2(tabMeta[activeTab][1])+'</p></div><div class="es-role">'+esc2(state.profile?.role||'—')+'</div></div><div class="es-tabs">'+Object.keys(tabMeta).map(k=>'<button type="button" class="'+(k===activeTab?'active':'')+'" data-estab="'+k+'">'+esc2(tabMeta[k][0])+'</button>').join('')+'</div><div id="esContent"></div>';
    const content=q('esContent');
    if(activeTab==='overview')renderOverview(content);
    if(activeTab==='types')renderTypes(content);
    if(activeTab==='templates')renderTemplates(content);
    if(activeTab==='groups')renderGroups(content);
    if(activeTab==='contacts')renderContacts(content);
    if(activeTab==='channels')renderChannels(content);
    if(activeTab==='system')renderSystem(content);
    if(activeTab==='smtp')renderSmtp(content);
    if(activeTab==='audit')renderAudit(content);
  }

  function panel(title,desc,body,action=''){
    return '<section class="es-card"><div class="es-head"><div><h3>'+esc2(title)+'</h3><p>'+esc2(desc||'')+'</p></div>'+action+'</div><div class="es-body">'+body+'</div></section>';
  }

  function renderOverview(el){
    const activeTypes=state.types.filter(x=>x.active).length;
    const activeContacts=state.contacts.filter(x=>x.active).length;
    const activeGroups=state.groups.filter(x=>x.active).length;
    const wa=state.groups.some(x=>x.active&&x.whatsapp_group_url);
    const smtp=!!state.smtp.configured;
    el.innerHTML='<div class="es-metrics"><div><b>'+activeTypes+'</b><span>ACTIVE TYPES</span></div><div><b>'+state.templates.filter(x=>x.active).length+'</b><span>ACTIVE TEMPLATES</span></div><div><b>'+activeGroups+'</b><span>ACTIVE GROUPS</span></div><div><b>'+activeContacts+'</b><span>ACTIVE CONTACTS</span></div></div>'+
      panel('Configuration Status','Current emergency configuration at a glance','<div class="es-status-grid"><div><b>WhatsApp</b><span class="badge '+(wa?'ok':'warn')+'">'+(wa?'CONFIGURED':'NOT CONFIGURED')+'</span></div><div><b>SMTP</b><span class="badge '+(smtp?'ok':'warn')+'">'+(smtp?'CONFIGURED':'NOT CONFIGURED')+'</span></div><div><b>Production</b><span class="badge '+(setting('production_enabled',true)!==false?'ok':'off')+'">'+(setting('production_enabled',true)!==false?'ENABLED':'DISABLED')+'</span></div><div><b>Recipient Selection</b><span class="badge '+(setting('require_recipient_selection',true)!==false?'ok':'warn')+'">'+(setting('require_recipient_selection',true)!==false?'REQUIRED':'OPTIONAL')+'</span></div></div>')+
      panel('Emergency Defaults','Values used when creating a new incident','<div class="es-defaults"><div><small>Default Type</small><b>'+esc2(setting('default_incident_type_code','—'))+'</b></div><div><small>Default Severity</small><b>'+esc2(setting('default_severity','URGENT'))+'</b></div><div><small>Default Location</small><b>'+esc2(setting('default_location','—'))+'</b></div><div><small>Auto Refresh</small><b>'+esc2(setting('auto_refresh_seconds',30))+' sec</b></div></div>');
  }

  function renderTypes(el){
    el.innerHTML=panel('Incident Types','Control the Incident Type dropdown and default severity','<div class="es-table"><table><thead><tr><th>Code</th><th>Name</th><th>Severity</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>'+(state.types.map(x=>'<tr><td><b>'+esc2(x.code)+'</b></td><td>'+esc2(x.name)+'<small>'+esc2(x.description||'')+'</small></td><td>'+esc2(x.default_severity||'URGENT')+'</td><td>'+esc2(x.priority)+'</td><td><span class="badge '+(x.active?'ok':'off')+'">'+(x.active?'ACTIVE':'INACTIVE')+'</span></td><td><button class="es-btn" data-es-action="edit-type" data-id="'+esc2(x.id)+'">Edit</button></td></tr>').join('')||'<tr><td colspan="6">No incident types configured.</td></tr>')+'</tbody></table></div>','<button class="es-btn primary" data-es-action="add-type">+ Add Type</button>');
  }

  function renderTemplates(el){
    el.innerHTML=panel('Message Templates','Customize titles and emergency messages used by the Template dropdown','<div class="es-table"><table><thead><tr><th>Code</th><th>Name</th><th>Incident Type</th><th>Severity</th><th>Status</th><th></th></tr></thead><tbody>'+(state.templates.map(x=>'<tr><td><b>'+esc2(x.code)+'</b></td><td>'+esc2(x.name)+'</td><td>'+esc2(x.incident_type_code||'Any')+'</td><td>'+esc2(x.severity)+'</td><td><span class="badge '+(x.active?'ok':'off')+'">'+(x.active?'ACTIVE':'INACTIVE')+'</span></td><td><button class="es-btn" data-es-action="edit-template" data-id="'+esc2(x.id)+'">Edit</button></td></tr>').join('')||'<tr><td colspan="6">No templates configured.</td></tr>')+'</tbody></table></div>','<button class="es-btn primary" data-es-action="add-template">+ Add Template</button>');
  }

  function renderGroups(el){
    el.innerHTML=panel('Contact / WhatsApp Groups','Configure group names, WhatsApp URLs and membership','<div class="es-table"><table><thead><tr><th>Code</th><th>Group</th><th>WhatsApp</th><th>Members</th><th>Status</th><th></th></tr></thead><tbody>'+(state.groups.map(x=>'<tr><td><b>'+esc2(x.code)+'</b></td><td>'+esc2(x.name)+'<small>'+esc2(x.description||'')+'</small></td><td><span class="badge '+(x.whatsapp_group_url?'ok':'warn')+'">'+(x.whatsapp_group_url?'CONFIGURED':'NOT CONFIGURED')+'</span></td><td>'+memberCount(x.id)+'</td><td><span class="badge '+(x.active?'ok':'off')+'">'+(x.active?'ACTIVE':'INACTIVE')+'</span></td><td><button class="es-btn" data-es-action="edit-group" data-id="'+esc2(x.id)+'">Edit</button> <button class="es-btn" data-es-action="members" data-id="'+esc2(x.id)+'">Members</button></td></tr>').join('')||'<tr><td colspan="6">No groups configured.</td></tr>')+'</tbody></table></div>','<button class="es-btn primary" data-es-action="add-group">+ Add Group</button>');
  }

  function renderContacts(el){
    el.innerHTML=panel('Emergency Contacts','Maintain people available for emergency notification','<div class="es-table"><table><thead><tr><th>Name</th><th>Department / Position</th><th>Email</th><th>WhatsApp</th><th>Priority</th><th>Status</th><th></th></tr></thead><tbody>'+(state.contacts.map(x=>'<tr><td><b>'+esc2(x.full_name)+'</b></td><td>'+esc2(x.department||'-')+'<small>'+esc2(x.position||'-')+'</small></td><td>'+esc2(x.email||'-')+'</td><td>'+esc2(x.whatsapp_number||'-')+'</td><td>'+esc2(x.priority)+'</td><td><span class="badge '+(x.active?'ok':'off')+'">'+(x.active?'ACTIVE':'INACTIVE')+'</span></td><td><button class="es-btn" data-es-action="edit-contact" data-id="'+esc2(x.id)+'">Edit</button></td></tr>').join('')||'<tr><td colspan="7">No emergency contacts configured.</td></tr>')+'</tbody></table></div>','<button class="es-btn primary" data-es-action="add-contact">+ Add Contact</button>');
  }

  function renderChannels(el){
    const wa=state.groups.some(x=>x.active&&x.whatsapp_group_url),smtp=!!state.smtp.configured;
    el.innerHTML=panel('Notification Channels','Operational readiness of configured notification channels','<div class="es-table"><table><thead><tr><th>Channel</th><th>Status</th><th>Source</th><th>Notes</th></tr></thead><tbody><tr><td><b>EMAIL</b></td><td><span class="badge '+(smtp?'ok':'warn')+'">'+(smtp?'CONFIGURED':'NOT CONFIGURED')+'</span></td><td>Supabase Edge Function</td><td>SMTP password protected server-side</td></tr><tr><td><b>WHATSAPP</b></td><td><span class="badge '+(wa?'ok':'warn')+'">'+(wa?'CONFIGURED':'NOT CONFIGURED')+'</span></td><td>Emergency Contact Groups</td><td>Manual dispatch via configured group URL</td></tr><tr><td><b>SMS</b></td><td><span class="badge off">NOT CONFIGURED</span></td><td>Provider</td><td>Provider is not configured</td></tr><tr><td><b>PUSH</b></td><td><span class="badge off">NOT CONFIGURED</span></td><td>Provider</td><td>Provider is not configured</td></tr></tbody></table></div>');
  }

  function renderSystem(el){
    const active=state.types.filter(x=>x.active);
    el.innerHTML=panel('System Settings','Defaults and safety controls for Emergency Operations','<div class="es-form-grid"><label>Default Severity<select id="es_default_severity"><option>URGENT</option><option>HIGH</option><option>NORMAL</option><option>INFORMATION</option></select></label><label>Default Incident Type<select id="es_default_type">'+active.map(x=>'<option value="'+esc2(x.code)+'">'+esc2(x.name)+'</option>').join('')+'</select></label><label>Default Location<input id="es_default_location"></label><label>Timezone<input id="es_timezone"></label><label>Incident ID Prefix<input id="es_prefix"></label><label>Auto Refresh (seconds)<input id="es_refresh" type="number" min="5"></label><label class="es-check"><input id="es_production" type="checkbox"> Production Emergency enabled</label><label class="es-check"><input id="es_confirm" type="checkbox"> Require production confirmation</label><label class="es-check"><input id="es_recipient" type="checkbox"> Require recipient selection</label></div><div class="es-actions"><button class="es-btn primary" data-es-action="save-system">Save System Settings</button></div><div id="esSystemNotice" class="es-notice"></div>');
    q('es_default_severity').value=setting('default_severity','URGENT');q('es_default_type').value=setting('default_incident_type_code',active[0]?.code||'');q('es_default_location').value=setting('default_location','Ground Floor');q('es_timezone').value=setting('timezone','Asia/Jakarta');q('es_prefix').value=setting('incident_id_prefix','HIKJ-INC');q('es_refresh').value=setting('auto_refresh_seconds',30);q('es_production').checked=setting('production_enabled',true)!==false;q('es_confirm').checked=setting('require_production_confirmation',true)!==false;q('es_recipient').checked=setting('require_recipient_selection',true)!==false;
  }

  function renderSmtp(el){
    el.innerHTML=panel('SMTP Email','SMTP metadata and delivery readiness. Credentials remain protected server-side.','<div class="es-form-grid"><label>SMTP Host<input id="es_smtp_host"></label><label>SMTP Port<input id="es_smtp_port" type="number"></label><label>Security<select id="es_smtp_secure"><option value="true">SSL</option><option value="false">TLS / STARTTLS</option></select></label><label>SMTP Username<input id="es_smtp_user" type="email"></label><label>SMTP App Password<input id="es_smtp_pass" type="password" autocomplete="new-password" placeholder="Leave blank to keep current"></label><label>From Email<input id="es_smtp_from" type="email"></label><label>From Name<input id="es_smtp_name"></label><label>Reply-To<input id="es_smtp_reply" type="email"></label></div><div class="es-actions"><button class="es-btn primary" data-es-action="save-smtp">Save SMTP Settings</button><button class="es-btn" data-es-action="test-smtp">Send Test Email</button></div><div class="es-notice" id="esSmtpNotice"></div>');
    q('es_smtp_host').value=state.smtp.host||'smtp.gmail.com';q('es_smtp_port').value=state.smtp.port||465;q('es_smtp_secure').value=String(!!state.smtp.secure||!state.smtp.port);q('es_smtp_user').value=state.smtp.username||'';q('es_smtp_pass').value='';q('es_smtp_from').value=state.smtp.from||'';q('es_smtp_name').value=state.smtp.from_name||'SECUREOPS Emergency Response';q('es_smtp_reply').value=state.smtp.reply_to||'';
  }

  function renderAudit(el){
    el.innerHTML=panel('Audit Log','Configuration and emergency activity changes. Secrets are never logged','<div class="es-table"><table><thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Target</th><th>Description</th></tr></thead><tbody>'+(state.audit.map(x=>'<tr><td>'+new Date(x.created_at).toLocaleString('en-GB')+'</td><td>'+esc2(x.user_name||'-')+'</td><td>'+esc2(x.action)+'</td><td>'+esc2(x.target||'-')+'</td><td>'+esc2(x.description||'-')+'</td></tr>').join('')||'<tr><td colspan="5">No audit entries.</td></tr>')+'</tbody></table></div>');
  }

  function openEditor(title,html,onSubmit){
    let modal=q('esEditor');
    if(!modal){modal=document.createElement('div');modal.id='esEditor';modal.className='es-modal';modal.innerHTML='<div class="es-modalbox"><div class="es-modalhead"><h3 id="esEditorTitle"></h3><button type="button" class="es-btn" id="esEditorClose">Close</button></div><div id="esEditorBody"></div><div id="esEditorNotice" class="es-notice"></div></div>';document.body.appendChild(modal);q('esEditorClose').onclick=()=>modal.classList.remove('open');modal.addEventListener('click',e=>{if(e.target===modal)modal.classList.remove('open')})}
    q('esEditorTitle').textContent=title;q('esEditorBody').innerHTML=html;q('esEditorNotice').textContent='';modal.classList.add('open');q('esEditorBody').querySelector('input,select,textarea')?.focus();
    q('esEditorForm')?.remove();
    const form=q('esEditorBody').querySelector('form');
    if(form)form.onsubmit=async e=>{e.preventDefault();const notice=q('esEditorNotice');notice.textContent='Saving...';try{await onSubmit();modal.classList.remove('open');await load();SecureOpsUI.success('Saved','Emergency settings were updated successfully.')}catch(err){notice.classList.add('err');notice.textContent=err.message||String(err);SecureOpsUI.error('Save Failed',err.message||String(err))}};
  }

  function openType(id){
    const x=state.types.find(x=>x.id===id)||{code:'',name:'',description:'',default_severity:'URGENT',priority:100,active:true};
    openEditor(id?'Edit Incident Type':'Add Incident Type','<form><div class="es-form-grid"><label>Code<input id="f_code" value="'+esc2(x.code)+'" required></label><label>Name<input id="f_name" value="'+esc2(x.name)+'" required></label><label>Default Severity<select id="f_sev"><option>URGENT</option><option>HIGH</option><option>NORMAL</option><option>INFORMATION</option></select></label><label>Priority<input id="f_priority" type="number" value="'+esc2(x.priority??100)+'"></label><label class="full">Description<textarea id="f_desc">'+esc2(x.description||'')+'</textarea></label><label class="es-check"><input id="f_active" type="checkbox" '+(x.active!==false?'checked':'')+'> Active</label></div><div class="es-actions"><button class="es-btn primary" type="submit">Save</button></div></form>',()=>save('incident_type',{id,code:q('f_code').value.trim(),name:q('f_name').value.trim(),description:q('f_desc').value,default_severity:q('f_sev').value,priority:Number(q('f_priority').value||100),active:q('f_active').checked}));
    q('f_sev').value=x.default_severity||'URGENT';
  }

  function openTemplate(id){
    const x=state.templates.find(x=>x.id===id)||{code:'',name:'',incident_type_code:'',severity:'URGENT',title_template:'',message_template:'',active:true};
    openEditor(id?'Edit Message Template':'Add Message Template','<form><div class="es-form-grid"><label>Code<input id="f_code" value="'+esc2(x.code)+'" required></label><label>Name<input id="f_name" value="'+esc2(x.name)+'" required></label><label>Incident Type<select id="f_type"><option value="">Any</option>'+state.types.map(t=>'<option value="'+esc2(t.code)+'">'+esc2(t.name)+'</option>').join('')+'</select></label><label>Severity<select id="f_sev"><option>URGENT</option><option>HIGH</option><option>NORMAL</option><option>INFORMATION</option></select></label><label class="full">Title Template<input id="f_title" value="'+esc2(x.title_template)+'" required></label><label class="full">Message Template<textarea id="f_msg" required>'+esc2(x.message_template)+'</textarea><small>Variables: {{title}} {{location}} {{time}} {{incident_id}} {{severity}} {{incident_type}} {{description}}</small></label><label class="es-check"><input id="f_active" type="checkbox" '+(x.active!==false?'checked':'')+'> Active</label></div><div class="es-actions"><button class="es-btn primary" type="submit">Save</button></div></form>',()=>save('template',{id,code:q('f_code').value.trim(),name:q('f_name').value.trim(),incident_type_code:q('f_type').value||null,severity:q('f_sev').value,title_template:q('f_title').value,message_template:q('f_msg').value,active:q('f_active').checked}));
    q('f_type').value=x.incident_type_code||'';q('f_sev').value=x.severity||'URGENT';
  }

  function openGroup(id){
    const x=state.groups.find(x=>x.id===id)||{code:'',name:'',description:'',whatsapp_group_url:'',active:true};
    openEditor(id?'Edit Group':'Add Group','<form><div class="es-form-grid"><label>Code<input id="f_code" value="'+esc2(x.code)+'" required></label><label>Name<input id="f_name" value="'+esc2(x.name)+'" required></label><label class="full">Description<textarea id="f_desc">'+esc2(x.description||'')+'</textarea></label><label class="full">WhatsApp Group URL<input id="f_wa" value="'+esc2(x.whatsapp_group_url||'')+'"></label><label class="es-check"><input id="f_active" type="checkbox" '+(x.active!==false?'checked':'')+'> Active</label></div><div class="es-actions"><button class="es-btn primary" type="submit">Save</button></div></form>',()=>save('group',{id,code:q('f_code').value.trim(),name:q('f_name').value.trim(),description:q('f_desc').value,whatsapp_group_url:q('f_wa').value.trim()||null,active:q('f_active').checked}));
  }

  function openMembers(id){
    const g=state.groups.find(x=>x.id===id);if(!g)return;
    const selected=new Set(state.members.filter(x=>x.group_id===id).map(x=>x.contact_id));
    openEditor('Manage Members · '+g.name,'<form><div class="es-table"><table><thead><tr><th></th><th>Name</th><th>Department</th><th>Channels</th></tr></thead><tbody>'+state.contacts.map(c=>'<tr><td><input type="checkbox" value="'+esc2(c.id)+'" '+(selected.has(c.id)?'checked':'')+'></td><td>'+esc2(c.full_name)+'</td><td>'+esc2(c.department||'-')+'</td><td>'+esc2(c.email||'-')+'<br>'+esc2(c.whatsapp_number||c.phone_number||'-')+'</td></tr>').join('')+'</tbody></table></div><div class="es-actions"><button class="es-btn primary" type="submit">Save Members</button></div></form>',()=>save('members',{group_id:id,contact_ids:[...q('esEditorBody').querySelectorAll('input[type=checkbox]:checked')].map(x=>x.value)}));
  }

  function openContact(id){
    const x=state.contacts.find(x=>x.id===id)||{full_name:'',position:'',department:'',phone_number:'',email:'',whatsapp_number:'',priority:100,active:true};
    openEditor(id?'Edit Emergency Contact':'Add Emergency Contact','<form><div class="es-form-grid"><label>Full Name<input id="f_name" value="'+esc2(x.full_name)+'" required></label><label>Position<input id="f_position" value="'+esc2(x.position||'')+'"></label><label>Department<input id="f_department" value="'+esc2(x.department||'')+'"></label><label>Priority<input id="f_priority" type="number" value="'+esc2(x.priority??100)+'"></label><label>Email<input id="f_email" type="email" value="'+esc2(x.email||'')+'"></label><label>WhatsApp Number<input id="f_wa" value="'+esc2(x.whatsapp_number||'')+'"></label><label>Phone Number<input id="f_phone" value="'+esc2(x.phone_number||'')+'"></label><label class="es-check"><input id="f_active" type="checkbox" '+(x.active!==false?'checked':'')+'> Active</label></div><div class="es-actions"><button class="es-btn primary" type="submit">Save</button></div></form>',()=>save('contact',{id,full_name:q('f_name').value.trim(),position:q('f_position').value,department:q('f_department').value,priority:Number(q('f_priority').value||100),email:q('f_email').value,whatsapp_number:q('f_wa').value,phone_number:q('f_phone').value,active:q('f_active').checked}));
  }

  async function saveSystem(){
    if(actionInFlight.has('system'))return actionInFlight.get('system');
    const work=(async()=>{
      const values={default_severity:q('es_default_severity').value,default_incident_type_code:q('es_default_type').value,default_location:q('es_default_location').value,timezone:q('es_timezone').value,incident_id_prefix:q('es_prefix').value,auto_refresh_seconds:Math.max(5,Number(q('es_refresh').value||30)),production_enabled:q('es_production').checked,require_production_confirmation:q('es_confirm').checked,require_recipient_selection:q('es_recipient').checked};
      for(const [k,v] of Object.entries(values))await saveSetting(k,v);
      await load();SecureOpsUI.success('System Settings Saved','Emergency system settings were updated successfully.');
    })();
    actionInFlight.set('system',work);try{return await work}finally{actionInFlight.delete('system')}
  }

  async function saveSmtp(){
    if(!superAdmin()){SecureOpsUI.error('Access Denied','SMTP settings require SUPERADMIN.');return}
    if(actionInFlight.has('smtp'))return actionInFlight.get('smtp');
    const work=(async()=>{
      const host=q('es_smtp_host').value.trim();let port=Number(q('es_smtp_port').value||465);let secure=q('es_smtp_secure').value==='true';const username=q('es_smtp_user').value.trim();const password=q('es_smtp_pass').value.trim();
      if(host.toLowerCase()==='smtp.gmail.com'&&port===587){port=465;secure=true}
      if(!username)throw Error('SMTP Username is required');
      for(const [k,v] of Object.entries({smtp_host:host,smtp_port:port,smtp_secure:secure,smtp_from:q('es_smtp_from').value.trim(),smtp_from_name:q('es_smtp_name').value.trim(),smtp_reply_to:q('es_smtp_reply').value.trim()}))await saveSetting(k,v);
      await sApi('settings_mutation','POST',{resource:'smtp_secret',op:'update',data:{name:'hikj_emergency_smtp_username',value:username}});
      if(password)await sApi('settings_mutation','POST',{resource:'smtp_secret',op:'update',data:{name:'hikj_emergency_smtp_password',value:password}});
      await load();SecureOpsUI.success('SMTP Settings Saved','SMTP settings were updated successfully.');
    })();
    actionInFlight.set('smtp',work);try{return await work}finally{actionInFlight.delete('smtp')}
  }

  async function testSmtp(){
    if(!superAdmin()){SecureOpsUI.error('Access Denied','SMTP test requires SUPERADMIN.');return}
    if(actionInFlight.has('smtp-test'))return actionInFlight.get('smtp-test');
    const work=(async()=>{const r=await sApi('smtp_test','POST',{});SecureOpsUI.success('SMTP Test Successful','Test email sent successfully to '+r.recipient+'.')})();
    actionInFlight.set('smtp-test',work);try{return await work}finally{actionInFlight.delete('smtp-test')}
  }

  document.addEventListener('click',async e=>{
    const tab=e.target.closest('[data-estab]');if(tab){activeTab=tab.dataset.estab;render();return}
    const btn=e.target.closest('[data-es-action]');if(!btn)return;
    const a=btn.dataset.esAction,id=btn.dataset.id;
    try{
      if(a==='add-type')openType();else if(a==='edit-type')openType(id);else if(a==='add-template')openTemplate();else if(a==='edit-template')openTemplate(id);else if(a==='add-group')openGroup();else if(a==='edit-group')openGroup(id);else if(a==='members')openMembers(id);else if(a==='add-contact')openContact();else if(a==='edit-contact')openContact(id);else if(a==='save-system')await saveSystem();else if(a==='save-smtp')await saveSmtp();else if(a==='test-smtp')await testSmtp();
    }catch(err){console.error('Emergency settings action failed:',err);SecureOpsUI.error('Emergency Settings Failed',err.message||String(err))}
  });

  window.SECUREOPS_EMERGENCY_SETTINGS={
    async init(){await load()},
    show(tab){activeTab=tabMeta[tab]?tab:'overview';render()},
    refresh:load
  };
})();