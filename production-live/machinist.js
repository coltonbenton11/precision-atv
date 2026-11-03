// Precision ATV — manual work-order machining queue, independent from stock machine runs.
PP.machineTasks = [];
PP.machineFilter = 'active';
PP.machineSearch = '';
PP.machineEditing = '';
PP.machineLoadError = '';

PP.machineToday = () => {
  const d=new Date(), pad=x=>String(x).padStart(2,'0');
  return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
};
PP.machineIsManager = () => ['owner','manager'].includes(PP.profile?.role);
PP.machineActiveJobs = () => (PP.state?.jobs||[])
  .filter(j=>!j.archivedAt&&j.stage!=='Complete')
  .sort((a,b)=>Number(a.invoiceNumber||99999999)-Number(b.invoiceNumber||99999999));
PP.machineJobLabel = j => [j.invoice||'No invoice',j.customer||'No customer',j.engine||j.stage||''].filter(Boolean).join(' — ');
PP.machineJobOptions = (filter='',selected='') => {
  const s=filter.trim().toLowerCase();
  return '<option value="">Shop / internal task (no customer job)</option>'+
    PP.machineActiveJobs().filter(j=>j.id===selected||!s||PP.machineJobLabel(j).toLowerCase().includes(s))
      .map(j=>'<option value="'+PP.esc(j.id)+'" '+(j.id===selected?'selected':'')+'>'+PP.esc(PP.machineJobLabel(j))+'</option>').join('');
};
PP.loadMachineTasks=async()=>{
  try{
    const {data,error}=await PP.sb.from('machinist_tasks').select('*').order('scheduled_date',{ascending:true}).limit(1000);
    if(error)throw error;
    PP.machineTasks=data||[];
    PP.machineLoadError='';
    return true;
  }catch(e){
    console.error('Could not load machinist work',e);
    PP.machineLoadError=e?.message||'Machinist task list unavailable';
    return false;
  }
};
PP.machineSort=(a,b)=>{
  const rank={'Warranty':0,'High':1,'Normal':2};
  return (a.scheduled_date||'').localeCompare(b.scheduled_date||'')
    || (rank[a.priority]??2)-(rank[b.priority]??2)
    || String(a.created_at||'').localeCompare(String(b.created_at||''));
};
PP.machineDateLabel=d=>{
  if(!d)return 'Unscheduled';
  const [y,m,day]=d.split('-').map(Number);
  return new Date(y,m-1,day).toLocaleDateString(undefined,{month:'short',day:'numeric',weekday:'short'});
};
PP.view_machinist=()=>{
  const canManage=PP.machineIsManager();
  const jobs=new Map((PP.state.jobs||[]).map(j=>[j.id,j]));
  const tasks=[...(PP.machineTasks||[])].sort(PP.machineSort);
  const active=tasks.filter(t=>t.status!=='Complete');
  const today=PP.machineToday();
  const overdue=active.filter(t=>t.scheduled_date<today).length;
  const blocked=active.filter(t=>t.status==='Blocked').length;
  const done=tasks.filter(t=>t.status==='Complete').length;
  const query=(PP.machineSearch||'').toLowerCase().trim();
  let matching=tasks.filter(t=>{
    const j=jobs.get(t.job_id);
    if(query&&!([t.title,t.details,j?.invoice,j?.customer,j?.engine].join(' ').toLowerCase().includes(query)))return false;
    switch(PP.machineFilter){
      case 'mine':return t.assigned_to===PP.user?.id&&t.status!=='Complete';
      case 'today':return t.status!=='Complete'&&t.scheduled_date<=today;
      case 'upcoming':return t.status!=='Complete'&&t.scheduled_date>today;
      case 'blocked':return t.status==='Blocked';
      case 'complete':return t.status==='Complete';
      default:return t.status!=='Complete';
    }
  });
  if(PP.machineFilter==='complete')matching=matching.sort((a,b)=>(b.completed_at||'').localeCompare(a.completed_at||''));
  const canAction=t=>canManage||!t.assigned_to||t.assigned_to===PP.user?.id;
  const team=PP.team.filter(p=>p.active).sort((a,b)=>a.display_name.localeCompare(b.display_name));
  const assigneeOptions='<option value="">Unassigned / available to shop</option>'+team.map(p=>'<option value="'+PP.esc(p.id)+'">'+PP.esc(p.display_name)+'</option>').join('');
  const forms=canManage?`<section class="card machinist-create" id="machinistTaskEditor">
    <div class="card-head"><div><h3 data-mac-editor-title>Add machinist work</h3><p>Assign machining work to a customer engine or create an internal shop task.</p></div></div>
    <form data-mac-form class="machinist-form">
      <label class="wide">Find engine / work order<input type="search" data-mac-job-search placeholder="Search invoice, customer or engine"></label>
      <label class="wide">Job<select name="jobId" data-mac-job-select>${PP.machineJobOptions()}</select></label>
      <label>Common task<select data-mac-preset><option value="">Choose or type your own</option><option>Bore / hone cylinder</option><option>Resurface cylinder head</option><option>Cut / install valve seats</option><option>Replace valve guides</option><option>Pressure test cylinder head</option><option>Clean / prep components</option><option>Inspect / measure components</option><option>Other machining work</option></select></label>
      <label>Work to perform <span class="required-star">*</span><input name="title" maxlength="180" required placeholder="e.g., Bore and hone cylinders"></label>
      <label>Scheduled date<input name="scheduledDate" type="date" required value="${today}"></label>
      <label>Assign to<select name="assignedTo">${assigneeOptions}</select></label>
      <label>Priority<select name="priority"><option>Normal</option><option>High</option><option>Warranty</option></select></label>
      <label class="wide">Instructions / measurements<textarea name="details" maxlength="4000" rows="3" placeholder="Parts, dimensions, specific machine work, special instructions…"></textarea></label>
      <div class="machinist-form-actions"><button class="btn primary" type="submit" data-mac-save>+ Add machining task</button><button class="btn" type="button" data-mac-reset>Clear</button></div>
      <p class="muted machinist-form-feedback" data-mac-feedback aria-live="polite"></p>
    </form>
  </section>`:'';
  const tabs=[
    ['active','All active',active.length],
    ['mine','My tasks',active.filter(x=>x.assigned_to===PP.user?.id).length],
    ['today','Due / overdue',active.filter(x=>x.scheduled_date<=today).length],
    ['upcoming','Upcoming',active.filter(x=>x.scheduled_date>today).length],
    ['blocked','Blocked',blocked],
    ['complete','Completed',done]
  ];
  const card=t=>{
    const j=jobs.get(t.job_id);
    const assigned=PP.team.find(p=>p.id===t.assigned_to);
    const managed=canManage;
    const actionable=canAction(t);
    const late=t.status!=='Complete'&&t.scheduled_date<today;
    const status=t.status.replace(/ /g,'-').toLowerCase();
    const controls=t.status==='Complete'
      ?(managed?'<button class="btn" type="button" data-mac-status="Scheduled" data-mac-id="'+PP.esc(t.id)+'">Reopen</button>':'')
      :!actionable?'<span class="muted">Assigned to another technician</span>':
      (t.status!=='In Progress'?'<button class="btn" type="button" data-mac-status="In Progress" data-mac-id="'+PP.esc(t.id)+'">'+(t.status==='Blocked'?'Resume':'Start')+'</button>':'')
      +'<button class="btn primary" type="button" data-mac-status="Complete" data-mac-id="'+PP.esc(t.id)+'">Complete</button>'
      +(t.status!=='Blocked'?'<button class="btn" type="button" data-mac-status="Blocked" data-mac-id="'+PP.esc(t.id)+'">Blocked</button>':'');
    return `<article class="machinist-task ${late?'is-overdue':''}">
      <div class="machinist-task-top"><div><b>${PP.esc(t.title)}</b><p class="muted">${j?PP.esc(PP.machineJobLabel(j)):'Shop / internal task'}</p></div><span class="badge ${status==='blocked'?'amber':status==='complete'?'green':''}">${PP.esc(t.status)}</span></div>
      <div class="machinist-task-meta">
        <span><b>${PP.esc(PP.machineDateLabel(t.scheduled_date))}</b>${late?' · Overdue':''}</span>
        <span>${PP.esc(t.priority)} priority</span>
        <span>${assigned?PP.esc(assigned.display_name):'Unassigned'}</span>
      </div>
      ${t.details?'<p class="machinist-details">'+PP.esc(t.details)+'</p>':''}
      ${t.blocker_note&&t.status==='Blocked'?'<p class="machinist-blocker">Blocked: '+PP.esc(t.blocker_note)+'</p>':''}
      <div class="machinist-task-actions">${j?'<button class="btn" type="button" data-mac-job="'+PP.esc(j.id)+'">Open engine</button>':''}${managed?'<button class="btn" type="button" data-mac-edit="'+PP.esc(t.id)+'">Edit</button>':''}${controls}</div>
    </article>`;
  };
  const runs=(PP.state.machineRuns||[]).filter(x=>x.status!=='Complete').sort((a,b)=>String(a.date).localeCompare(String(b.date)));
  const legacy=canManage?`<details class="card machinist-stock"><summary>Inventory-based machining runs (${runs.length})</summary><div class="machine-list">${runs.length?runs.map(r=>{
    const f=PP.FAMILIES.find(x=>x.id===r.familyId);
    return '<div class="machine-run '+(r.status==='In Progress'?'live':'')+'"><b>'+PP.esc(r.date)+'</b><div><strong>'+PP.esc(f?.label||'Unknown engine')+'</strong><p class="muted">'+PP.esc(r.component)+' · '+Number(r.qty)+' sets</p></div><span>'+PP.esc(r.status)+'</span><div><button class="btn" data-run-start="'+PP.esc(r.id)+'">Start</button> <button class="btn primary" data-run-done="'+PP.esc(r.id)+'">Complete</button></div></div>';
  }).join(''):'<div class="empty">No inventory-based machining runs scheduled.</div>'}</div></details>`:'';
  return `<div class="summary machinist-stats">
    <div class="stat"><span>Active tasks</span><strong>${active.length}</strong></div>
    <div class="stat"><span>Due / overdue</span><strong>${active.filter(x=>x.scheduled_date<=today).length}</strong></div>
    <div class="stat"><span>Blocked</span><strong>${blocked}</strong></div>
    <div class="stat"><span>Completed</span><strong>${done}</strong></div>
  </div>
  ${PP.machineLoadError?'<p class="machinist-blocker">Could not load machining tasks: '+PP.esc(PP.machineLoadError)+'</p>':''}
  <div class="machinist-layout">${forms}
    <section class="card machinist-queue">
      <div class="card-head"><div><h2>Machinist task queue</h2><p>Jobs, due dates and work assignments. Tasks can be created without moving the engine’s production stage.</p></div><button class="btn" type="button" data-mac-refresh>Refresh</button></div>
      <div class="machinist-filters">${tabs.map(([key,label,count])=>'<button type="button" class="btn '+(PP.machineFilter===key?'active':'')+'" data-mac-filter="'+key+'">'+PP.esc(label)+' ('+count+')</button>').join('')}</div>
      <div class="machinist-search"><input type="search" data-mac-search placeholder="Search tasks, invoice, customer, engine…" value="${PP.esc(PP.machineSearch||'')}"></div>
      <div class="machinist-task-list">${matching.length?matching.map(card).join(''):'<div class="empty">No matching machining tasks. '+(canManage?'Use Add machinist work to schedule the first one.':'Check All active or ask management to assign work.')+'</div>'}</div>
    </section>
  </div>
  ${legacy}`;
};
PP.machineClearForm=()=>{
  PP.machineEditing='';
  const form=document.querySelector('[data-mac-form]');
  if(!form)return;
  form.reset();
  form.querySelector('[name="scheduledDate"]').value=PP.machineToday();
  form.querySelector('[data-mac-job-search]').value='';
  form.querySelector('[data-mac-job-select]').innerHTML=PP.machineJobOptions();
  form.querySelector('[data-mac-save]').textContent='+ Add machining task';
  document.querySelector('[data-mac-editor-title]').textContent='Add machinist work';
  document.querySelector('[data-mac-feedback]').textContent='';
};
PP.machineStartEdit=id=>{
  if(!PP.machineIsManager())return;
  const t=PP.machineTasks.find(x=>x.id===id),form=document.querySelector('[data-mac-form]');
  if(!t||!form)return;
  PP.machineEditing=id;
  form.querySelector('[name="jobId"]').innerHTML=PP.machineJobOptions('',t.job_id||'');
  form.querySelector('[name="jobId"]').value=t.job_id||'';
  form.querySelector('[name="title"]').value=t.title;
  form.querySelector('[name="details"]').value=t.details||'';
  form.querySelector('[name="scheduledDate"]').value=t.scheduled_date;
  form.querySelector('[name="assignedTo"]').value=t.assigned_to||'';
  form.querySelector('[name="priority"]').value=t.priority;
  form.querySelector('[data-mac-save]').textContent='Save changes';
  document.querySelector('[data-mac-editor-title]').textContent='Edit machining task';
  document.querySelector('#machinistTaskEditor')?.scrollIntoView({behavior:'smooth',block:'start'});
};
PP.machineSave=async form=>{
  if(!PP.machineIsManager())return PP.toast('Manager access required');
  const saveBtn=form.querySelector('[data-mac-save]');
  const field=name=>form.querySelector('[name="'+name+'"]');
  const title=field('title').value.trim(),details=field('details').value.trim();
  const jobId=field('jobId').value||null,day=field('scheduledDate').value;
  const assigned=field('assignedTo').value||null,priority=field('priority').value;
  if(title.length<2||title.length>180)return PP.toast('Enter a task description (2–180 characters)');
  if(details.length>4000)return PP.toast('Instructions are too long');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))return PP.toast('Select a scheduled date');
  if(jobId&&!PP.state.jobs.some(j=>j.id===jobId&&!j.archivedAt&&j.stage!=='Complete'))return PP.toast('Select an active job');
  saveBtn.disabled=true;
  try{
    let r;
    const values={job_id:jobId,title,details,scheduled_date:day,assigned_to:assigned,priority,updated_at:new Date().toISOString()};
    if(PP.machineEditing)r=await PP.sb.from('machinist_tasks').update(values).eq('id',PP.machineEditing);
    else r=await PP.sb.from('machinist_tasks').insert({...values,created_by:PP.user.id,status:'Scheduled'});
    if(r.error)throw r.error;
    await PP.loadMachineTasks();
    PP.machineEditing='';
    PP.render();
    PP.toast('Machining task saved');
  }catch(err){
    console.error('Could not save machining task',err);
    PP.toast('Could not save machining task: '+(err?.message||'Please retry'));
  }finally{saveBtn.disabled=false}
};
PP.machineChangeStatus=async(id,status)=>{
  const task=PP.machineTasks.find(x=>x.id===id);if(!task)return;
  let note='';
  if(status==='Blocked'){
    const entered=prompt('What is stopping this machining task?',task.blocker_note||'');
    if(entered===null)return;
    note=entered.trim();
    if(!note)return PP.toast('Enter a reason for the blocker');
  }
  try{
    const {error}=await PP.sb.rpc('set_machinist_task_status',{p_task_id:id,p_status:status,p_blocker_note:note});
    if(error)throw error;
    await PP.loadMachineTasks();
    PP.render();
    PP.toast('Machining task '+status.toLowerCase());
  }catch(err){console.error('Could not update machining task',err);PP.toast(err?.message||'Could not update task');}
};
PP.bindMachineTasks=()=>{
  if(PP.view!=='machinist')return;
  const form=document.querySelector('[data-mac-form]');
  form?.addEventListener('submit',e=>{e.preventDefault();PP.machineSave(form)});
  document.querySelector('[data-mac-reset]')?.addEventListener('click',PP.machineClearForm);
  document.querySelector('[data-mac-preset]')?.addEventListener('change',e=>{
    if(e.target.value)form?.querySelector('[name="title"]')?.setAttribute('value',e.target.value);
    const input=form?.querySelector('[name="title"]');if(input&&e.target.value)input.value=e.target.value;
  });
  document.querySelector('[data-mac-job-search]')?.addEventListener('input',e=>{
    const select=form.querySelector('[data-mac-job-select]'),chosen=select.value;
    select.innerHTML=PP.machineJobOptions(e.target.value,chosen);
  });
  document.querySelectorAll('[data-mac-filter]').forEach(b=>b.addEventListener('click',()=>{
    PP.machineFilter=b.dataset.macFilter;PP.render();
  }));
  document.querySelector('[data-mac-search]')?.addEventListener('input',e=>{
    PP.machineSearch=e.target.value;
    const pos=e.target.selectionStart;PP.render();
    requestAnimationFrame(()=>{
      const input=document.querySelector('[data-mac-search]');
      if(input){input.focus();input.setSelectionRange(pos,pos)}
    });
  });
  document.querySelector('[data-mac-refresh]')?.addEventListener('click',async()=>{
    await PP.loadMachineTasks();PP.render();PP.toast('Machining tasks refreshed');
  });
  document.querySelectorAll('[data-mac-openjob],[data-mac-job]').forEach(b=>b.addEventListener('click',()=>PP.openJob(b.dataset.macJob)));
  document.querySelectorAll('[data-mac-edit]').forEach(b=>b.addEventListener('click',()=>PP.machineStartEdit(b.dataset.macEdit)));
  document.querySelectorAll('[data-mac-status]').forEach(b=>b.addEventListener('click',()=>PP.machineChangeStatus(b.dataset.macId,b.dataset.macStatus)));
};
