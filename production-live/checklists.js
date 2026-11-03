// Custom production checklist templates. Managers configure tasks; staff complete them per job/stage.
PP.checklistTemplates=[];
PP.checklistError='';
PP.checklistSelectedStage='Teardown';
PP.loadChecklistTemplates=async()=>{
  const {data,error}=await PP.sb.from('production_checklist_templates').select('*').order('position',{ascending:true});
  if(error){PP.checklistError=error.message;console.error('Checklist templates unavailable',error);return false;}
  PP.checklistError='';
  PP.checklistTemplates=data||[];
  return true;
};
PP.checklistTasksFor=stage=>PP.checklistTemplates
  .filter(t=>t.stage===stage&&t.active)
  .sort((a,b)=>a.position-b.position||a.label.localeCompare(b.label));
PP.photoChecksFor=stage=>[
  ...PP.checklistTasksFor(stage).map(t=>({
    key:t.task_key,label:t.label,required:!!t.is_required,photoRequired:!!t.photo_required
  })),
  {key:'additional-photos',label:'Additional photos for this stage',required:false,photoRequired:false}
];
PP.photoMissing=async(j,nextStage)=>{
  if(PP.checklistError)throw Error(PP.checklistError);
  const start=PP.STAGES.indexOf(j.stage),end=PP.STAGES.indexOf(nextStage);
  if(start<0||end<=start)return [];
  const stages=PP.STAGES.slice(start,end);
  const required=stages.flatMap(stage=>PP.checklistTasksFor(stage)
    .filter(t=>t.is_required).map(t=>({stage,key:t.task_key,label:t.label,photo:!!t.photo_required})));
  if(!required.length)return [];
  const [cs,ps]=await Promise.all([
    PP.sb.from('production_checklist_completions').select('stage,task_key').eq('job_id',j.id).in('stage',stages),
    PP.sb.from('job_task_photos').select('stage,task_key').eq('job_id',j.id).in('stage',stages)
  ]);
  if(cs.error)throw cs.error;
  if(ps.error)throw ps.error;
  const completed=new Set((cs.data||[]).map(c=>c.stage+':'+c.task_key));
  const photographed=new Set((ps.data||[]).map(p=>p.stage+':'+p.task_key));
  return required.flatMap(t=>{
    const id=t.stage+':'+t.key;
    const issues=[];
    if(!completed.has(id))issues.push(t.stage+' — '+t.label+' (complete checklist)');
    if(t.photo&&!photographed.has(id))issues.push(t.stage+' — '+t.label+' (add photo)');
    return issues;
  });
};
PP.requireAdvancePhotos=async(j,nextStage)=>{
  try{
    const missing=await PP.photoMissing(j,nextStage);
    if(!missing.length)return true;
    const message='Checklist incomplete: '+missing.slice(0,3).join('; ')+(missing.length>3?' …':'');
    PP.toast(message);
    return false;
  }catch(err){
    console.error('Checklist validation failed',err);
    PP.toast('Cannot advance: checklist verification unavailable.');
    return false;
  }
};
PP.requireStagePhotos=j=>PP.requireAdvancePhotos(j,PP.nextStage(j.stage));
PP.completeJobTask=async(j,task)=>{
  if(j.archivedAt||j.stage==='Complete'||j.stage!==task.stage)return PP.toast('This job is read-only');
  if(task.key==='additional-photos')return;
  try{
    if(task.photoRequired){
      const {data,error}=await PP.sb.from('job_task_photos').select('id').eq('job_id',j.id)
        .eq('stage',j.stage).eq('task_key',task.key).limit(1);
      if(error)throw error;
      if(!data?.length)return PP.toast('Take or upload the required photo first');
    }
    const {error}=await PP.sb.from('production_checklist_completions').insert({
      job_id:j.id,stage:j.stage,task_key:task.key,completed_by:PP.user.id
    });
    if(error&&error.code!=='23505')throw error;
    PP.toast('Checklist task completed');
    await PP.mountJobPhotos(j);
  }catch(err){console.error('Could not complete checklist task',err);PP.toast('Could not save checklist completion');}
};
PP.view_checklists=()=>{
  const stage=PP.checklistSelectedStage||'Teardown';
  const all=PP.checklistTemplates.filter(t=>t.stage===stage).sort((a,b)=>a.position-b.position);
  const stageSelect=PP.STAGES.filter(s=>s!=='Complete').map(s=>
    '<option '+(s===stage?'selected':'')+' value="'+PP.esc(s)+'">'+PP.esc(s)+'</option>').join('');
  const rows=all.map(t=>
    '<div class="checklist-template-row" data-checklist-row="'+PP.esc(t.id)+'">'+
      '<label>Checklist item<input data-ct-label maxlength="240" value="'+PP.esc(t.label)+'"></label>'+
      '<label class="ct-option"><input type="checkbox" data-ct-required '+(t.is_required?'checked':'')+'> Required</label>'+
      '<label class="ct-option"><input type="checkbox" data-ct-photo '+(t.photo_required?'checked':'')+'> Require photo</label>'+
      '<label class="ct-option"><input type="checkbox" data-ct-active '+(t.active?'checked':'')+'> Enabled</label>'+
      '<button class="btn" data-ct-save="'+PP.esc(t.id)+'">Save</button>'+
    '</div>').join('');
  return '<div class="card checklist-manager">'+
    '<div class="card-head"><div><h2>Production Checklists</h2><p>Create tasks for each stage. Required tasks and photos must be completed before advancing.</p></div></div>'+
    (PP.checklistError?'<div class="empty">Checklist storage unavailable: '+PP.esc(PP.checklistError)+'</div>':'')+
    '<div class="checklist-manager-body">'+
      '<label class="checklist-stage-picker">Production stage<select data-ct-stage>'+stageSelect+'</select></label>'+
      '<h3>'+PP.esc(stage)+' tasks</h3>'+
      (rows||'<p class="muted">No checklist tasks for this stage yet.</p>')+
      '<form data-ct-form class="checklist-new-task">'+
        '<label>New checklist task<input name="label" required maxlength="240" placeholder="e.g., Photograph cylinder walls"></label>'+
        '<label class="ct-option"><input type="checkbox" name="required"> Required to advance</label>'+
        '<label class="ct-option"><input type="checkbox" name="photo"> Photo required</label>'+
        '<button class="btn primary" type="submit">+ Add task</button>'+
      '</form>'+
    '</div></div>';
};
PP.bindChecklistEditor=()=>{
  if(PP.view!=='checklists')return;
  document.querySelector('[data-ct-stage]')?.addEventListener('change',e=>{
    PP.checklistSelectedStage=e.target.value;PP.render();
  });
  document.querySelector('[data-ct-form]')?.addEventListener('submit',async e=>{
    e.preventDefault();
    const form=e.currentTarget,button=form.querySelector('button[type=submit]');
    const label=form.elements.label.value.trim(),required=form.elements.required.checked||form.elements.photo.checked;
    if(!label)return;
    button.disabled=true;
    const {error}=await PP.sb.from('production_checklist_templates').insert({
      stage:PP.checklistSelectedStage,task_key:crypto.randomUUID(),label,
      position:PP.checklistTemplates.filter(t=>t.stage===PP.checklistSelectedStage).length+1,
      is_required:required,photo_required:form.elements.photo.checked,active:true,created_by:PP.user.id
    });
    button.disabled=false;
    if(error){console.error(error);return PP.toast('Could not create checklist task: '+error.message);}
    await PP.loadChecklistTemplates();PP.render();PP.toast('Checklist task added');
  });
  document.querySelectorAll('[data-ct-save]').forEach(btn=>btn.addEventListener('click',async()=>{
    const item=btn.closest('[data-checklist-row]');
    if(!item)return;
    const label=item.querySelector('[data-ct-label]').value.trim();
    if(!label)return PP.toast('Checklist task name is required');
    const photo=item.querySelector('[data-ct-photo]').checked;
    const required=photo||item.querySelector('[data-ct-required]').checked;
    btn.disabled=true;
    const {error}=await PP.sb.from('production_checklist_templates').update({
      label,is_required:required,photo_required:photo,
      active:item.querySelector('[data-ct-active]').checked,updated_at:new Date().toISOString()
    }).eq('id',btn.dataset.ctSave);
    btn.disabled=false;
    if(error){console.error(error);return PP.toast('Could not update task: '+error.message);}
    await PP.loadChecklistTemplates();PP.render();PP.toast('Checklist saved');
  }));
};