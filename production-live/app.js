PP.view="schedule";PP.list="customer";PP.toast=t=>{let e=document.querySelector("#toast");e.textContent=t;e.hidden=false;setTimeout(()=>e.hidden=true,2400)};PP.authMsg=(t,c="")=>{let e=document.querySelector("#authMsg");e.textContent=t;e.className="msg "+c;e.hidden=false};PP.authUI=()=>{let s=PP.authMode==="signup";document.querySelector("#authTitle").textContent=s?"Create account":"Sign in";document.querySelector("#authSubmit").textContent=s?"Create account":"Sign in";document.querySelector("#nameWrap").hidden=!s;document.querySelector("#authMode").textContent=s?"Already have an account? Sign in":"First time here? Create account";document.querySelector("#authMsg").hidden=true};PP.enter=async user=>{PP.user=user;PP.profile=await PP.fetchProfile();if(!PP.profile){PP.authMsg("Profile is still being created. Try again.","bad");return}if(!PP.profile.active){document.querySelector("#auth").innerHTML=`<div class="auth-card"><div class="logo"><b>P</b><span><strong>Precision</strong><small>Production</small></span></div><h1>Waiting for approval</h1><p>Your account exists but the owner has not activated it yet.</p><button class="btn" id="waitOut">Sign out</button></div>`;document.querySelector("#waitOut").onclick=PP.signout;return}await PP.loadState();document.querySelector("#auth").hidden=true;document.querySelector("#app").hidden=false;PP.subscribe();PP.render()};PP.boot=async()=>{document.querySelector("#authMode").onclick=()=>{PP.authMode=PP.authMode==="signin"?"signup":"signin";PP.authUI()};document.querySelector("#authForm").onsubmit=async e=>{e.preventDefault();let em=document.querySelector("#authEmail").value.trim(),pw=document.querySelector("#authPass").value,n=document.querySelector("#authName").value.trim();let btn=document.querySelector("#authSubmit");btn.disabled=true;btn.textContent="Working...";try{let r=PP.authMode==="signup"?await PP.signup(n,em,pw):await PP.signin(em,pw);if(r.error){PP.authMsg(r.error.message,"bad");return}if(PP.authMode==="signup"){if(r.data.session?.user){await PP.enter(r.data.user)}else{PP.authMode="signin";PP.authUI();PP.authMsg("Account created. Confirm your email if prompted, then sign in.")}}else if(r.data.session?.user){await PP.enter(r.data.user)}else{PP.authMsg("Login succeeded but no session was returned. Refresh and try again.","bad")}}catch(err){console.error(err);PP.authMsg(err?.message||"Could not load the production dashboard.","bad")}finally{btn.disabled=false;btn.textContent=PP.authMode==="signup"?"Create account":"Sign in"}};document.querySelector("#logout").onclick=PP.signout;document.querySelectorAll("#nav button").forEach(b=>b.onclick=()=>{PP.view=b.dataset.view;PP.render()});document.querySelector("#newJob").onclick=PP.openModal;document.querySelectorAll("[data-close]").forEach(x=>x.onclick=PP.closeModal);document.querySelector("#jobForm").onsubmit=PP.createJob;PP.STAGES.forEach(s=>document.querySelector("#stageSelect").add(new Option(s,s)));let{data:{session}}=await PP.sb.auth.getSession();if(session?.user){try{await PP.enter(session.user)}catch(err){console.error(err);PP.authMsg(err?.message||"Signed in, but the dashboard could not load.","bad")}}PP.sb.auth.onAuthStateChange(async(ev,s)=>{if(ev==="SIGNED_OUT")location.reload();else if(s?.user&&s.user.id!==PP.user?.id){try{await PP.enter(s.user)}catch(err){console.error(err);PP.authMsg(err?.message||"Signed in, but the dashboard could not load.","bad")}}})};PP.openModal=()=>{let f=document.querySelector("#jobForm");f.reset();f.orderDate.value=PP.today();document.querySelector("#modal").hidden=false};PP.closeModal=()=>document.querySelector("#modal").hidden=true;PP.createJob=e=>{e.preventDefault();let f=new FormData(e.target),cls=f.get("productionClass"),type=f.get("jobType");if(type==="Stock / Internal")cls="patv";let j={id:PP.uid(),invoice:String(f.get("invoice")).trim(),invoiceNumber:PP.invoiceNo(f.get("invoice")),productionClass:cls,customer:f.get("customer"),customerEmail:f.get("customerEmail")||"",customerPhone:f.get("customerPhone")||"",smsOptIn:f.get("smsOptIn")==="on",engine:f.get("engine"),vin:f.get("vin")||"",jobType:type,stage:f.get("stage"),assigned:"",plannedDate:f.get("plannedDate")||"",orderDate:f.get("orderDate"),blocked:false,blockerType:"",blockerNote:"",awaitingApproval:false,pendingNext:"",shopCopy:true,notes:f.get("notes")||"",updates:[],createdAt:new Date().toISOString(),stageEnteredAt:new Date().toISOString(),events:[{time:new Date().toISOString(),text:"Manufacturing order created",by:PP.profile.display_name}]};PP.state.jobs.push(j);PP.save();PP.closeModal();PP.render();PP.toast("Order added")};PP.openJob=id=>{
  let j=PP.state.jobs.find(x=>x.id===id);if(!j)return;
  let manager=["owner","manager"].includes(PP.profile.role);
  let sms=(PP.state.smsLog||[]).filter(x=>x.jobId===j.id).slice(-5).reverse();
  let updates=[...(j.updates||[])].reverse();
  document.querySelector("#drawerBody").innerHTML=`<button class="icon drawer-close" type="button" aria-label="Close job" title="Close" data-dclose>×</button>
  <p class="eyebrow">${PP.esc(j.invoice)}</p><h2>${PP.esc(j.customer)}</h2><div>${PP.badge(j)}</div>
  <div class="drawer-section"><div class="details">
    <div><small>Stage</small>${manager?`<select class="drawer-stage" data-stage-change>${PP.STAGES.map(s=>`<option value="${PP.esc(s)}" ${s===j.stage?"selected":""}>${PP.esc(s)}</option>`).join("")}</select>`:`<b>${PP.esc(j.stage)}</b>`}</div>
    <div><small>Type</small><b>${PP.esc(j.jobType)}</b></div>
    <div><small>Engine</small>${PP.esc(j.engine)}</div>
    <div><small>Order date</small>${PP.esc(j.orderDate||"—")}</div>
    <div><small>Planned</small>${PP.esc(j.plannedDate||"—")}</div>
    <div><small>Customer phone</small>${manager?`<input data-customer-phone type="tel" value="${PP.esc(j.customerPhone||"")}" placeholder="3466981155">`:`<b>${PP.esc(j.customerPhone||"—")}</b>`}</div>
  </div>
  ${manager?`<div style="margin-top:12px;display:flex;gap:10px;align-items:center;flex-wrap:wrap"><label style="display:flex;gap:8px;align-items:center"><input data-sms-optin type="checkbox" ${j.smsOptIn?"checked":""} style="width:auto"> SMS consent recorded</label><button class="btn" data-save-contact>Save contact</button></div>`:""}
  </div>
  ${j.blocked?`<div class="drawer-section"><h3>Blocker</h3><p>${PP.esc(j.blockerType)} — ${PP.esc(j.blockerNote)}</p></div>`:""}
  <div class="drawer-section"><h3>Actions</h3><div class="actions">
    ${!manager&&!j.blocked&&!j.awaitingApproval&&j.stage!=="Complete"?`<button class="btn primary" data-complete="${j.id}">Complete stage</button><button class="btn danger" data-block="${j.id}">Blocked</button>`:""}
    ${manager&&j.awaitingApproval?`<button class="btn primary" data-approve="${j.id}">Approve & advance</button>`:""}
    ${manager&&j.blocked?`<button class="btn" data-unblock="${j.id}">Resolve blocker</button>`:""}
    ${manager?`<button class="btn primary" data-sms="${j.id}">Text customer</button><button class="btn" data-email="${j.id}">Queue email update</button><button class="btn danger" data-delete-order="${j.id}">Delete order</button>`:""}
  </div></div>
  <div class="drawer-section"><h3>Text Messages</h3>${sms.length?sms.map(x=>`<p><b>${PP.esc(x.status)} · ${PP.esc(x.stage||"Manual")}</b><br><span>${PP.esc(x.body||"")}</span><br><span class="muted">${new Date(x.sentAt||x.createdAt).toLocaleString()}${x.error?" · "+PP.esc(x.error):""}</span></p>`).join(""):`<p class="muted">No texts sent for this job yet.</p>`}</div>
  <div class="drawer-section"><h3>Internal Updates</h3>
    <textarea data-internal-update rows="3" placeholder="Add an internal update, customer call note, parts status, machine-shop update, etc."></textarea>
    <div class="actions" style="margin-top:8px"><button class="btn primary" data-add-update>Add update</button></div>
    <div style="margin-top:12px">${updates.length?updates.map(u=>`<p><b>${PP.esc(u.text)}</b><br><span class="muted">${PP.esc(u.by||"Team")} · ${new Date(u.time).toLocaleString()}</span></p>`).join(""):`<p class="muted">No internal updates yet.</p>`}</div>
  </div>
  <div class="drawer-section"><h3>Original Notes</h3><p>${PP.esc(j.notes||"No original notes")}</p></div>
  <div class="drawer-section"><h3>History</h3>${[...(j.events||[])].reverse().map(e=>`<p><b>${PP.esc(e.text)}</b><br><span class="muted">${PP.esc(e.by)} · ${new Date(e.time).toLocaleString()}</span></p>`).join("")}</div>`;
  document.querySelector("#drawer").hidden=false;
  let close=()=>document.querySelector("#drawer").hidden=true;
  document.querySelector("[data-dclose]").onclick=close;
  document.onkeydown=e=>{if(e.key==="Escape"&&!document.querySelector("#drawer").hidden)close()};
  document.querySelector("[data-stage-change]")?.addEventListener("change",e=>{
    let old=j.stage,next=e.target.value;if(old===next)return;
    j.stage=next;j.stageEnteredAt=new Date().toISOString();j.awaitingApproval=false;j.pendingNext="";
    j.events=j.events||[];j.events.push({time:new Date().toISOString(),text:"Stage changed: "+old+" → "+next,by:PP.profile.display_name});
    PP.stageNotify(j,old,next);PP.save();PP.render();PP.openJob(j.id);PP.toast("Stage updated");
  });
  document.querySelector("[data-save-contact]")?.addEventListener("click",()=>PP.saveSmsContact(j));
  document.querySelector("[data-complete]")?.addEventListener("click",()=>PP.completeReq(j));
  document.querySelector("[data-block]")?.addEventListener("click",()=>PP.block(j));
  document.querySelector("[data-approve]")?.addEventListener("click",()=>PP.approve(j));
  document.querySelector("[data-unblock]")?.addEventListener("click",()=>PP.unblock(j));
  document.querySelector("[data-sms]")?.addEventListener("click",()=>PP.manualSms(j));
  document.querySelector("[data-email]")?.addEventListener("click",()=>PP.manualEmail(j));
  document.querySelector("[data-delete-order]")?.addEventListener("click",()=>PP.deleteOrder(j));
  document.querySelector("[data-add-update]")?.addEventListener("click",()=>PP.addInternalUpdate(j));
};PP.addInternalUpdate=j=>{
  let input=document.querySelector("[data-internal-update]");
  let text=String(input?.value||"").trim();
  if(!text){PP.toast("Enter an update first");input?.focus();return}
  if(text.length>2000){PP.toast("Update is too long");return}
  let now=new Date().toISOString();
  j.updates=j.updates||[];
  j.updates.push({id:PP.uid(),time:now,by:PP.profile.display_name,text});
  j.events=j.events||[];
  j.events.push({time:now,text:"Internal update added",by:PP.profile.display_name});
  PP.save();PP.openJob(j.id);PP.toast("Update added");
};PP.deleteOrder=j=>{if(!["owner","manager"].includes(PP.profile.role)){PP.toast("Manager access required");return}let inv=String(j.invoice||"").trim();if(!confirm("Delete order "+inv+" for "+j.customer+"? This removes it from active and completed production lists."))return;let typed=prompt("Type the invoice number exactly to confirm deletion:",inv);if(typed===null)return;if(String(typed).trim()!==inv){PP.toast("Invoice number did not match. Order was not deleted.");return}let now=new Date().toISOString();PP.state.deletedOrders=PP.state.deletedOrders||[];PP.state.deletedOrders.push({deletedAt:now,deletedBy:PP.profile.display_name,order:(typeof structuredClone==="function"?structuredClone(j):JSON.parse(JSON.stringify(j)))});PP.state.jobs=PP.state.jobs.filter(x=>x.id!==j.id);PP.state.emailOutbox=(PP.state.emailOutbox||[]).filter(x=>x.jobId!==j.id);PP.state.smsLog=(PP.state.smsLog||[]).filter(x=>x.jobId!==j.id);document.querySelector("#drawer").hidden=true;PP.save();PP.render();PP.toast("Order "+inv+" deleted")};PP.completeReq=j=>{j.awaitingApproval=true;j.pendingNext=PP.nextStage(j.stage);j.events.push({time:new Date().toISOString(),text:j.stage+" completed — waiting for manager approval",by:PP.profile.display_name});PP.save();document.querySelector("#drawer").hidden=true;PP.render()};PP.block=j=>{let n=prompt("Blocker: "+PP.BLOCKERS.join(" | "),PP.BLOCKERS[0]);if(!n)return;let note=prompt("What is needed to unblock it?","")||"";j.blocked=true;j.blockerType=n;j.blockerNote=note;j.events.push({time:new Date().toISOString(),text:"Blocked: "+n+(note?" — "+note:""),by:PP.profile.display_name});PP.save();document.querySelector("#drawer").hidden=true;PP.render()};PP.unblock=j=>{j.events.push({time:new Date().toISOString(),text:"Blocker resolved: "+j.blockerType,by:PP.profile.display_name});j.blocked=false;j.blockerType="";j.blockerNote="";PP.save();document.querySelector("#drawer").hidden=true;PP.render()};PP.stageEmail=j=>{if(j.productionClass!=="customer"||!PP.state.notificationSettings.stageAuto||!PP.state.notificationSettings.customerStages.includes(j.stage))return;let copy={"Engine Received":"We have received your engine/core and it is checked into production.","Inspection":"Your engine is in inspection and measurement.","Ready to Build":"Your engine is ready for assembly.","Assembly":"Your engine is in assembly.","Test Stand":"Your engine has moved to test stand/run-in.","Ready for Release":"Your engine is in final release for shipment, pickup, or installation.","Complete":"Your engine job is complete."}[j.stage]||("Your engine moved to "+j.stage);PP.queueEmail(j,"stage:"+j.stage,"Precision ATV Production Update — "+j.invoice,copy)};
PP.queueEmail=(j,key,sub,copy)=>{if(PP.state.emailOutbox.some(e=>e.jobId===j.id&&e.key===key))return;let sensitive=j.blocked&&PP.SENSITIVE.includes(j.blockerType);PP.state.emailOutbox.push({id:PP.uid(),jobId:j.id,key,subject:sub,body:`Hi ${j.customer.split(" ")[0]},

${copy}

Current stage: ${j.stage}
Invoice: ${j.invoice}
Engine: ${j.engine}

Precision ATV`,status:!j.customerEmail?"Needs Email":sensitive?"Needs Review":"Pending",createdAt:new Date().toISOString()})};
PP.smsBody=j=>{let first=String(j.customer||"Customer").trim().split(/\s+/)[0]||"Customer",copy=PP.SMS_COPY[j.stage]||("Your engine has moved to "+j.stage+".");return `Precision ATV: Hi ${first}, ${copy} Invoice ${j.invoice}. Reply STOP to opt out.`};
PP.saveSmsContact=j=>{let p=document.querySelector("[data-customer-phone]"),o=document.querySelector("[data-sms-optin]");let oldPhone=j.customerPhone||"",oldOpt=!!j.smsOptIn;j.customerPhone=String(p?.value||"").trim();j.smsOptIn=!!o?.checked;if(oldPhone!==j.customerPhone||oldOpt!==j.smsOptIn){j.events=j.events||[];j.events.push({time:new Date().toISOString(),text:"SMS contact settings updated",by:PP.profile.display_name})}PP.save();PP.openJob(j.id);PP.toast("Customer SMS settings saved")};
PP.sendSms=async(j,message,source="manual",key="manual:"+Date.now())=>{
  if(!j.customerPhone){PP.toast("Add the customer phone number first");return false}
  if(!j.smsOptIn){PP.toast("Record customer SMS consent before texting");return false}
  PP.state.smsLog=PP.state.smsLog||[];
  if(source==="auto"&&PP.state.smsLog.some(x=>x.jobId===j.id&&x.key===key&&x.status==="Sent"))return true;
  let log={id:PP.uid(),jobId:j.id,key,invoice:j.invoice,customer:j.customer,phone:j.customerPhone,stage:j.stage,body:message,source,status:"Sending",createdAt:new Date().toISOString()};
  PP.state.smsLog.push(log);PP.save();
  try{
    let r=await PP.twilioRequest("POST",{to:j.customerPhone,message,mode:"customer",consent:true});
    log.status="Sent";log.twilioStatus=r.status||"queued";log.sid=r.sid||"";log.sentAt=new Date().toISOString();
    j.events=j.events||[];j.events.push({time:log.sentAt,text:(source==="auto"?"Automatic":"Manual")+" SMS sent to customer",by:PP.profile.display_name});
    PP.save();PP.toast("Customer text sent");return true
  }catch(err){
    log.status="Failed";log.error=err?.message||"SMS failed";log.sentAt=new Date().toISOString();
    j.events=j.events||[];j.events.push({time:log.sentAt,text:"SMS failed: "+log.error,by:PP.profile.display_name});
    PP.save();PP.toast(log.error);return false
  }
};
PP.autoSms=async(j,oldStage,newStage)=>{
  let s=PP.state.notificationSettings||{};
  if(j.productionClass!=="customer"||!s.smsAuto||!(s.smsStages||[]).includes(newStage)||!j.customerPhone||!j.smsOptIn)return false;
  return PP.sendSms(j,PP.smsBody(j),"auto","stage:"+newStage)
};
PP.manualSms=async j=>{
  if(!j.customerPhone){PP.toast("Add the customer phone number first");return}
  if(!j.smsOptIn){PP.toast("Record customer SMS consent before texting");return}
  let draft=PP.smsBody(j),message=prompt("Text message to "+j.customer+":",draft);
  if(!message)return;
  await PP.sendSms(j,String(message).trim(),"manual","manual:"+Date.now());
  PP.openJob(j.id)
};
PP.stageNotify=(j,oldStage,newStage)=>{PP.stageEmail(j);PP.autoSms(j,oldStage,newStage)};
PP.approve=j=>{let old=j.stage;j.stage=j.pendingNext||PP.nextStage(old);j.pendingNext="";j.awaitingApproval=false;j.stageEnteredAt=new Date().toISOString();j.events.push({time:new Date().toISOString(),text:"Manager approved: "+old+" → "+j.stage,by:PP.profile.display_name});PP.stageNotify(j,old,j.stage);PP.save();document.querySelector("#drawer").hidden=true;PP.render()};
PP.manualEmail=j=>{PP.queueEmail(j,"manual:"+Date.now(),"Precision ATV Production Update — "+j.invoice,"Here is an update on your engine job.");PP.save();document.querySelector("#drawer").hidden=true;PP.view="notifications";PP.render()};
PP.scanStale=()=>{let days=Number(PP.state.notificationSettings.staleDays||3),made=0;PP.state.jobs.filter(j=>j.productionClass==="customer"&&j.stage!=="Complete").forEach(j=>{if((Date.now()-new Date(j.stageEnteredAt))/864e5<days)return;let key="stale:"+j.stage+":"+new Date().toISOString().slice(0,10);if(PP.state.emailOutbox.some(e=>e.jobId===j.id&&e.key===key))return;PP.queueEmail(j,key,"Precision ATV Production Update — "+j.invoice,j.blocked?"Your engine is currently held for: "+j.blockerType+".":"Your engine is still in the "+j.stage+" stage. We have not lost track of your job.");made++});PP.save();PP.render();PP.toast(made?made+" update(s) queued":"No new updates due")};PP.scheduleRun=id=>{let r=PP.state.inventory.find(x=>x.id===id),p=PP.invPlan(r);if(!p.make)return;let date=prompt("Machining date YYYY-MM-DD",PP.today());if(!date)return;PP.state.machineRuns.push({id:PP.uid(),familyId:r.familyId,component:r.component,qty:p.make,date,status:"Scheduled"});PP.save();PP.render()};PP.scheduleAll=()=>{PP.state.inventory.forEach(r=>{let p=PP.invPlan(r);if(p.make&&!PP.state.machineRuns.some(x=>x.familyId===r.familyId&&x.component===r.component&&x.status!=="Complete"))PP.state.machineRuns.push({id:PP.uid(),familyId:r.familyId,component:r.component,qty:p.make,date:PP.today(),status:"Scheduled"})});PP.save();PP.render()};PP.runStart=id=>{let r=PP.state.machineRuns.find(x=>x.id===id);r.status="In Progress";PP.save();PP.render()};PP.runDone=id=>{let run=PP.state.machineRuns.find(x=>x.id===id);run.status="Complete";let inv=PP.state.inventory.find(x=>x.familyId===run.familyId&&x.component===run.component);inv.onHand=Number(inv.onHand)+Number(run.qty);PP.save();PP.render()};PP.saveMember=async id=>{let role=document.querySelector(`[data-role="${id}"]`).value,active=document.querySelector(`[data-active="${id}"]`).checked,r=await PP.updateMember(id,role,active);if(r.error)PP.toast(r.error.message);else{await PP.loadTeam();PP.render();PP.toast("Team member updated")}};PP.boot();