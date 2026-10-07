import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const APP_VERSION='ks.v.001';
const APP_TITLE='SECUREOPS | Security Operations';
const ALLOWED_ORIGINS=new Set(['https://kngslhdn.github.io','https://visitor.myhikj.com','http://visitor.myhikj.com','http://localhost:3000','http://127.0.0.1:5500']);
function corsHeaders(req:Request){
 const origin=req.headers.get('origin')||'';
 return {'Access-Control-Allow-Origin':ALLOWED_ORIGINS.has(origin)?origin:'https://kngslhdn.github.io','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type, idempotency-key','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Expose-Headers':'X-SECUREOPS-Version, X-SECUREOPS-Title','Access-Control-Max-Age':'86400','Vary':'Origin','X-SECUREOPS-Version':APP_VERSION,'X-SECUREOPS-Title':APP_TITLE};
}
const supabase=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
const HIKJ_PROPERTY_ID='9ca8c398-c376-4d7a-8b74-91a8ffb771e7';
const propertySelect=(table:string,columns:string)=>supabase.from(table).select(columns).eq('property_id',HIKJ_PROPERTY_ID);

async function outstandingKey(key:string){
 const {data,error}=await propertySelect('key_borrowings','id,borrower_name,quantity').eq('key_number',key).order('borrowed_at',{ascending:false}).limit(20);
 if(error)throw error;
 for(const b of data||[]){
   const r=await propertySelect('key_returns','quantity').eq('borrowing_id',b.id);
   if(r.error)throw r.error;
   const returned=(r.data||[]).reduce((n:any,x:any)=>n+Number(x.quantity||0),0);
   const outstanding=Math.max(Number(b.quantity||0)-returned,0);
   if(outstanding>0)return {borrowing_id:b.id,borrower_name:b.borrower_name,borrowed_quantity:Number(b.quantity||0),returned_quantity:returned,outstanding_quantity:outstanding,key_number:key};
 }
 return null;
}
const json=(body:unknown,status=200,req?:Request)=>new Response(JSON.stringify(body),{status,headers:{...corsHeaders(req||new Request('https://secureops.local')),'Content-Type':'application/json'}});
const clean=(v:unknown)=>String(v??'').trim().replace(/[<>]/g,'');
const phone=(v:unknown)=>clean(v).replace(/[^0-9+]/g,'').replace(/^0+/,'');
const normText=(v:unknown)=>clean(v).toLowerCase().replace(/\s+/g,' ');
const types:Record<string,string>={entry:'visitor_entry',masuk:'visitor_entry',exit:'visitor_exit',keluar:'visitor_exit',borrowing:'key_borrowing',pinjamKunci:'key_borrowing',return:'key_return',kembaliKunci:'key_return',package:'package_registration',paket:'package_registration',key_asset_lookup:'key_asset_lookup'};
const val=(b:any,...keys:string[])=>keys.map(k=>b[k]).find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')??'';
const required=(v:unknown,label:string,max=200)=>{const s=clean(v);if(!s)throw new Error(label+' is required.');if(s.length>max)throw new Error(label+' is too long.');return s};
const validPhone=(v:unknown)=>{const p=phone(v);const digits=p.replace(/\D/g,'');if(!p||!/^[0-9+]{8,16}$/.test(p)||digits.length<8||digits.length>15)throw new Error('A valid phone number is required.');return p};
const enumValue=(v:unknown,allowed:string[],label:string)=>{const s=clean(v).toUpperCase();const match=allowed.find(x=>x.toUpperCase()===s);if(!match)throw new Error(label+' has an invalid value.');return match};

// Durable, cross-instance rate limiting backed by Postgres.
const RATE_LIMIT_MAX=60;
const RATE_LIMIT_WINDOW_SECONDS=60;
function clientKey(req:Request){
 const forwarded=req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'';
 return (forwarded.split(',')[0]||'unknown').trim().slice(0,100);
}
async function rateLimit(req:Request){
 const {data,error}=await supabase.rpc('consume_public_rate_limit',{p_key:`visitor-submit:${clientKey(req)}`,p_limit:RATE_LIMIT_MAX,p_window_seconds:RATE_LIMIT_WINDOW_SECONDS});
 if(error)throw error;
 const row=Array.isArray(data)?data[0]:data;
 return {allowed:Boolean(row?.allowed),retryAfter:Number(row?.retry_after||1)};
}

function timestamp(_v:unknown){
 return new Date().toISOString();
}

async function visitorIdentity(name:string,mobile:string,company:string,category:string|null){
 const normalized=phone(mobile),nameKey=normText(name),companyKey=normText(company),categoryKey=normText(category);
 if(normalized){const {data,error}=await propertySelect('visitors','id,full_name,company_name,category').eq('phone_normalized',normalized).limit(50);if(error)throw error;const match=(data||[]).find(v=>normText(v.full_name)===nameKey&&normText(v.company_name)===companyKey&&normText(v.category)===categoryKey);if(match)return match.id;}
 else{const {data,error}=await propertySelect('visitors','id,full_name,company_name,category').limit(200);if(error)throw error;const match=(data||[]).find(v=>normText(v.full_name)===nameKey&&normText(v.company_name)===companyKey&&normText(v.category)===categoryKey);if(match)return match.id;}
 const {data,error}=await supabase.from('visitors').insert({property_id:HIKJ_PROPERTY_ID,full_name:name,phone:mobile||null,phone_normalized:normalized||null,company_name:company||null,category:category||null}).select('id').single();if(error)throw error;return data.id;
}

async function findExitEntry(pass:string){
 const passKey=normText(pass);
 const {data,error}=await propertySelect('visitor_entries','id,visitor_id,visitor_name,visitor_name_snapshot,pass_vest_number,entry_at').is('exit_id',null).order('entry_at',{ascending:false}).limit(5000);
 if(error)throw error;
 return (data||[]).find(e=>passKey&&normText(e.pass_vest_number)===passKey)||null;
}

async function publicSettings(){
 const {data,error}=await propertySelect('app_settings','setting_key,setting_value,active').in('setting_key',['whatsapp','whatsapp_recipients','operations']);
 if(error)throw error;
 const out=Object.fromEntries((data||[]).map((x:any)=>[x.setting_key,x.setting_value]));
 // The existing production schema uses whatsapp_recipients; normalize it to the public whatsapp shape.
 if(!out.whatsapp){
   const legacy=Array.isArray(out.whatsapp_recipients)?out.whatsapp_recipients[0]:out.whatsapp_recipients;
   if(legacy)out.whatsapp={recipient_name:legacy.name||'HIKJ Security',phone_number:legacy.phone||''};
 }
 return out;
}

async function uploadPackagePhoto(dataUrl:string){
 if(!dataUrl||!dataUrl.startsWith('data:image/'))return null;const match=dataUrl.match(/^data:(image\/(?:jpeg|png|webp));base64,(.+)$/);if(!match)return null;const bytes=Uint8Array.from(atob(match[2]),c=>c.charCodeAt(0));if(bytes.length>5*1024*1024)throw Error('Package photo exceeds 5 MB');const ext=match[1].split('/')[1].replace('jpeg','jpg');const path=`HIKJ/${new Date().toISOString().slice(0,10)}/${crypto.randomUUID()}.${ext}`;const {error}=await supabase.storage.from('package-photos').upload(path,bytes,{contentType:match[1],upsert:false});if(error)throw error;return path;
}

Deno.serve(async req=>{
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers:corsHeaders(req)});
 if(req.method==='GET'){
   const {data,error}=await supabase.from('properties').select('property_code,property_name,logo_url,primary_color,secondary_color').eq('id',HIKJ_PROPERTY_ID).eq('is_active',true).maybeSingle();
   if(error)return json({error:'Unable to load property branding'},500,req);
   return json({ok:true,branding:data||null},200,req);
 }
 if(req.method!=='POST')return json({error:'Method not allowed'},405,req);const limit=await rateLimit(req);if(!limit.allowed)return new Response(JSON.stringify({error:'Too many requests. Please wait and try again.'}),{status:429,headers:{...corsHeaders(req),'Content-Type':'application/json','Retry-After':String(limit.retryAfter)}});
 try{
  const contentLength=Number(req.headers.get('content-length')||0);if(contentLength>8*1024*1024)return json({error:'Request payload is too large.'},413,req);
  const body=await req.json();const rawType=clean(body.type||body.form_type),type=types[rawType]||rawType;if(!['visitor_entry','visitor_exit','key_borrowing','key_return','package_registration','key_asset_lookup'].includes(type))return json({error:'Invalid submission type'},400,req);const settings=await publicSettings();const ops=settings.operations||{};const enabledByType:Record<string,string>={visitor_entry:'visitor_entry_enabled',visitor_exit:'visitor_exit_enabled',key_borrowing:'key_borrowing_enabled',key_return:'key_return_enabled',package_registration:'package_registration_enabled'};if(enabledByType[type]&&ops[enabledByType[type]]===false)return json({error:'This service is currently disabled by Security Administration.'},403,req);
  if(type==='key_asset_lookup'){
   const key=clean(body.key_number||body.keyNumber);
   if(!key)return json({error:'Please enter Key Number.'},400,req);
   const {data,error}=await propertySelect('key_assets','key_number,key_description,quantity,active').eq('key_number',key).maybeSingle();
   if(error)throw error;
   if(!data)return json({ok:false,error:`Key Number ${key} was not found in Key Assets.`},404);
   if(!data.active)return json({ok:false,error:`Key Number ${key} is inactive.`},409);
   return json({ok:true,key_asset:{key_number:data.key_number,description:data.key_description||'',quantity:Number(data.quantity||0)}});
  }
  const idem=clean(req.headers.get('idempotency-key')||body.idempotency_key);if(idem){const {data}=await propertySelect('submissions','submission_id').eq('idempotency_key',idem).maybeSingle();if(data)return json({ok:true,duplicate:true,submission_id:data.submission_id},200,req);}
  let visitorId:string|null=null;let matchedExitEntry:any=null;
  if(type==='visitor_entry'){
   const visitorName=required(val(body,'name','visitor_name','nama'),'Name',120);
   const visitorPhone=validPhone(val(body,'phone','mobile_phone','telepon'));
   const visitorCompany=required(val(body,'company_name','company','perusahaan'),'Company / Vendor Name',160);
   const category=enumValue(val(body,'category','kategori'),['Contractor','Supplier','Visitor','Part-time'],'Category');
   const location=required(val(body,'work_location','lokasi'),'Work Location',160);
   const purpose=required(val(body,'purpose','tujuan'),'Purpose',500);
   const pass=required(val(body,'pass_vest_number','pass'),'Pass / Vest Number',80);
   const officer=required(val(body,'security_officer_name','security'),'Security Officer Name',120);
   visitorId=await visitorIdentity(visitorName,visitorPhone,visitorCompany,category);
   body.__validated={visitorName,visitorPhone,visitorCompany,category,location,purpose,pass,officer};
  }else if(type==='visitor_exit'){
   const pass=clean(val(body,'pass_vest_number','pass')),officer=clean(val(body,'security_officer_name','security'));
   if(!pass||!officer)return json({error:'Pass / Vest Number and Security Officer Name are required.'},400);
   matchedExitEntry=await findExitEntry(pass);
   if(!matchedExitEntry)return json({ok:false,error:'Visitor not found: Pass / Vest Number does not match any visitor currently inside the hotel.'},404);
   visitorId=matchedExitEntry.visitor_id;
  }

  let returnBorrowing:any=null;
  if(type==='key_return'){
   const key=required(body.key_number||body.keyNumber,'Key Number',80);
   const quantity=Number(body.quantity||body.qty);
   if(!Number.isInteger(quantity)||quantity<1||quantity>1000)return json({error:'Quantity of Keys must be a whole number between 1 and 1000.'},400);
   const {data,error}=await Promise.resolve({data:await outstandingKey(key),error:null});
   if(error)throw error;
   returnBorrowing=data||null;
   if(!returnBorrowing)return json({ok:false,error:`Key ${key} is not currently outstanding. Return rejected.`},409);
   if(quantity>Number(returnBorrowing.outstanding_quantity))return json({ok:false,error:`Return quantity (${quantity}) exceeds outstanding quantity (${returnBorrowing.outstanding_quantity}) for Key ${key}.`,outstanding_quantity:returnBorrowing.outstanding_quantity},409);
  }

  if(type==='key_borrowing'){
   const key=required(body.key_number||body.keyNumber,'Key Number',80);
   const {data:keyAsset,error:keyAssetError}=await propertySelect('key_assets','key_number,key_description,quantity,active').eq('key_number',key).maybeSingle();
   if(keyAssetError)throw keyAssetError;
   if(!keyAsset)return json({ok:false,error:`Key Number ${key} was not found in Key Assets.`},404);
   if(!keyAsset.active)return json({ok:false,error:`Key Number ${key} is inactive.`},409);
   const quantity=Number(keyAsset.quantity);
   if(!Number.isInteger(quantity)||quantity<1)return json({ok:false,error:`Key Number ${key} has an invalid quantity configured in Key Assets.`},409);
   const {data,error}=await Promise.resolve({data:await outstandingKey(key),error:null});
   if(error)throw error;
   if(data)return json({ok:false,error:`Key ${key} is currently outstanding to ${data.borrower_name} with ${data.outstanding_quantity} key(s) outstanding. Please return the outstanding key(s) before a new borrowing.`},409);
  }

  const {data:submission,error:se}=await supabase.from('submissions').insert({property_id:HIKJ_PROPERTY_ID,submission_id:null,submission_type:type,visitor_id:visitorId,status:'submitted',idempotency_key:idem||null,metadata:{source_form:rawType}}).select('id,submission_id').single();if(se)throw se;
  let keyReturnResult:any=null;
  if(type==='visitor_entry'){
   const validated=body.__validated||{};const {error}=await supabase.from('visitor_entries').insert({property_id:HIKJ_PROPERTY_ID,submission_id:submission.id,visitor_id:visitorId,visitor_name:validated.visitorName,visitor_phone:validated.visitorPhone||null,visitor_company_name:validated.visitorCompany||null,visitor_category:validated.category,visitor_name_snapshot:validated.visitorName,phone_snapshot:validated.visitorPhone||null,company_name_snapshot:validated.visitorCompany||null,category_snapshot:validated.category,work_location:validated.location,purpose:validated.purpose,security_officer_name:validated.officer,pass_vest_number:validated.pass,entry_at:timestamp(body.entry_at||body.datetime)});if(error)throw error;
  }else if(type==='visitor_exit'){
   const pass=clean(val(body,'pass_vest_number','pass'));const entry=matchedExitEntry;const exitName=clean(entry?.visitor_name||entry?.visitor_name_snapshot||'');
   const {data:ex,error}=await supabase.from('visitor_exits').insert({property_id:HIKJ_PROPERTY_ID,submission_id:submission.id,visitor_id:visitorId,entry_id:entry.id,visitor_name:exitName,pass_vest_number:pass,security_officer_name:clean(val(body,'security_officer_name','security')),exit_at:new Date().toISOString()}).select('id').single();if(error)throw error;if(entry.id)await supabase.from('visitor_entries').update({exit_id:ex.id}).eq('id',entry.id);
  }else if(type==='key_borrowing'){
   const key=clean(body.key_number||body.keyNumber);
   if(!key)return json({error:'Please enter Key Number.'},400);
   const {data:keyAsset,error:keyAssetError}=await propertySelect('key_assets','key_number,key_description,quantity,active').eq('key_number',key).maybeSingle();
   if(keyAssetError)throw keyAssetError;
   if(!keyAsset)return json({ok:false,error:`Key Number ${key} was not found in Key Assets.`},404);
   if(!keyAsset.active)return json({ok:false,error:`Key Number ${key} is inactive.`},409);
   const quantity=Number(keyAsset.quantity);
   if(!Number.isInteger(quantity)||quantity<1)return json({ok:false,error:`Key Number ${key} has an invalid quantity configured in Key Assets.`},409);
   const {data,error}=await Promise.resolve({data:await outstandingKey(key),error:null});
   if(error)throw error;
   if(data)return json({ok:false,error:`Key ${key} is currently outstanding to ${data.borrower_name} with ${data.outstanding_quantity} key(s) outstanding. Please return the outstanding key(s) before a new borrowing.`},409);
   const borrowerName=required(val(body,'borrower_name','borrowerName'),'Borrower Name',120);
   const department=required(body.department,'Department',120);
   const description=required(keyAsset.key_description||'','Key Description',300);
   const officer=required(val(body,'security_officer_name','security'),'Issued By Security Officer',120);
   const borrowedAt=timestamp(body.borrowed_at||body.datetime);
   const expectedReturnAt=new Date(new Date(borrowedAt).getTime()+24*60*60*1000).toISOString();
   const borrowingPayload={property_id:HIKJ_PROPERTY_ID,submission_id:submission.id,borrower_name:borrowerName,department,key_number:key,key_description:description,quantity,security_officer_name:officer,borrowed_at:borrowedAt,expected_return_at:expectedReturnAt} as Record<string,unknown>;
   const {error:ie}=await supabase.from('key_borrowings').insert(borrowingPayload);
   if(ie)throw ie;
  }else if(type==='key_return'){
   const quantity=Number(body.quantity||body.qty||1),borrowing=returnBorrowing,returnedBy=clean(val(body,'return_name','returnName','returned_by','returnedBy')),officer=clean(val(body,'security_officer_name','security')),department=clean(body.department)||borrowing.department;
   if(!returnedBy||!officer)return json({error:'Returned By and Received By Security are required.'},400);
   const originalBorrowed=Number(borrowing.borrowed_quantity),previouslyReturned=Number(borrowing.returned_quantity),newTotal=previouslyReturned+quantity;
   const discrepancy=false;
   const {error}=await supabase.from('key_returns').insert({property_id:HIKJ_PROPERTY_ID,submission_id:submission.id,borrowing_id:borrowing.borrowing_id,return_name:returnedBy,returned_by:returnedBy,department,key_number:borrowing.key_number,quantity,borrowed_quantity:originalBorrowed,discrepancy_qty:discrepancy,security_officer_name:officer,returned_at:timestamp(body.returned_at||body.datetime)});
   if(error)throw error;
   keyReturnResult={key_number:borrowing.key_number,original_borrowed_quantity:originalBorrowed,previously_returned_quantity:previouslyReturned,returned_now:quantity,total_returned:newTotal,outstanding_quantity:originalBorrowed-newTotal,discrepancy,new_status:newTotal===originalBorrowed?'CLOSED':'PARTIALLY RETURNED'};

  }else{
   const courierName=required(val(body,'courier_name','namaPengantar'),'Courier Name',120);
   const packagePhone=validPhone(val(body,'phone','mobile_phone','telepon'));
   const expeditionCompany=required(val(body,'company_name','company','perusahaan'),'Expedition Company',160);
   const itemType=enumValue(val(body,'item_type','jenisBarang'),['LETTER','PACKAGE'],'Item Type');
   const itemCount=Number(body.item_count||body.number_of_items||body.jumlah);
   if(!Number.isInteger(itemCount)||itemCount<1||itemCount>1000)return json({error:'Number of Items must be a whole number between 1 and 1000.'},400);
   const recipientType=enumValue(val(body,'recipient_type','tujuan'),['STAFF','GUEST'],'Recipient Type');
   const recipientName=required(val(body,'recipient_name','namaTujuan'),'Recipient Name',160);
   const securityOfficer=required(val(body,'security_officer_name','security'),'Security Officer Name',120);
   const photoData=clean(body.foto||body.photo_data_url);
   if(!photoData)throw new Error('Item Photo is required.');
   const path=await uploadPackagePhoto(photoData);
   if(!path)throw new Error('Item Photo must be a JPEG, PNG, or WebP image.');
   const {error}=await supabase.from('package_registrations').insert({property_id:HIKJ_PROPERTY_ID,submission_id:submission.id,courier_name:courierName,phone:packagePhone,phone_normalized:phone(packagePhone),company_name:expeditionCompany,item_type:itemType,item_count:itemCount,recipient_type:recipientType,recipient_name:recipientName,security_officer_name:securityOfficer,photo_storage_path:path});if(error)throw error;
  }
  await supabase.from('submissions').update({status:'completed'}).eq('id',submission.id);return json({ok:true,submission_id:submission.submission_id,whatsapp_number:settings.whatsapp?.phone_number||null,...(keyReturnResult?{key_return:keyReturnResult}:{})},200,req);
 }catch(e){
  console.error('visitor-submit error',e);
  const raw=String(e?.message||'');
  let message='Submission failed. Please try again.';
  if(/Bucket not found|NoSuchBucket/i.test(raw)) message='Package photo storage is unavailable. Please try again later.';
  else if(/EntityTooLarge|too large|max.*size|exceed.*5 MB/i.test(raw)) message='Package photo is too large. Please use a smaller photo.';
  else if(/InvalidMimeType/i.test(raw)) message='Package photo format is not supported. Please use JPEG, PNG, or WebP.';
  else if(/duplicate|23505|already exists|unique constraint/i.test(raw)) message='This submission already exists or was already processed. Please wait and try again.';
  else if(/foreign key|23503/i.test(raw)) message='A related record could not be found. Please refresh and try again.';
  else if(/payload/i.test(raw)) message='The submitted file or request is too large.';
  return json({error:message},500,req);
 }
});
