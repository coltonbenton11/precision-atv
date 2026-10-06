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
  return `<div class="table-wrap"><table><thead><tr><th>Invoice</th><th>Customer</th><th>ClickUp tag</th><th>ClickUp Status</th><th>Flag / Type</th><th>Engine</th><th>Stage</th><th>Planned</th><th>Status</th></tr></thead><tbody>${jobs.map(j => `
    <tr class="click" data-job="${j.id}">
      <td class="inv">${PP.esc(j.invoice)}</td>
      <td>${PP.esc(j.customer)}</td>
      <td>${(j.sourceTags||[]).length ? (j.sourceTags||[]).map(t=>`<span class="badge">${PP.esc(t)}</span>`).join(' ') : '<span class="muted">—</span>'}</td>
      <td>${j.sourceStatus ? `<span class="badge">${PP.esc(j.sourceStatus)}</span>` : '<span class="muted">—</span>'}</td>
      <td>${canFlag ? `<select class="type-inline" data-jobtype="${j.id}">${PP.TYPES.map(t=>`<option ${t===j.jobType?'selected':''}>${PP.esc(t)}</option>`).join('')}</select>` : PP.esc(j.jobType)}</td>
      <td>${PP.esc(j.engine)}</td>
      <td>${PP.esc(j.stage)}<div class="progress"><i style="width:${PP.progress(j)}%"></i></div></td>
      <td>${j.plannedDate || '—'}</td><td>${PP.badge(j)}</td>
    </tr>`).join('')}</tbody></table></div>`;
};

PP.stageBoard = (jobs) => {
  const stages=PP.STAGES.filter(s=>s!=='Complete');
  const card=j=>`<div class="stage-job ${j.jobType==='Warranty'?'warranty':''} ${j.blocked?'blocked':''}" draggable="true" data-stage-drag="${j.id}" data-job="${j.id}">
    <div class="stage-job-top"><strong>${PP.esc(j.invoice||'No invoice')}</strong><span>${PP.esc(j.jobType)}</span></div>
    <b>${PP.esc(j.customer)}</b>
    ${j.plannedDate?`<small>Planned ${PP.esc(j.plannedDate)}</small>`:''}
  </div>`;
  return `<div class="stage-board-wrap">
    <div class="stage-board" data-stage-board>${stages.map(stage=>{const col=jobs.filter(j=>j.stage===stage);return `
      <section class="stage-column" data-stage-drop="${PP.esc(stage)}">
        <header><div><strong>${PP.esc(stage)}</strong><small>${col.length} job${col.length===1?'':'s'}</small></div></header>
        <div class="stage-column-body">${col.length?col.map(card).join(''):'<div class="stage-empty">Drop jobs here</div>'}</div>
      </section>`}).join('')}</div>
    <div class="stage-scrollbar" data-stage-scrollbar><div style="width:${stages.length*250}px;height:1px"></div></div>
  </div>`;
};

PP.view_schedule = () => {
  const cls = PP.list || 'customer';
  PP.scheduleMode = PP.scheduleMode || 'table';
  PP.scheduleSearch = PP.scheduleSearch || '';
  PP.scheduleSort = PP.scheduleSort || 'priority';
  const allJobs = PP.sortedJobs(cls).filter(j => j.stage !== 'Complete');
  const q = PP.scheduleSearch.trim().toLowerCase();
  let jobs = allJobs.filter(j => {
    if (!q) return true;
    const hay = [
      j.invoice,j.invoiceNumber,j.customer,j.engine,j.stage,j.jobType,j.sourceStatus,
      j.plannedDate,j.orderDate,j.blockerType,j.blockerNote,...(j.sourceTags||[])
    ].join(' ').toLowerCase();
    return hay.includes(q);
  });
  const stageIndex=s=>{const i=PP.STAGES.indexOf(s);return i<0?999:i};
  const sorters={
    priority:(a,b)=>((a.jobType==='Warranty'?0:1)-(b.jobType==='Warranty'?0:1))||PP.invoiceNo(a.invoice)-PP.invoiceNo(b.invoice),
    invoiceAsc:(a,b)=>PP.invoiceNo(a.invoice)-PP.invoiceNo(b.invoice),
    invoiceDesc:(a,b)=>PP.invoiceNo(b.invoice)-PP.invoiceNo(a.invoice),
    customer:(a,b)=>String(a.customer||'').localeCompare(String(b.customer||'')),
    stage:(a,b)=>stageIndex(a.stage)-stageIndex(b.stage)||PP.invoiceNo(a.invoice)-PP.invoiceNo(b.invoice),
    planned:(a,b)=>String(a.plannedDate||'9999-12-31').localeCompare(String(b.plannedDate||'9999-12-31'))||PP.invoiceNo(a.invoice)-PP.invoiceNo(b.invoice),
    blocked:(a,b)=>(Number(!!b.blocked)-Number(!!a.blocked))||PP.invoiceNo(a.invoice)-PP.invoiceNo(b.invoice)
  };
  jobs=[...jobs].sort(sorters[PP.scheduleSort]||sorters.priority);
  const body = PP.scheduleMode==='stages' ? PP.stageBoard(jobs) : PP.jobTable(jobs);
  const sync=PP.state.clickupSync||{};
  const syncLabel=sync.lastSuccessAt ? new Date(sync.lastSuccessAt).toLocaleTimeString([],{hour:'numeric',minute:'2-digit'}) : (sync.lastError ? 'Setup needed' : 'Pending');
  return `<div class="tabs"><button data-list="customer" class="${cls==='customer'?'active':''}">Customer</button><button data-list="patv" class="${cls==='patv'?'active':''}">PATV / Internal</button></div>
  <div class="summary">
    <div class="stat"><span>Active</span><strong>${allJobs.length}</strong></div><div class="stat"><span>Warranty</span><strong>${allJobs.filter(j=>j.jobType==='Warranty').length}</strong></div>
    <div class="stat"><span>Blocked</span><strong>${allJobs.filter(j=>j.blocked).length}</strong></div><div class="stat"><span>Awaiting approval</span><strong>${allJobs.filter(j=>j.awaitingApproval).length}</strong></div>
    <div class="stat"><span>Oldest invoice</span><strong>${PP.sortedJobs(cls).filter(j=>j.stage!=='Complete')[0]?.invoice || '—'}</strong></div>
    <div class="stat" title="${PP.esc(sync.lastError||'Automatic ClickUp sync every 5 minutes')}"><span>ClickUp sync</span><strong>${PP.esc(syncLabel)}</strong></div>
  </div>
  <div class="card"><div class="card-head"><div><h2>${cls==='customer'?'Customer Production':'PATV / Internal'}</h2><p>${q?`Showing ${jobs.length} of ${allJobs.length} active jobs.`:(cls==='customer'?'Warranty overrides; otherwise sorted by invoice number.':'Internal work stays out of customer priority.')}</p></div><div class="view-toggle"><button class="btn ${PP.scheduleMode==='table'?'active':''}" data-schedule-mode="table">Table</button><button class="btn ${PP.scheduleMode==='stages'?'active':''}" data-schedule-mode="stages">Stage Columns</button></div></div>
    <div class="production-tools">
      <label class="production-search"><span>Search</span><input type="search" data-schedule-search value="${PP.esc(PP.scheduleSearch)}" placeholder="Invoice, customer, engine, stage..."></label>
      <label class="production-sort"><span>Sort</span><select data-schedule-sort>
        <option value="priority" ${PP.scheduleSort==='priority'?'selected':''}>Priority / invoice</option>
        <option value="invoiceAsc" ${PP.scheduleSort==='invoiceAsc'?'selected':''}>Invoice: low to high</option>
        <option value="invoiceDesc" ${PP.scheduleSort==='invoiceDesc'?'selected':''}>Invoice: high to low</option>
        <option value="customer" ${PP.scheduleSort==='customer'?'selected':''}>Customer: A to Z</option>
        <option value="stage" ${PP.scheduleSort==='stage'?'selected':''}>Stage order</option>
        <option value="planned" ${PP.scheduleSort==='planned'?'selected':''}>Planned date</option>
        <option value="blocked" ${PP.scheduleSort==='blocked'?'selected':''}>Blocked first</option>
      </select></label>
      ${q?`<button class="btn ghost" data-clear-schedule-search>Clear</button>`:''}
    </div>
    ${body}</div>`;
};

PP.view_calendar = () => {
  PP.calendarOffset = Number(PP.calendarOffset || 0);
  PP.calendarClass = PP.calendarClass || 'customer';
  const cls = PP.calendarClass;
  const pad=n=>String(n).padStart(2,'0');
  const iso=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
  const start=new Date(); start.setHours(12,0,0,0);
  const day=start.getDay(), delta=day===0?-6:1-day;
  start.setDate(start.getDate()+delta+(PP.calendarOffset*7));
  const days=Array.from({length:7},(_,i)=>{const d=new Date(start);d.setDate(start.getDate()+i);return d});
  const end=days[6];
  const active=PP.state.jobs.filter(j=>j.stage!=='Complete' && (cls==='all'||j.productionClass===cls));
  const unscheduled=PP.sortedJobs(cls==='all'?'customer':cls).filter(j=>j.stage!=='Complete'&&!j.plannedDate);
  const allUnscheduled=cls==='all'?PP.state.jobs.filter(j=>j.stage!=='Complete'&&!j.plannedDate):unscheduled;
  const today=iso(new Date());
  const monthLabel=start.toLocaleDateString(undefined,{month:'long',day:'numeric'})+' – '+end.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
  const card=j=>`<div class="planner-job ${j.jobType==='Warranty'?'warranty':''} ${j.blocked?'blocked':''}" draggable="true" data-drag-job="${j.id}" data-job="${j.id}">
      <div class="planner-job-top"><strong>${PP.esc(j.invoice||'No invoice')}</strong><span>${PP.esc(j.jobType)}</span></div>
      <b>${PP.esc(j.customer)}</b>
      <small>${PP.esc(j.stage)}</small>
    </div>`;
  return `<div class="planner-toolbar">
      <div class="tabs planner-tabs">
        <button data-cal-class="customer" class="${cls==='customer'?'active':''}">Customer</button>
        <button data-cal-class="patv" class="${cls==='patv'?'active':''}">PATV</button>
        <button data-cal-class="all" class="${cls==='all'?'active':''}">All</button>
      </div>
      <div class="planner-nav"><button class="btn" data-cal-prev>‹</button><button class="btn" data-cal-today>Today</button><button class="btn" data-cal-next>›</button></div>
    </div>
    <div class="card planner-card">
      <div class="card-head"><div><h2>Production Planner</h2><p>${monthLabel} · Drag jobs between days to reschedule.</p></div><span class="badge">${active.length} active</span></div>
      <div class="planner-week">
        ${days.map(d=>{const key=iso(d),jobs=active.filter(j=>j.plannedDate===key).sort((a,b)=>PP.invoiceNo(a.invoice)-PP.invoiceNo(b.invoice));return `
          <section class="planner-day ${key===today?'today':''}" data-drop-date="${key}">
            <header><span>${d.toLocaleDateString(undefined,{weekday:'short'})}</span><strong>${d.getDate()}</strong><i>${jobs.length}</i></header>
            <div class="planner-drop">${jobs.map(card).join('')||'<div class="planner-empty">Drop job here</div>'}</div>
          </section>`}).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-head"><div><h3>Unscheduled</h3><p>Drag a job onto a day above to plan it.</p></div><span class="badge">${allUnscheduled.length}</span></div>
      <div class="unscheduled-grid" data-drop-unscheduled>
        ${allUnscheduled.length?allUnscheduled.map(card).join(''):'<div class="empty">Everything in this view is scheduled.</div>'}
      </div>
    </div>`;
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

PP.parseCsv = text => {
  const rows=[];let row=[],cell='',quoted=false;
  text=String(text||'').replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const ch=text[i],next=text[i+1];
    if(ch==='"'){
      if(quoted&&next==='"'){cell+='"';i++}
      else quoted=!quoted;
    }else if(ch===','&&!quoted){row.push(cell);cell=''}
    else if((ch==='\n'||ch==='\r')&&!quoted){
      if(ch==='\r'&&next==='\n')i++;
      row.push(cell);cell='';
      if(row.some(v=>String(v).trim()!==''))rows.push(row);
      row=[];
    }else cell+=ch;
  }
  if(cell!==''||row.length){row.push(cell);if(row.some(v=>String(v).trim()!==''))rows.push(row)}
  if(!rows.length)return [];
  const headers=rows[0].map(h=>String(h).trim());
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((h,i)=>[h,String(values[i]??'').trim()])));
};

PP.importInflowCsv = async file => {
  if(!file)return;
  const detail=document.querySelector('#inflowDetail');
  try{
    const text=await file.text();
    const rows=PP.parseCsv(text);
    const required=['ProductName','SKU','Location','Sublocation','Quantity'];
    const headers=rows.length?Object.keys(rows[0]):[];
    const missing=required.filter(h=>!headers.includes(h));
    if(missing.length)throw new Error('This does not look like the inFlow Stock Levels CSV. Missing: '+missing.join(', '));

    const grouped=new Map();
    let negativeRows=0,totalUnits=0;
    for(const r of rows){
      const name=String(r.ProductName||'').trim();
      const sku=String(r.SKU||'').trim();
      if(!name&&!sku)continue;
      const qty=Number(String(r.Quantity||'0').replace(/,/g,''));
      const quantity=Number.isFinite(qty)?qty:0;
      if(quantity<0)negativeRows++;
      totalUnits+=quantity;
      const key=sku?'sku:'+sku.toLowerCase():'name:'+name.toLowerCase();
      if(!grouped.has(key))grouped.set(key,{
        productId:key,name,sku,onHand:0,available:0,onOrder:null,locations:[]
      });
      const p=grouped.get(key);
      p.onHand+=quantity;p.available+=quantity;
      const location=String(r.Location||'').trim();
      const sublocation=String(r.Sublocation||'').trim();
      const lk=(location+'|'+sublocation).toLowerCase();
      let loc=p.locations.find(x=>x.key===lk);
      if(!loc){loc={key:lk,location,sublocation,quantity:0};p.locations.push(loc)}
      loc.quantity+=quantity;
    }
    const products=[...grouped.values()].sort((a,b)=>(a.sku||a.name).localeCompare(b.sku||b.name));
    PP.state.inflowInventory={
      products,
      pulledAt:new Date().toISOString(),
      sourceFile:file.name||'inFlow Stock Levels CSV',
      sourceRows:rows.length,
      negativeRows,
      totals:{onHand:totalUnits,available:totalUnits,onOrder:null}
    };
    PP.applyInflowMappings();
    PP.save();
    PP.toast('Imported '+products.length+' inFlow products from '+rows.length+' stock rows');
    PP.render();
  }catch(err){
    if(detail)detail.textContent=err?.message||'Could not import the CSV.';
    PP.toast(err?.message||'Could not import inFlow CSV');
  }
};

PP.applyInflowMappings = () => {
  const products = PP.state.inflowInventory?.products || [];
  const mappings = PP.state.inflowMappings || {};
  PP.state.inventory.forEach(row => {
    const productId = mappings[row.id];
    if (!productId) return;
    const product = products.find(p => p.productId === productId);
    if (!product) return;
    row.onHand = Number(product.onHand || 0);
    row.inflowAvailable = Number(product.available ?? product.onHand ?? 0);
    row.inflowProductId = product.productId;
    row.inflowSku = product.sku || '';
    row.inflowName = product.name || '';
    row.inflowSyncedAt = PP.state.inflowInventory.pulledAt || new Date().toISOString();
  });
};

PP.view_materials = () => {
  const flags = PP.state.inventory.filter(r=>PP.invPlan(r).make>0).length;
  const inflow=PP.state.inflowInventory||{products:[],totals:{onHand:0,available:0,onOrder:null}};
  const products=inflow.products||[];
  const mappings=PP.state.inflowMappings||{};
  const q=String(PP.inflowSearch||'').trim().toLowerCase();
  const shown=products.filter(p=>!q||[p.sku,p.name].join(' ').toLowerCase().includes(q)).slice(0,150);
  const last=inflow.pulledAt?new Date(inflow.pulledAt).toLocaleString():'Never';
  const productOptions=(selected)=>['<option value="">Not linked</option>',...products.map(p=>`<option value="${PP.esc(p.productId)}" ${p.productId===selected?'selected':''}>${PP.esc((p.sku?p.sku+' — ':'')+p.name)}</option>`)].join('');

  return `<div class="summary">
    <div class="stat"><span>2025 mapped demand</span><strong>46</strong></div>
    <div class="stat"><span>Forecast horizon</span><strong>${PP.state.forecastHorizon}d</strong></div>
    <div class="stat"><span>Machine flags</span><strong>${flags}</strong></div>
    <div class="stat"><span>Runs scheduled</span><strong>${PP.state.machineRuns.filter(r=>r.status!=='Complete').length}</strong></div>
    <div class="stat"><span>inFlow products</span><strong>${products.length}</strong></div>
  </div>

  <div class="card">
    <div class="card-head">
      <div><h2>inFlow Stock Levels Import</h2><p>Export Stock Levels from inFlow and import the CSV here. No API subscription is required.</p></div>
      <div class="actions"><label class="btn primary" for="inflowCsvFile">Import inFlow CSV</label><input id="inflowCsvFile" data-inflow-file type="file" accept=".csv,text/csv" hidden></div>
    </div>
    <p id="inflowDetail" class="muted">Last import: ${PP.esc(last)}${inflow.sourceFile?' · '+PP.esc(inflow.sourceFile):''}${inflow.sourceRows?' · '+Number(inflow.sourceRows)+' stock rows':''} · Total quantity: ${Number(inflow.totals?.onHand||0)}${inflow.negativeRows?' · '+Number(inflow.negativeRows)+' negative stock row(s)':''}</p>
    <div class="production-tools" style="margin-top:12px"><label class="production-search"><span>Search imported stock</span><input type="search" data-inflow-search value="${PP.esc(PP.inflowSearch||'')}" placeholder="SKU or product name"></label></div>
    <div class="table-wrap"><table><thead><tr><th>SKU</th><th>Product</th><th>Quantity</th><th>Location / bins</th></tr></thead><tbody>
      ${shown.length?shown.map(p=>`<tr><td>${PP.esc(p.sku||'—')}</td><td><b>${PP.esc(p.name||'Unnamed')}</b></td><td>${Number(p.onHand||0)}</td><td>${(p.locations||[]).length}</td></tr>`).join(''):'<tr><td colspan="4" class="muted">Import an inFlow Stock Levels CSV to load inventory.</td></tr>'}
    </tbody></table></div>
  </div>

  <div class="card"><div class="card-head"><div><h2>Queue demand</h2><p>Enter a planned queue when you know more engines are coming than are entered individually.</p></div></div><div class="table-wrap"><table><thead><tr><th>Family</th><th>2025 units</th><th>Active</th><th>Planned queue</th><th>Plan for</th></tr></thead><tbody>${PP.FAMILIES.map(f=>{const p=PP.plan(f);return `<tr><td>${f.label}</td><td>${f.hist}</td><td>${p.active}</td><td><input class="queue-edit" data-q="${f.id}" type="number" min="0" value="${p.override||''}" placeholder="${p.active}"></td><td><b>${p.plan}</b></td></tr>`}).join('')}</tbody></table></div></div>

  <div class="card"><div class="card-head"><div><h2>Inventory → machining trigger</h2><p>Link each production row to its matching inFlow SKU once. Every future CSV import will refresh Ready automatically. Incoming stays manual because the Stock Levels export does not include purchase-order quantities.</p></div><button class="btn primary" data-schedule-all>Schedule all flagged</button></div><div class="table-wrap"><table><thead><tr><th>Family</th><th>Component</th><th>inFlow product</th><th>Ready</th><th>Available</th><th>Incoming (manual)</th><th>Buffer</th><th>Projected</th><th>Action</th></tr></thead><tbody>${PP.state.inventory.map(r=>{const f=PP.FAMILIES.find(x=>x.id===r.familyId);const p=PP.invPlan(r);return `<tr><td>${f.label}</td><td>${r.component}</td><td><select data-inflow-map="${r.id}" style="min-width:240px">${productOptions(mappings[r.id]||'')}</select></td><td><b>${r.onHand}</b></td><td>${r.inflowAvailable==null?'—':r.inflowAvailable}</td><td><input class="num" data-inv="${r.id}" data-field="onOrder" type="number" value="${r.onOrder||0}"></td><td><input class="num" data-inv="${r.id}" data-field="reorderPoint" type="number" value="${r.reorderPoint}"></td><td class="${p.projected<r.reorderPoint?'negative':''}">${p.projected}</td><td>${p.make?`<button class="btn" data-machine="${r.id}">Machine ${p.make}</button>`:'<span class="badge green">Covered</span>'}</td></tr>`}).join('')}</tbody></table></div></div>`;
};

PP.view_machinist = () => {
  const runs = PP.state.machineRuns.filter(r=>r.status!=='Complete').sort((a,b)=>a.date.localeCompare(b.date));
  return `<div class="card"><div class="card-head"><div><h2>Dedicated machinist schedule</h2><p>Machine work is separate from the customer calendar.</p></div></div><div class="machine-list">${runs.length ? runs.map(r=>{const f=PP.FAMILIES.find(x=>x.id===r.familyId);return `<div class="machine-run ${r.status==='In Progress'?'live':''}"><b>${r.date}</b><div><strong>${f?.label}</strong><br><span class="muted">${r.component} · ${r.qty} sets</span></div><span>${r.status}</span><div><button class="btn" data-run-start="${r.id}">Start</button> <button class="btn primary" data-run-done="${r.id}">Complete</button></div></div>`}).join('') : '<div class="empty">No machine runs scheduled.</div>'}</div></div>`;
};

PP.twilioRequest = async (method='GET', payload) => {
  const { data } = await PP.sb.auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sign in again before testing SMS.');
  const options = {
    method,
    headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' },
    cache: 'no-store'
  };
  if (payload) options.body = JSON.stringify(payload);
  const response = await fetch('/api/twilio-test', options);
  const text = await response.text();
  let result = {};
  try { result = text ? JSON.parse(text) : {}; } catch { result = { error: text }; }
  if (!response.ok) throw new Error(result?.error || ('Twilio request failed (' + response.status + ')'));
  return result;
};

PP.checkTwilio = async () => {
  const state = document.querySelector('#twilioState');
  const result = document.querySelector('#twilioResult');
  if (!state) return;
  try {
    const data = await PP.twilioRequest('GET');
    state.textContent = data.configured ? 'Configured' : 'Needs setup';
    state.className = 'badge ' + (data.configured ? 'green' : 'amber');
    if (result && !data.configured) result.textContent = 'Twilio variables are missing from this Production deployment.';
  } catch (err) {
    state.textContent = 'Unavailable';
    state.className = 'badge red';
    if (result) result.textContent = err?.message || 'Could not check Twilio.';
  }
};

PP.sendTwilioTest = async () => {
  const input = document.querySelector('#twilioPhone');
  const button = document.querySelector('[data-twilio-test]');
  const result = document.querySelector('#twilioResult');
  const to = String(input?.value || '').trim();
  if (!to) {
    if (result) result.textContent = 'Enter a phone number first.';
    input?.focus();
    return;
  }
  if (button) button.disabled = true;
  if (result) result.textContent = 'Sending test text...';
  try {
    const data = await PP.twilioRequest('POST', { to });
    if (result) result.textContent = 'Sent successfully. Twilio status: ' + (data.status || 'queued');
    PP.toast('Twilio test text sent');
  } catch (err) {
    if (result) result.textContent = err?.message || 'Test failed.';
    PP.toast(err?.message || 'Twilio test failed');
  } finally {
    if (button) button.disabled = false;
  }
};

PP.view_notifications = () => {
  const s = PP.state.notificationSettings || {}, out = PP.state.emailOutbox || [], sms = [...(PP.state.smsLog||[])].reverse().slice(0,40);
  const stageChecks=(PP.SMS_STAGES||[]).map(stage=>`<label style="display:flex;gap:7px;align-items:center"><input type="checkbox" data-sms-stage="${PP.esc(stage)}" ${(s.smsStages||[]).includes(stage)?'checked':''} style="width:auto"> ${PP.esc(stage)}</label>`).join('');
  return `<div class="toolbar"><label>Stale after <input class="num" id="staleDays" type="number" value="${s.staleDays||3}"> days</label><button class="btn" data-scan-email>Check stale jobs</button></div>
  <div class="card"><div class="card-head"><div><h2>Twilio SMS Test</h2><p>Confirms the Production app can reach Twilio.</p></div><span id="twilioState" class="badge">Checking...</span></div><div class="actions"><input id="twilioPhone" type="tel" placeholder="+19365551234" style="min-width:240px"><button class="btn primary" data-twilio-test>Send test text</button></div><p id="twilioResult" class="muted">Trial accounts use Twilio's approved test template. Customer stage texts use the Precision ATV message after the Twilio account is eligible for custom business SMS.</p></div>
  <div class="card"><div class="card-head"><div><h2>Automatic Stage Texts</h2><p>Only customer jobs with a saved phone number and recorded SMS consent can be texted.</p></div><label style="display:flex;gap:8px;align-items:center"><input id="smsAuto" type="checkbox" ${s.smsAuto?'checked':''} style="width:auto"> Enabled</label></div>
    <div style="display:flex;gap:14px;flex-wrap:wrap">${stageChecks}</div>
    <p class="muted" style="margin-top:12px">Default milestones: Machining, Waiting for Parts, Ready to Build, Test, Ready for Ship, and Complete. A stage is sent only once per job after a successful delivery request.</p>
  </div>
  <div class="card"><div class="card-head"><div><h2>Text Message Log</h2><p>Automatic and manual customer text attempts from Production.</p></div><span class="badge">${sms.length}</span></div>
    ${sms.length?sms.map(x=>{const j=PP.state.jobs.find(j=>j.id===x.jobId);return `<div class="email-row ${x.status==='Failed'?'review':''}"><b>${PP.esc(x.invoice||j?.invoice||'')}</b><div><strong>${PP.esc(x.customer||j?.customer||'Customer')} · ${PP.esc(x.stage||'Manual')}</strong><p>${PP.esc(x.body||'')}</p><small class="muted">${PP.esc(x.phone||'')} · ${new Date(x.sentAt||x.createdAt).toLocaleString()}${x.error?' · '+PP.esc(x.error):''}</small></div><span>${PP.esc(x.status)}</span><span class="muted">${PP.esc(x.source||'')}</span></div>`}).join(''):'<div class="empty">No customer texts have been sent yet.</div>'}
  </div>
  <div class="card"><div class="card-head"><div><h2>Email outbox</h2><p>Delivery provider is not connected yet; messages are queued here safely.</p></div></div>${out.length ? out.map(e=>{const j=PP.state.jobs.find(x=>x.id===e.jobId);return `<div class="email-row ${e.status==='Needs Review'?'review':''}"><b>${j?.invoice||''}</b><div><strong>${PP.esc(e.subject)}</strong><p>${PP.esc(e.body)}</p></div><span>${e.status}</span><button class="btn" data-email-cancel="${e.id}">Cancel</button></div>`}).join('') : '<div class="empty">Outbox is clear.</div>'}</div>`;
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
  document.querySelectorAll('[data-schedule-mode]').forEach(x=>x.onclick=()=>{PP.scheduleMode=x.dataset.scheduleMode;PP.render()});
  document.querySelector('[data-schedule-sort]')?.addEventListener('change',e=>{PP.scheduleSort=e.target.value;PP.render()});
  document.querySelector('[data-schedule-search]')?.addEventListener('input',e=>{PP.scheduleSearch=e.target.value;const pos=e.target.selectionStart;PP.render();requestAnimationFrame(()=>{const n=document.querySelector('[data-schedule-search]');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}})});
  document.querySelector('[data-clear-schedule-search]')?.addEventListener('click',()=>{PP.scheduleSearch='';PP.render();requestAnimationFrame(()=>document.querySelector('[data-schedule-search]')?.focus())});
  document.querySelectorAll('[data-stage-drag]').forEach(x=>x.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',x.dataset.stageDrag);e.dataTransfer.effectAllowed='move'}));
  document.querySelectorAll('[data-stage-drop]').forEach(x=>{
    x.addEventListener('dragover',e=>{e.preventDefault();x.classList.add('dragover')});
    x.addEventListener('dragleave',()=>x.classList.remove('dragover'));
    x.addEventListener('drop',e=>{e.preventDefault();x.classList.remove('dragover');let id=e.dataTransfer.getData('text/plain'),j=PP.state.jobs.find(j=>j.id===id);if(!j)return;let old=j.stage,next=x.dataset.stageDrop;if(old===next)return;j.stage=next;j.stageEnteredAt=new Date().toISOString();j.awaitingApproval=false;j.pendingNext='';j.events=j.events||[];j.events.push({time:new Date().toISOString(),text:'Stage changed: '+old+' → '+next,by:PP.profile.display_name});PP.stageNotify?.(j,old,next);PP.save();PP.render()});
  });
  {const board=document.querySelector('[data-stage-board]'),bar=document.querySelector('[data-stage-scrollbar]');if(board&&bar){let lock=false;board.addEventListener('scroll',()=>{if(lock)return;lock=true;bar.scrollLeft=board.scrollLeft;requestAnimationFrame(()=>lock=false)});bar.addEventListener('scroll',()=>{if(lock)return;lock=true;board.scrollLeft=bar.scrollLeft;requestAnimationFrame(()=>lock=false)})}}
  document.querySelectorAll('[data-cal-class]').forEach(x=>x.onclick=()=>{PP.calendarClass=x.dataset.calClass;PP.render()});
  document.querySelector('[data-cal-prev]')?.addEventListener('click',()=>{PP.calendarOffset=(PP.calendarOffset||0)-1;PP.render()});
  document.querySelector('[data-cal-next]')?.addEventListener('click',()=>{PP.calendarOffset=(PP.calendarOffset||0)+1;PP.render()});
  document.querySelector('[data-cal-today]')?.addEventListener('click',()=>{PP.calendarOffset=0;PP.render()});
  document.querySelectorAll('[data-drag-job]').forEach(x=>x.addEventListener('dragstart',e=>{e.dataTransfer.setData('text/plain',x.dataset.dragJob);e.dataTransfer.effectAllowed='move'}));
  document.querySelectorAll('[data-drop-date]').forEach(x=>{
    x.addEventListener('dragover',e=>{e.preventDefault();x.classList.add('dragover')});
    x.addEventListener('dragleave',()=>x.classList.remove('dragover'));
    x.addEventListener('drop',e=>{e.preventDefault();x.classList.remove('dragover');let id=e.dataTransfer.getData('text/plain'),j=PP.state.jobs.find(j=>j.id===id);if(!j)return;j.plannedDate=x.dataset.dropDate;j.events=j.events||[];j.events.push({time:new Date().toISOString(),text:'Planned for '+j.plannedDate,by:PP.profile.display_name});PP.save();PP.render()});
  });
  document.querySelector('[data-drop-unscheduled]')?.addEventListener('dragover',e=>e.preventDefault());
  document.querySelector('[data-drop-unscheduled]')?.addEventListener('drop',e=>{e.preventDefault();let id=e.dataTransfer.getData('text/plain'),j=PP.state.jobs.find(j=>j.id===id);if(!j)return;j.plannedDate='';j.events=j.events||[];j.events.push({time:new Date().toISOString(),text:'Removed from production calendar',by:PP.profile.display_name});PP.save();PP.render()});
  document.querySelectorAll('[data-q]').forEach(x=>x.onchange=()=>{PP.state.queueOverrides[x.dataset.q]=Number(x.value)||0;PP.save();PP.render()});
  document.querySelectorAll('[data-inv]').forEach(x=>x.onchange=()=>{const r=PP.state.inventory.find(i=>i.id===x.dataset.inv);r[x.dataset.field]=Number(x.value)||0;PP.save();PP.render()});
  document.querySelector('[data-inflow-file]')?.addEventListener('change',e=>{const file=e.target.files?.[0];if(file)PP.importInflowCsv(file)});
  document.querySelector('[data-inflow-search]')?.addEventListener('input',e=>{PP.inflowSearch=e.target.value;const pos=e.target.selectionStart;PP.render();requestAnimationFrame(()=>{const n=document.querySelector('[data-inflow-search]');if(n){n.focus();try{n.setSelectionRange(pos,pos)}catch(_){}}})});
  document.querySelectorAll('[data-inflow-map]').forEach(x=>x.addEventListener('change',()=>{PP.state.inflowMappings[x.dataset.inflowMap]=x.value||'';PP.applyInflowMappings();PP.save();PP.render();PP.toast(x.value?'inFlow item linked':'inFlow link removed')}));
  document.querySelector('[data-schedule-all]')?.addEventListener('click',PP.scheduleAll);
  document.querySelectorAll('[data-machine]').forEach(x=>x.onclick=()=>PP.scheduleRun(x.dataset.machine));
  document.querySelectorAll('[data-run-start]').forEach(x=>x.onclick=()=>PP.runStart(x.dataset.runStart));
  document.querySelectorAll('[data-run-done]').forEach(x=>x.onclick=()=>PP.runDone(x.dataset.runDone));
  document.querySelector('[data-scan-email]')?.addEventListener('click',PP.scanStale);
  document.querySelector('[data-twilio-test]')?.addEventListener('click',PP.sendTwilioTest);
  if (document.querySelector('#twilioState')) PP.checkTwilio();
  document.querySelector('#smsAuto')?.addEventListener('change',e=>{PP.state.notificationSettings.smsAuto=!!e.target.checked;PP.save();PP.toast(e.target.checked?'Automatic stage texts enabled':'Automatic stage texts disabled')});
  document.querySelectorAll('[data-sms-stage]').forEach(x=>x.addEventListener('change',()=>{let stage=x.dataset.smsStage,list=new Set(PP.state.notificationSettings.smsStages||[]);x.checked?list.add(stage):list.delete(stage);PP.state.notificationSettings.smsStages=[...list];PP.save()}));
  document.querySelectorAll('[data-email-cancel]').forEach(x=>x.onclick=()=>{PP.state.emailOutbox=PP.state.emailOutbox.filter(e=>e.id!==x.dataset.emailCancel);PP.save();PP.render()});
  document.querySelectorAll('[data-team-save]').forEach(x=>x.onclick=()=>PP.saveMember(x.dataset.teamSave));
  document.querySelector('#staleDays')?.addEventListener('change',e=>{PP.state.notificationSettings.staleDays=Number(e.target.value)||3;PP.save()});
};
