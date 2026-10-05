PP.esc = (v) => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
PP.progress = (j) => Math.round(PP.STAGES.indexOf(j.stage) / (PP.STAGES.length - 1) * 100);
PP.sortedJobs = (cls) => PP.state.jobs
  .filter(j => j.productionClass === cls)
  .sort((a,b) => {
    const aw = a.jobType === 'Warranty' ? 0 : 1;
    const bw = b.jobType === 'Warranty' ? 0 : 1;
    return aw - bw || PP.invoiceNo(a.invoice) - PP.invoiceNo(b.invoice);
  });
PP.badge = (j) => j.jobType === 'Warranty'
  ? '<span class="badge red">WARRANTY</span>'
  : j.blocked ? '<span class="badge amber">BLOCKED</span>' : '<span class="badge green">READY</span>';

PP.render = () => {
  if (!PP.state) return;
  document.body.className = 'role-' + PP.profile.role;
  document.querySelector('#whoName').textContent = PP.profile.display_name;
  document.querySelector('#whoRole').textContent = PP.profile.role;
  document.querySelector('#approvalCount').textContent = PP.state.jobs.filter(j => j.awaitingApproval && j.stage !== 'Complete').length;
  document.querySelector('#emailCount').textContent = PP.state.emailOutbox.length;
  document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('active', b.dataset.view === PP.view));
  const titles = {schedule:'Production Schedule',calendar:'Calendar',materials:'Inventory & Machining',machinist:'Machinist Schedule',notifications:'Customer Updates',mywork:'My Work',blocked:'Blocked',approvals:'Approvals',completed:'Completed',team:'Team'};
  document.querySelector('#title').textContent = titles[PP.view] || 'Precision Production';
  const fn = PP['view_' + PP.view];
  document.querySelector('#content').innerHTML = fn ? fn() : '';
  PP.bindView();
};

PP.jobTable = (jobs) => {
  if (!jobs.length) return '<div class="empty">No jobs here.</div>';
  const canFlag = ['owner','manager'].includes(PP.profile.role);
  return `<div class="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>ClickUp tag</th><th>Flag / Type</th><th>Engine</th><th>Stage</th><th>Assigned</th><th>Planned</th><th>Status</th></tr></thead><tbody>${jobs.map(j => `
    <tr class="click" data-job="${j.id}">
      <td class="inv">${PP.esc(j.invoice)}</td>
      <td>${PP.esc(j.customer)}</td>
      <td>${(j.sourceTags||[]).length ? (j.sourceTags||[]).map(t=>`<span class="badge">${PP.esc(t)}</span>`).join(' ') : '<span class="muted">—</span>'}</td>
      <td>${canFlag ? `<select class="type-inline" data-jobtype="${j.id}">${PP.TYPES.map(t=>`<option ${t===j.jobType?'selected':''}>${PP.esc(t)}</option>`).join('')}</select>` : PP.esc(j.jobType)}</td>
      <td>${PP.esc(j.engine)}</td>
      <td>${PP.esc(j.stage)}<div class="progress"><i style="width:${PP.progress(j)}%"></i></div></td>
      <td>${PP.esc(j.assigned || 'Unassigned')}</td><td>${j.plannedDate || '—'}</td><td>${PP.badge(j)}</td>
    </tr>`).join('')}</tbody></table></div>`;
};

PP.view_schedule = () => {
  const cls = PP.list || 'customer';
  const jobs = PP.sortedJobs(cls).filter(j => j.stage !== 'Complete');
  return `<div class="tabs"><button data-list="customer" class="${cls==='customer'?'active':''}">Customer</button><button data-list="patv" class="${cls==='patv'?'active':''}">PATV / Internal</button></div>
  <div class="summary">
    <div class="stat"><span>Active</span><strong>${jobs.length}</strong></div><div class="stat"><span>Warranty</span><strong>${jobs.filter(j=>j.jobType==='Warranty').length}</strong></div>
    <div class="stat"><span>Blocked</span><strong>${jobs.filter(j=>j.blocked).length}</strong></div><div class="stat"><span>Awaiting approval</span><strong>${jobs.filter(j=>j.awaitingApproval).length}</strong></div>
    <div class="stat"><span>Oldest invoice</span><strong>${jobs[0]?.invoice || '—'}</strong></div>
  </div>
  <div class="card"><div class="card-head"><div><h2>${cls==='customer'?'Customer Production':'PATV / Internal'}</h2><p>${cls==='customer'?'Warranty overrides; otherwise sorted by invoice number.':'Internal work stays out of customer priority.'}</p></div></div>${PP.jobTable(jobs)}</div>`;
};

PP.view_calendar = () => {
  const jobs = PP.state.jobs.filter(j => j.stage !== 'Complete' && j.plannedDate).sort((a,b)=>a.plannedDate.localeCompare(b.plannedDate));
  let body = '<div class="empty">No work has been scheduled yet.</div>';
  if (jobs.length) {
    body = `<div class="table-wrap"><table><thead><tr><th>Date</th><th>Invoice</th><th>Customer</th><th>Stage</th><th>Assigned</th></tr></thead><tbody>${jobs.map(j=>`<tr data-job="${j.id}" class="click"><td>${j.plannedDate}</td><td>${PP.esc(j.invoice)}</td><td>${PP.esc(j.customer)}</td><td>${PP.esc(j.stage)}</td><td>${PP.esc(j.assigned||'Unassigned')}</td></tr>`).join('')}</tbody></table></div>`;
  }
  return `<div class="card"><div class="card-head"><div><h2>Production Calendar</h2><p>Only intentionally scheduled work appears here.</p></div></div>${body}</div>`;
};

PP.plan = (f) => {
  const active = PP.state.jobs.filter(j => j.stage !== 'Complete' && j.productionClass === 'customer' && PP.classify(j.engine) === f.id).length;
  const override = Number(PP.state.queueOverrides[f.id] || 0);
  const queue = Math.max(active, override);
  const forecast = Math.ceil(f.hist / 365 * Number(PP.state.forecastHorizon || 60));
  return {active, override, queue, forecast, plan: Math.max(queue, forecast)};
};
PP.invPlan = (r) => {
  const f = PP.FAMILIES.find(x=>x.id===r.familyId);
  const p = PP.plan(f);
  const scheduled = PP.state.machineRuns.filter(x => x.familyId===r.familyId && x.component===r.component && ['Scheduled','In Progress'].includes(x.status)).reduce((s,x)=>s+Number(x.qty),0);
  const projected = Number(r.onHand) + Number(r.onOrder) + scheduled - p.plan;
  const make = Math.max(0, Math.ceil(Number(r.reorderPoint) - projected));
  return {...p, scheduled, projected, make};
};

PP.view_materials = () => {
  const flags = PP.state.inventory.filter(r=>PP.invPlan(r).make>0).length;
  return `<div class="summary"><div class="stat"><span>2025 mapped demand</span><strong>46</strong></div><div class="stat"><span>Forecast horizon</span><strong>${PP.state.forecastHorizon}d</strong></div><div class="stat"><span>Machine flags</span><strong>${flags}</strong></div><div class="stat"><span>Runs scheduled</span><strong>${PP.state.machineRuns.filter(r=>r.status!=='Complete').length}</strong></div><div class="stat"><span>Queue overrides</span><strong>${Object.values(PP.state.queueOverrides).filter(Boolean).length}</strong></div></div>
  <div class="card"><div class="card-head"><div><h2>Queue demand</h2><p>Enter a planned queue when you know more engines are coming than are entered individually.</p></div></div><div class="table-wrap"><table><thead><tr><th>Family</th><th>2025 units</th><th>Active</th><th>Planned queue</th><th>Plan for</th></tr></thead><tbody>${PP.FAMILIES.map(f=>{const p=PP.plan(f);return `<tr><td>${f.label}</td><td>${f.hist}</td><td>${p.active}</td><td><input class="queue-edit" data-q="${f.id}" type="number" min="0" value="${p.override||''}" placeholder="${p.active}"></td><td><b>${p.plan}</b></td></tr>`}).join('')}</tbody></table></div></div>
  <div class="card"><div class="card-head"><div><h2>Inventory → machining trigger</h2><p>When ready + incoming cannot cover queue/forecast plus buffer, schedule a dedicated machine run.</p></div><button class="btn primary" data-schedule-all>Schedule all flagged</button></div><div class="table-wrap"><table><thead><tr><th>Family</th><th>Component</th><th>Ready</th><th>Incoming</th><th>Buffer</th><th>Projected</th><th>Action</th></tr></thead><tbody>${PP.state.inventory.map(r=>{const f=PP.FAMILIES.find(x=>x.id===r.familyId);const p=PP.invPlan(r);return `<tr><td>${f.label}</td><td>${r.component}</td><td><input class="num" data-inv="${r.id}" data-field="onHand" type="number" value="${r.onHand}"></td><td><input class="num" data-inv="${r.id}" data-field="onOrder" type="number" value="${r.onOrder}"></td><td><input class="num" data-inv="${r.id}" data-field="reorderPoint" type="number" value="${r.reorderPoint}"></td><td class="${p.projected<r.reorderPoint?'negative':''}">${p.projected}</td><td>${p.make?`<button class="btn" data-machine="${r.id}">Machine ${p.make}</button>`:'<span class="badge green">Covered</span>'}</td></tr>`}).join('')}</tbody></table></div></div>`;
};

PP.view_machinist = () => {
  const runs = PP.state.machineRuns.filter(r=>r.status!=='Complete').sort((a,b)=>a.date.localeCompare(b.date));
  return `<div class="card"><div class="card-head"><div><h2>Dedicated machinist schedule</h2><p>Machine work is separate from the customer calendar.</p></div></div><div class="machine-list">${runs.length ? runs.map(r=>{const f=PP.FAMILIES.find(x=>x.id===r.familyId);return `<div class="machine-run ${r.status==='In Progress'?'live':''}"><b>${r.date}</b><div><strong>${f?.label}</strong><br><span class="muted">${r.component} · ${r.qty} sets</span></div><span>${r.status}</span><div><button class="btn" data-run-start="${r.id}">Start</button> <button class="btn primary" data-run-done="${r.id}">Complete</button></div></div>`}).join('') : '<div class="empty">No machine runs scheduled.</div>'}</div></div>`;
};

PP.view_notifications = () => {
  const s = PP.state.notificationSettings, out = PP.state.emailOutbox;
  return `<div class="toolbar"><label>Stale after <input class="num" id="staleDays" type="number" value="${s.staleDays}"> days</label><button class="btn" data-scan-email>Check stale jobs</button></div><div class="card"><div class="card-head"><div><h2>Email outbox</h2><p>Delivery provider is not connected yet; messages are queued here safely.</p></div></div>${out.length ? out.map(e=>{const j=PP.state.jobs.find(x=>x.id===e.jobId);return `<div class="email-row ${e.status==='Needs Review'?'review':''}"><b>${j?.invoice||''}</b><div><strong>${PP.esc(e.subject)}</strong><p>${PP.esc(e.body)}</p></div><span>${e.status}</span><button class="btn" data-email-cancel="${e.id}">Cancel</button></div>`}).join('') : '<div class="empty">Outbox is clear.</div>'}</div>`;
};
PP.view_mywork = () => PP.jobTable(PP.state.jobs.filter(j=>j.stage!=='Complete'&&j.assigned===PP.profile.display_name));
PP.view_blocked = () => PP.jobTable(PP.state.jobs.filter(j=>j.blocked&&j.stage!=='Complete'));
PP.view_approvals = () => PP.jobTable(PP.state.jobs.filter(j=>j.awaitingApproval&&j.stage!=='Complete'));
PP.view_completed = () => PP.jobTable(PP.state.jobs.filter(j=>j.stage==='Complete').sort((a,b)=>PP.invoiceNo(b.invoice)-PP.invoiceNo(a.invoice)));
PP.view_team = () => `<div class="card"><div class="card-head"><div><h2>Team</h2><p>New signups remain inactive until the owner approves them.</p></div></div>${PP.team.map(p=>`<div class="team-row"><div><strong>${PP.esc(p.display_name)}</strong><small>${p.id===PP.user.id?'Your account':'Team account'}</small></div><select data-role="${p.id}" ${p.id===PP.user.id?'disabled':''}><option value="technician" ${p.role==='technician'?'selected':''}>Technician</option><option value="manager" ${p.role==='manager'?'selected':''}>Manager</option><option value="owner" ${p.role==='owner'?'selected':''}>Owner</option></select><label><input type="checkbox" data-active="${p.id}" ${p.active?'checked':''} ${p.id===PP.user.id?'disabled':''}> Active</label><button class="btn" data-team-save="${p.id}" ${p.id===PP.user.id?'disabled':''}>Save</button></div>`).join('')}</div>`;

PP.bindView = () => {
  document.querySelectorAll('[data-job]').forEach(x=>x.onclick=e=>{if(e.target.closest('[data-jobtype]'))return;PP.openJob(x.dataset.job)});
  document.querySelectorAll('[data-jobtype]').forEach(x=>x.onchange=e=>{e.stopPropagation();let j=PP.state.jobs.find(j=>j.id===x.dataset.jobtype);if(!j)return;j.jobType=x.value;if(x.value==='Stock / Internal')j.productionClass='patv';j.events=j.events||[];j.events.push({time:new Date().toISOString(),text:'Flag / type changed to '+x.value,by:PP.profile.display_name});PP.save();PP.render()});
  document.querySelectorAll('[data-list]').forEach(x=>x.onclick=()=>{PP.list=x.dataset.list;PP.render()});
  document.querySelectorAll('[data-q]').forEach(x=>x.onchange=()=>{PP.state.queueOverrides[x.dataset.q]=Number(x.value)||0;PP.save();PP.render()});
  document.querySelectorAll('[data-inv]').forEach(x=>x.onchange=()=>{const r=PP.state.inventory.find(i=>i.id===x.dataset.inv);r[x.dataset.field]=Number(x.value)||0;PP.save();PP.render()});
  document.querySelector('[data-schedule-all]')?.addEventListener('click',PP.scheduleAll);
  document.querySelectorAll('[data-machine]').forEach(x=>x.onclick=()=>PP.scheduleRun(x.dataset.machine));
  document.querySelectorAll('[data-run-start]').forEach(x=>x.onclick=()=>PP.runStart(x.dataset.runStart));
  document.querySelectorAll('[data-run-done]').forEach(x=>x.onclick=()=>PP.runDone(x.dataset.runDone));
  document.querySelector('[data-scan-email]')?.addEventListener('click',PP.scanStale);
  document.querySelectorAll('[data-email-cancel]').forEach(x=>x.onclick=()=>{PP.state.emailOutbox=PP.state.emailOutbox.filter(e=>e.id!==x.dataset.emailCancel);PP.save();PP.render()});
  document.querySelectorAll('[data-team-save]').forEach(x=>x.onclick=()=>PP.saveMember(x.dataset.teamSave));
  document.querySelector('#staleDays')?.addEventListener('change',e=>{PP.state.notificationSettings.staleDays=Number(e.target.value)||3;PP.save()});
};
