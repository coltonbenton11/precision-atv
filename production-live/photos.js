// Job/task photo evidence. Photos are stored separately from the shared production state.
PP.PHOTO_BUCKET = 'job-task-photos';
PP.PHOTO_MAX_BYTES = 8 * 1024 * 1024;
PP.PHOTO_CHECKS = {
  'Teardown': [
    {key:'teardown-overview',label:'Engine condition before teardown',required:true},
    {key:'teardown-damage',label:'Visible damage or concerns',required:false}
  ],
  'Cleaning & Blasting': [
    {key:'cleaning-complete',label:'Cleaned components',required:true}
  ],
  'Inspection': [
    {key:'inspection-cylinder',label:'Cylinder inspection',required:true},
    {key:'inspection-head',label:'Cylinder head inspection',required:true},
    {key:'inspection-crank',label:'Crankshaft inspection',required:true}
  ],
  'Machining': [
    {key:'machining-complete',label:'Completed machine work',required:true}
  ],
  'Pull Parts for Build': [
    {key:'parts-staged',label:'Parts pulled and staged for assembly',required:true}
  ],
  'Mark': [
    {key:'assembly-complete',label:'Completed engine assembly',required:true}
  ],
  'Steven': [
    {key:'assembly-complete',label:'Completed engine assembly',required:true}
  ],
  'Test': [
    {key:'test-evidence',label:'Engine on test stand / test results',required:true}
  ],
  'VIN Verification': [
    {key:'vin-verification',label:'VIN / serial number verification',required:true}
  ],
  'Core Received - Inspection': [
    {key:'core-condition',label:'Received core condition',required:true}
  ],
  'Ready for Ship': [
    {key:'shipping-evidence',label:'Final engine packaging',required:true}
  ]
};
PP.photoChecksFor = stage => [
  ...(PP.PHOTO_CHECKS[stage] || []),
  {key:'additional-photos',label:'Additional photos for this stage',required:false}
];
PP.photoMissing = async j => {
  const required = PP.photoChecksFor(j.stage).filter(t=>t.required);
  if (!required.length) return [];
  const {data,error} = await PP.sb.from('job_task_photos')
    .select('task_key').eq('job_id',j.id).eq('stage',j.stage)
    .in('task_key',required.map(t=>t.key));
  if (error) throw error;
  const done = new Set((data||[]).map(p=>p.task_key));
  return required.filter(t=>!done.has(t.key)).map(t=>t.label);
};
PP.requireStagePhotos = async j => {
  try {
    const missing = await PP.photoMissing(j);
    if (!missing.length) return true;
    PP.toast('Required photos missing: '+missing.join(', '));
    return false;
  } catch(err) {
    console.error('Could not verify required job photos',err);
    PP.toast('Photo checks unavailable. Stage not advanced.');
    return false;
  }
};
PP.photoEsc = v => PP.esc(v);
PP.mountJobPhotos = async j => {
  const el=document.querySelector('#jobPhotoChecks');
  if (!el) return;
  el.dataset.jobId=j.id;
  el.innerHTML='<h3>Task photos</h3><p class="muted">Loading saved photos…</p>';
  try {
    const {data,error}=await PP.sb.from('job_task_photos').select('*')
      .eq('job_id',j.id).order('created_at',{ascending:false});
    if(error) throw error;
    if(el.dataset.jobId!==j.id||!document.querySelector('#drawer')||document.querySelector('#drawer').hidden)return;
    const photos=data||[];
    const signed=await Promise.all(photos.map(p=>PP.sb.storage.from(PP.PHOTO_BUCKET).createSignedUrl(p.storage_path,3600)));
    const photoHtml=(p,i)=>{
      const url=signed[i].data?.signedUrl;
      const by=PP.team.find(x=>x.id===p.uploaded_by)?.display_name||'Team member';
      const meta=PP.photoEsc(by+' · '+new Date(p.created_at).toLocaleString());
      return `<div class="task-photo">${url?`<a href="${PP.photoEsc(url)}" target="_blank" rel="noopener noreferrer" title="View full photo"><img src="${PP.photoEsc(url)}" loading="lazy" alt="${PP.photoEsc(p.task_label)}"></a>`:'<span class="muted">Image unavailable</span>'}<small title="${meta}">${meta}</small></div>`;
    };
    const current=PP.photoChecksFor(j.stage);
    const checklist=current.map(task=>{
      const imgs=photos.map((p,i)=>({p,i})).filter(x=>x.p.stage===j.stage&&x.p.task_key===task.key);
      const required=task.required;
      return `<div class="photo-task">
        <div class="photo-task-title"><strong>${PP.photoEsc(task.label)}</strong>
          <span class="badge ${imgs.length?'green':required?'amber':''}">${imgs.length?'✓ '+imgs.length+' saved':required?'Photo required':'Optional'}</span></div>
        <div class="task-photo-grid">${imgs.map(x=>photoHtml(x.p,x.i)).join('')}</div>
        <label class="btn photo-add">+ Add photo<input class="photo-input" type="file" accept="image/jpeg,image/png,image/webp" data-photo-task="${PP.photoEsc(task.key)}" data-photo-stage="${PP.photoEsc(j.stage)}" data-photo-label="${PP.photoEsc(task.label)}" hidden></label>
      </div>`;
    }).join('');
    const history=photos.map((p,i)=>({p,i})).filter(x=>x.p.stage!==j.stage);
    const oldHtml=history.length?`<details class="photo-history"><summary>Earlier-stage photos (${history.length})</summary>${history.map(x=>`<div class="photo-history-row"><b>${PP.photoEsc(x.p.stage)} · ${PP.photoEsc(x.p.task_label)}</b><div class="task-photo-grid">${photoHtml(x.p,x.i)}</div></div>`).join('')}</details>`:'';
    el.innerHTML=`<h3>Task photos</h3><p class="muted">Each image is saved to this job and its specific checklist task. Add a required photo before completing the stage.</p>${checklist}<p class="muted photo-status" aria-live="polite"></p>${oldHtml}`;
    el.querySelectorAll('.photo-input').forEach(input=>{
      input.addEventListener('change',async()=>{
        const file=input.files?.[0];
        if(!file)return;
        input.disabled=true;
        const status=el.querySelector('.photo-status');
        status.textContent='Uploading photo…';
        try {
          await PP.uploadJobPhoto(j,{key:input.dataset.photoTask,label:input.dataset.photoLabel,stage:input.dataset.photoStage},file);
          PP.toast('Photo saved to job '+j.invoice);
          await PP.mountJobPhotos(j);
        } catch(err) {
          console.error('Photo upload failed',err);
          status.textContent='Upload failed: '+(err?.message||'Please retry.');
          input.disabled=false;
        }
      });
    });
  }catch(err){
    console.error('Unable to load job photos',err);
    el.innerHTML='<h3>Task photos</h3><p class="muted">Photos are unavailable until the private storage bucket and photo table are configured.</p>';
  }
};
PP.uploadJobPhoto = async (j,task,file) => {
  const mimeExtensions={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  if(!mimeExtensions[file.type])throw Error('Use a JPG, PNG, or WebP photo.');
  if(file.size>PP.PHOTO_MAX_BYTES)throw Error('Image must be 8 MB or smaller.');
  if(file.size===0)throw Error('The selected image is empty.');
  if(!PP.photoChecksFor(task.stage).some(t=>t.key===task.key&&t.label===task.label))throw Error('Invalid photo task.');
  const path=`${j.id}/${task.key}/${crypto.randomUUID()}.${mimeExtensions[file.type]}`;
  const {error:uploadError}=await PP.sb.storage.from(PP.PHOTO_BUCKET).upload(path,file,{contentType:file.type,cacheControl:'3600',upsert:false});
  if(uploadError)throw uploadError;
  const {error:recordError}=await PP.sb.from('job_task_photos').insert({
    job_id:j.id,stage:task.stage,task_key:task.key,task_label:task.label,
    storage_path:path,file_name:file.name.slice(0,180),byte_size:file.size,uploaded_by:PP.user.id
  });
  if(recordError)throw Error('Photo uploaded but indexing failed; contact management before retrying. '+recordError.message);
};
