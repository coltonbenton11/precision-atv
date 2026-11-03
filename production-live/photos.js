// Job/task photo evidence. Photos are stored separately from the shared production state.
PP.PHOTO_BUCKET = 'job-task-photos';
PP.PHOTO_MAX_BYTES = 8 * 1024 * 1024;
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
    const {data:done,error:doneError}=await PP.sb.from('production_checklist_completions').select('*').eq('job_id',j.id);
    if(doneError)throw doneError;
    const completions=done||[];
    const signed=await Promise.all(photos.map(p=>PP.sb.storage.from(PP.PHOTO_BUCKET).createSignedUrl(p.storage_path,3600)));
    const photoHtml=(p,i)=>{
      const url=signed[i].data?.signedUrl;
      const by=PP.team.find(x=>x.id===p.uploaded_by)?.display_name||'Team member';
      const meta=PP.photoEsc(by+' · '+new Date(p.created_at).toLocaleString());
      return `<div class="task-photo">${url?`<a href="${PP.photoEsc(url)}" target="_blank" rel="noopener noreferrer" title="View full photo"><img src="${PP.photoEsc(url)}" loading="lazy" alt="${PP.photoEsc(p.task_label)}"></a>`:'<span class="muted">Image unavailable</span>'}<small title="${meta}">${meta}</small></div>`;
    };
    const current=(j.archivedAt||j.stage==='Complete')?[]:PP.photoChecksFor(j.stage);
    const checklist=current.map(task=>{
      const imgs=photos.map((p,i)=>({p,i})).filter(x=>x.p.stage===j.stage&&x.p.task_key===task.key);
      const required=task.required,needsPhoto=task.photoRequired;
      const complete=completions.find(c=>c.stage===j.stage&&c.task_key===task.key);
      const by=complete?PP.team.find(x=>x.id===complete.completed_by)?.display_name||'Team member':'';
      const doneLabel=complete?'Completed by '+by+' · '+new Date(complete.completed_at).toLocaleString():'';
      return `<div class="photo-task">
        <div class="photo-task-title"><strong>${PP.photoEsc(task.label)}</strong>
          <span class="badge ${complete?'green':required?'amber':''}">${complete?'✓ Done':required?'Required':'Optional'}</span></div>
        ${task.key!=='additional-photos'?'<p class="muted" style="margin:4px 0 8px">'+(needsPhoto?(imgs.length?'Photo attached':'Photo required'):'Photo optional')+(doneLabel?' · '+PP.photoEsc(doneLabel):'')+'</p>':''}
        <div class="task-photo-grid">${imgs.map(x=>photoHtml(x.p,x.i)).join('')}</div>
        ${task.key!=='additional-photos'&&!complete?'<button class="btn primary" type="button" data-task-complete="'+PP.photoEsc(task.key)+'">✓ Mark task done</button> ':''}
        <label class="btn photo-add">Take photo<input class="photo-input" type="file" accept="image/*" capture="environment" data-photo-task="${PP.photoEsc(task.key)}" data-photo-stage="${PP.photoEsc(j.stage)}" data-photo-label="${PP.photoEsc(task.label)}" hidden></label> <label class="btn photo-add">Choose photo<input class="photo-input" type="file" accept="image/jpeg,image/png,image/webp" data-photo-task="${PP.photoEsc(task.key)}" data-photo-stage="${PP.photoEsc(j.stage)}" data-photo-label="${PP.photoEsc(task.label)}" hidden></label>
      </div>`;
    }).join('');
    const history=photos.map((p,i)=>({p,i})).filter(x=>!!j.archivedAt||j.stage==='Complete'||x.p.stage!==j.stage||!current.some(t=>t.key===x.p.task_key));
    const oldHtml=history.length?`<details class="photo-history" ${j.archivedAt||j.stage==='Complete'?'open':''}><summary>${j.archivedAt||j.stage==='Complete'?'All saved job photos':'Earlier-stage photos'} (${history.length})</summary>${history.map(x=>`<div class="photo-history-row"><b>${PP.photoEsc(x.p.stage)} · ${PP.photoEsc(x.p.task_label)}</b><div class="task-photo-grid">${photoHtml(x.p,x.i)}</div></div>`).join('')}</details>`:'';
    el.innerHTML=`<h3>Stage Checklist & Photos</h3><p class="muted">${j.archivedAt||j.stage==='Complete'?'Completed/archived evidence: history is read-only.':'Complete the checklist tasks and attach required photos before advancing.'}</p>${checklist}<p class="muted photo-status" aria-live="polite"></p>${oldHtml}`;
    el.querySelectorAll('[data-task-complete]').forEach(btn=>btn.addEventListener('click',async()=>{
      btn.disabled=true;
      const task=current.find(t=>t.key===btn.dataset.taskComplete);
      if(task)await PP.completeJobTask(j,{...task,stage:j.stage});
      else btn.disabled=false;
    }));
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
  if(j.archivedAt||j.stage==='Complete'||task.stage!==j.stage)throw Error('This job stage is read-only.');
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
