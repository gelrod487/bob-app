/* BOB admin console. Everything here renders other people's data into innerHTML, and most
   of it (names, emails, IMO strings, feedback text, audit detail) is free text typed by a
   customer — so every interpolated value goes through escapeHtml(). */

const PLAN_LABEL = { individual: 'Producer', producer_plus: 'Producer Plus', agency_owner: 'Agency' };

function escapeHtml(value){
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
function fmtDate(v){ return v ? new Date(v).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' }) : '—'; }
function fmtDateTime(v){ return v ? new Date(v).toLocaleString(undefined, { month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit' }) : '—'; }
function fmtAgo(v){
  if (!v) return 'never';
  const mins = Math.floor((Date.now() - new Date(v).getTime()) / 60000);
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 48) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const tabBody = document.getElementById('tabBody');
const statusEl = document.getElementById('statusMsg');

/* ---- modal ---- */
function openAdminModal(html, opts){
  closeAdminModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'adminModal';
  overlay.innerHTML = `<div class="modal-box${opts && opts.wide ? ' modal-wide' : ''}">${html}</div>`;
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeAdminModal(); });
  document.body.appendChild(overlay);
}
function closeAdminModal(){ const m = document.getElementById('adminModal'); if (m) m.remove(); }

/* ================= CUSTOMERS ================= */
const customerState = { q: '', page: 1 };

async function renderCustomers(){
  tabBody.innerHTML = `
    <div class="panel">
      <div style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
        <input id="customerSearch" placeholder="Search name, email, or IMO" value="${escapeHtml(customerState.q)}" style="flex:1; min-width:220px;">
      </div>
      <div id="customerTable"><p class="helptext">Loading…</p></div>
    </div>`;
  let searchTimer;
  document.getElementById('customerSearch').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => { customerState.q = e.target.value.trim(); customerState.page = 1; loadCustomers(); }, 250);
  });
  await loadCustomers();
}

async function loadCustomers(){
  const el = document.getElementById('customerTable');
  if (!el) return;
  const data = await apiFetch(`/api/admin/producers?q=${encodeURIComponent(customerState.q)}&page=${customerState.page}`);
  const pages = Math.max(Math.ceil(data.total / data.pageSize), 1);
  el.innerHTML = `
    <table>
      <thead><tr><th>Customer</th><th>IMO</th><th>Plan</th><th>Status</th><th>Trial ends</th><th>Last seen</th><th>Clients</th><th>Joined</th></tr></thead>
      <tbody>${data.items.map((p) => `
        <tr class="row-clickable" data-id="${escapeHtml(p.id)}">
          <td>${escapeHtml(p.name)}<br><span class="helptext">${escapeHtml(p.email)}</span></td>
          <td>${escapeHtml(p.imo) || '—'}</td>
          <td>${escapeHtml(PLAN_LABEL[p.subscriptionTier] || p.subscriptionTier)}</td>
          <td><span class="tag ${p.subscriptionStatus === 'active' ? 'active-pol' : 'pending'}">${escapeHtml(p.subscriptionStatus)}</span>${p.isComped ? ' <span class="tag approved">comped</span>' : ''}</td>
          <td>${fmtDate(p.trialEndsAt)}</td>
          <td>${escapeHtml(fmtAgo(p.lastSeenAt))}</td>
          <td>${p.clientCount}</td>
          <td>${fmtDate(p.createdAt)}</td>
        </tr>`).join('') || '<tr><td colspan="8" class="helptext">No customers match.</td></tr>'}</tbody>
    </table>
    <div style="display:flex; align-items:center; gap:12px; margin-top:14px;">
      <button class="ghost" type="button" id="custPrev" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
      <span class="helptext">Page ${data.page} of ${pages} · ${data.total} customer${data.total === 1 ? '' : 's'}</span>
      <button class="ghost" type="button" id="custNext" ${data.page >= pages ? 'disabled' : ''}>Next</button>
    </div>`;
  el.querySelectorAll('tr[data-id]').forEach((row) => { row.onclick = () => openCustomer(row.dataset.id); });
  document.getElementById('custPrev').onclick = () => { customerState.page--; loadCustomers(); };
  document.getElementById('custNext').onclick = () => { customerState.page++; loadCustomers(); };
}

async function openCustomer(id){
  const p = await apiFetch(`/api/admin/producers/${encodeURIComponent(id)}`);
  const c = p.counts;
  openAdminModal(`
    <div class="modal-head"><div><h2>${escapeHtml(p.name)}</h2><span class="helptext">${escapeHtml(p.email)}</span></div><button class="modal-close" id="closeCust" type="button">×</button></div>

    <div class="detail-grid">
      <div class="detail-item"><div class="dlabel">Joined</div><div class="dvalue">${fmtDate(p.createdAt)}</div></div>
      <div class="detail-item"><div class="dlabel">Last sign-in</div><div class="dvalue">${fmtDateTime(p.lastSignInAt)}</div></div>
      <div class="detail-item"><div class="dlabel">Last seen in app</div><div class="dvalue">${fmtDateTime(p.lastSeenAt)}</div></div>
      <div class="detail-item"><div class="dlabel">Trial ends</div><div class="dvalue">${fmtDate(p.trialEndsAt)}${p.trialEndsAtOverride ? ' (extended)' : ''}</div></div>
      <div class="detail-item"><div class="dlabel">IMO</div><div class="dvalue">${escapeHtml(p.imo) || '—'}</div></div>
      <div class="detail-item"><div class="dlabel">Agency</div><div class="dvalue">${escapeHtml(p.agencyName) || '—'}</div></div>
      <div class="detail-item"><div class="dlabel">Stripe customer</div><div class="dvalue" style="word-break:break-all;">${escapeHtml(p.stripeCustomerId) || '—'}</div></div>
      <div class="detail-item"><div class="dlabel">Stripe subscription</div><div class="dvalue" style="word-break:break-all;">${escapeHtml(p.stripeSubscriptionId) || '—'}</div></div>
    </div>
    <p class="helptext">${c.clients} clients · ${c.policies} policies · ${c.commissionEntries} commission entries · ${c.expenses} costs · ${c.activityDays} activity days · ${c.ownerDraws} draws</p>

    <h3 style="margin:18px 0 10px; font-size:.95rem;">Account</h3>
    <div class="detail-grid">
      <div><label>Plan</label><select id="custTier">
        ${Object.entries(PLAN_LABEL).map(([k, v]) => `<option value="${k}" ${k === p.subscriptionTier ? 'selected' : ''}>${v}</option>`).join('')}
      </select></div>
      <div><label>Comped (free, skips Stripe)</label><select id="custComped">
        <option value="false" ${!p.isComped ? 'selected' : ''}>No</option>
        <option value="true" ${p.isComped ? 'selected' : ''}>Yes — treat as paid</option>
      </select></div>
      <div class="full" style="grid-column:1/-1;"><label>Extend trial</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <button class="ghost" type="button" data-extend="7">+7 days</button>
          <button class="ghost" type="button" data-extend="14">+14 days</button>
          <button class="ghost" type="button" data-extend="30">+30 days</button>
          ${p.trialEndsAtOverride ? '<button class="ghost" type="button" id="resetTrial">Reset to default</button>' : ''}
        </div>
      </div>
      <div class="full" style="grid-column:1/-1;"><label>Internal notes (never shown to the customer)</label>
        <textarea id="custNotes" rows="3" style="width:100%;">${escapeHtml(p.adminNotes)}</textarea>
      </div>
    </div>
    <h3 style="margin:18px 0 10px; font-size:.95rem;">Billing (live from Stripe)</h3>
    <div id="custBilling"><button class="ghost" type="button" id="loadBilling">Check Stripe</button></div>

    <div class="modal-actions">
      <button class="primary" type="button" id="saveCust">Save changes</button>
      <button class="ghost" type="button" id="viewAsCust" title="Opens their account in a new tab, read-only">View as this user (read-only)</button>
      <button class="ghost" type="button" id="cancelCust">Close</button>
    </div>
    <div class="errortext" id="custError"></div>
  `, { wide: true });
  document.getElementById('viewAsCust').onclick = () => window.open(`/app.html?supportAs=${encodeURIComponent(id)}`, '_blank');
  document.getElementById('loadBilling').onclick = async () => {
    const box = document.getElementById('custBilling');
    box.innerHTML = '<p class="helptext">Asking Stripe…</p>';
    try { box.innerHTML = renderBillingSummary(await apiFetch(`/api/admin/billing/producer/${encodeURIComponent(id)}`)); }
    catch (err) { box.innerHTML = `<p class="errortext">${escapeHtml(err.message)}</p>`; }
  };

  const errEl = document.getElementById('custError');
  const send = async (body) => {
    errEl.textContent = '';
    try {
      await apiFetch(`/api/admin/producers/${encodeURIComponent(id)}`, { method: 'PUT', body });
      closeAdminModal();
      loadCustomers();
    } catch (err) { errEl.textContent = err.message; }
  };
  document.getElementById('closeCust').onclick = closeAdminModal;
  document.getElementById('cancelCust').onclick = closeAdminModal;
  document.querySelectorAll('[data-extend]').forEach((b) => {
    b.onclick = () => send({ extendTrialDays: Number(b.dataset.extend) });
  });
  const reset = document.getElementById('resetTrial');
  if (reset) reset.onclick = () => send({ trialEndsAt: null });
  document.getElementById('saveCust').onclick = () => {
    const body = {};
    const tier = document.getElementById('custTier').value;
    const comped = document.getElementById('custComped').value === 'true';
    const notes = document.getElementById('custNotes').value;
    if (tier !== p.subscriptionTier) body.subscriptionTier = tier;
    if (comped !== p.isComped) body.isComped = comped;
    if (notes !== (p.adminNotes || '')) body.adminNotes = notes;
    if (!Object.keys(body).length) { closeAdminModal(); return; }
    send(body);
  };
}

/* ================= IMOs ================= */
async function renderImos(){
  tabBody.innerHTML = '<p class="helptext">Loading…</p>';
  const [directory, pending] = await Promise.all([apiFetch('/api/admin/imos'), apiFetch('/api/admin/imos/pending')]);
  const directoryOptions = directory.map((d) => `<option value="${escapeHtml(d.name)}">${escapeHtml(d.name)}</option>`).join('');

  tabBody.innerHTML = `
    <div class="panel">
      <h2>Pending review</h2>
      <p class="helptext" style="margin:-8px 0 14px;">IMO names producers have typed that aren't in the directory yet. Approve a real new IMO, or merge a typo into the right one — merging rewrites every producer and rate row that used it.</p>
      <table>
        <thead><tr><th>Typed as</th><th>Producers</th><th>Rate rows</th><th>Action</th></tr></thead>
        <tbody>${pending.map((p, i) => `
          <tr>
            <td>${escapeHtml(p.name)}${p.suggestion ? `<br><span class="helptext">Looks like "${escapeHtml(p.suggestion)}"</span>` : ''}</td>
            <td>${p.producerCount}</td>
            <td>${p.rateRows}</td>
            <td style="white-space:nowrap;">
              ${p.suggestion ? `<button class="primary" type="button" data-merge-suggested="${i}">Merge into "${escapeHtml(p.suggestion)}"</button>` : ''}
              <button class="ghost" type="button" data-approve="${i}">Approve as new</button>
              <select data-merge-select="${i}"><option value="">Merge into other…</option>${directoryOptions}</select>
            </td>
          </tr>`).join('') || '<tr><td colspan="4" class="helptext">Nothing waiting — every IMO in use is in the directory.</td></tr>'}</tbody>
      </table>
    </div>

    <div class="panel">
      <h2>Directory</h2>
      <form id="addImoForm" style="display:flex; gap:10px; margin-bottom:14px; flex-wrap:wrap;">
        <input name="name" placeholder="Add an IMO name" required style="flex:1; min-width:220px;">
        <button class="primary" type="submit">Add</button>
      </form>
      <div class="errortext" id="imoError"></div>
      <table>
        <thead><tr><th>IMO</th><th>Producers</th><th>Life rates</th><th>Annuity rates</th><th></th></tr></thead>
        <tbody>${directory.map((d) => `
          <tr>
            <td>${escapeHtml(d.name)}</td>
            <td>${d.producerCount}</td>
            <td>${d.lifeRateRows}</td>
            <td>${d.annuityRateRows}</td>
            <td style="white-space:nowrap;">
              <button class="ghost" type="button" data-rename="${escapeHtml(d.id)}" data-name="${escapeHtml(d.name)}">Rename</button>
              <button class="danger" type="button" data-delete="${escapeHtml(d.id)}" data-name="${escapeHtml(d.name)}">Delete</button>
            </td>
          </tr>`).join('')}</tbody>
      </table>
    </div>`;

  const errEl = document.getElementById('imoError');
  const run = async (fn) => {
    errEl.textContent = '';
    try { await fn(); await renderImos(); } catch (err) { errEl.textContent = err.message; alert(err.message); }
  };

  document.getElementById('addImoForm').addEventListener('submit', (e) => {
    e.preventDefault();
    run(() => apiFetch('/api/admin/imos', { method: 'POST', body: { name: new FormData(e.target).get('name') } }));
  });
  tabBody.querySelectorAll('[data-approve]').forEach((b) => {
    b.onclick = () => run(() => apiFetch('/api/admin/imos', { method: 'POST', body: { name: pending[b.dataset.approve].name } }));
  });
  const confirmMerge = (from, into) => {
    if (!confirm(`Merge "${from}" into "${into}"? Every producer and rate row using "${from}" will be switched over.`)) return;
    run(() => apiFetch('/api/admin/imos/merge', { method: 'POST', body: { from, into } }));
  };
  tabBody.querySelectorAll('[data-merge-suggested]').forEach((b) => {
    const item = pending[b.dataset.mergeSuggested];
    b.onclick = () => confirmMerge(item.name, item.suggestion);
  });
  tabBody.querySelectorAll('[data-merge-select]').forEach((sel) => {
    const item = pending[sel.dataset.mergeSelect];
    sel.onchange = () => { if (sel.value) { const into = sel.value; sel.value = ''; confirmMerge(item.name, into); } };
  });
  tabBody.querySelectorAll('[data-rename]').forEach((b) => {
    b.onclick = () => {
      const next = prompt(`Rename "${b.dataset.name}" to:`, b.dataset.name);
      if (next && next.trim() && next.trim() !== b.dataset.name) {
        run(() => apiFetch(`/api/admin/imos/${encodeURIComponent(b.dataset.rename)}`, { method: 'PUT', body: { name: next.trim() } }));
      }
    };
  });
  tabBody.querySelectorAll('[data-delete]').forEach((b) => {
    b.onclick = () => {
      if (confirm(`Delete "${b.dataset.name}" from the directory?`)) {
        run(() => apiFetch(`/api/admin/imos/${encodeURIComponent(b.dataset.delete)}`, { method: 'DELETE' }));
      }
    };
  });
}

/* ================= SUGGESTIONS ================= */
async function renderSuggestions(){
  const STATUSES = ['open', 'planned', 'done', 'declined'];
  const suggestions = await apiFetch('/api/admin/suggestions');
  tabBody.innerHTML = `
    <div class="panel">
      <table>
        <thead><tr><th>Sent</th><th>Producer</th><th>Message</th><th>Status</th></tr></thead>
        <tbody>${suggestions.map((s) => `
          <tr>
            <td>${fmtDate(s.createdAt)}</td>
            <td>${escapeHtml(s.producerName)}<br><span class="helptext">${escapeHtml(s.producerEmail)}</span></td>
            <td>${escapeHtml(s.message)}</td>
            <td><select data-id="${escapeHtml(s.id)}" class="suggestionStatusSelect">${STATUSES.map((st) => `<option value="${st}" ${st === s.status ? 'selected' : ''}>${st}</option>`).join('')}</select></td>
          </tr>`).join('') || '<tr><td colspan="4" class="helptext">No suggestions yet.</td></tr>'}</tbody>
      </table>
    </div>`;
  tabBody.querySelectorAll('.suggestionStatusSelect').forEach((sel) => {
    sel.addEventListener('change', async () => {
      try { await apiFetch(`/api/admin/suggestions/${encodeURIComponent(sel.dataset.id)}`, { method: 'PUT', body: { status: sel.value } }); }
      catch (err) { alert(err.message); }
    });
  });
}

/* ================= AUDIT LOG ================= */
const auditState = { page: 1 };
async function renderAudit(){
  const data = await apiFetch(`/api/admin/audit?page=${auditState.page}`);
  const pages = Math.max(Math.ceil(data.total / data.pageSize), 1);
  tabBody.innerHTML = `
    <div class="panel">
      <p class="helptext" style="margin:-8px 0 14px;">Every change made from this console, newest first.</p>
      <table>
        <thead><tr><th>When</th><th>Admin</th><th>Action</th><th>Target</th><th>Detail</th></tr></thead>
        <tbody>${data.items.map((a) => `
          <tr>
            <td style="white-space:nowrap;">${fmtDateTime(a.createdAt)}</td>
            <td>${escapeHtml(a.adminEmail)}</td>
            <td>${escapeHtml(a.action)}</td>
            <td class="helptext" style="word-break:break-all;">${escapeHtml(a.targetProducerId) || '—'}</td>
            <td class="helptext" style="word-break:break-word;">${escapeHtml(a.detail ? JSON.stringify(a.detail) : '')}</td>
          </tr>`).join('') || '<tr><td colspan="5" class="helptext">No admin activity yet.</td></tr>'}</tbody>
      </table>
      <div style="display:flex; align-items:center; gap:12px; margin-top:14px;">
        <button class="ghost" type="button" id="auditPrev" ${data.page <= 1 ? 'disabled' : ''}>Previous</button>
        <span class="helptext">Page ${data.page} of ${pages}</span>
        <button class="ghost" type="button" id="auditNext" ${data.page >= pages ? 'disabled' : ''}>Next</button>
      </div>
    </div>`;
  document.getElementById('auditPrev').onclick = () => { auditState.page--; renderAudit(); };
  document.getElementById('auditNext').onclick = () => { auditState.page++; renderAudit(); };
}

/* ================= OVERVIEW ================= */
function statCard(label, value, sub){
  return `<div class="card"><div class="stat-label">${escapeHtml(label)}</div><div class="stat-value">${escapeHtml(value)}</div>${sub ? `<div class="stat-sub">${escapeHtml(sub)}</div>` : ''}</div>`;
}
function customerLink(p){
  return `<a href="#" data-open="${escapeHtml(p.id)}">${escapeHtml(p.name)}</a><br><span class="helptext">${escapeHtml(p.email)}</span>`;
}
async function renderOverview(){
  const o = await apiFetch('/api/admin/overview');
  const t = o.totals;
  const maxWeek = Math.max(1, ...o.signupsByWeek.map((w) => w.count));
  tabBody.innerHTML = `
    <div class="grid" style="margin-bottom:18px;">
      ${statCard('Customers', t.customers, `${o.byTier.individual} Producer · ${o.byTier.producer_plus} Plus · ${o.byTier.agency_owner} Agency`)}
      ${statCard('Paying', t.paid, t.pastDue ? `${t.pastDue} past due` : 'all current')}
      ${statCard('In free trial', t.trialing)}
      ${statCard('Trial ended, not paying', t.expiredUnconverted)}
      ${statCard('Trial → paid', o.conversion.rate === null ? '—' : o.conversion.rate + '%', `${o.conversion.paid} of ${o.conversion.decided} decided`)}
      ${statCard('Active last 7 days', o.activity.active7, `${o.activity.active30} in the last 30`)}
    </div>
    <p class="helptext" style="margin:-6px 0 18px;">"Trial → paid" is a snapshot: of customers whose trial is over (or who already pay), how many pay now. BOB doesn't keep a history of status changes, so it can't show how long conversion took. ${t.comped ? `${t.comped} comped account(s) are left out of it.` : ''}
    ${o.activityTrackedSince ? `Activity tracking began ${fmtDate(o.activityTrackedSince)} — anyone who hasn't used the app since then shows as "never".` : 'Activity tracking records the first time each customer uses the app after it was turned on, so these numbers fill in over the coming days.'}</p>

    <div class="panel">
      <h2>Signups per week</h2>
      <table><tbody>${o.signupsByWeek.map((w) => `
        <tr><td style="white-space:nowrap;">Week of ${fmtDate(w.weekStart + 'T12:00:00')}</td>
        <td><div style="background:var(--maroon,#8a3b3b); height:12px; border-radius:6px; width:${Math.round((w.count / maxWeek) * 100)}%; min-width:${w.count ? 6 : 0}px;"></div></td>
        <td style="width:40px; text-align:right;">${w.count}</td></tr>`).join('')}</tbody></table>
    </div>

    <div class="panel">
      <h2>Trials ending within 7 days</h2>
      <table><thead><tr><th>Customer</th><th>Trial ends</th><th>Days left</th></tr></thead>
      <tbody>${o.expiringSoon.map((p) => `<tr><td>${customerLink(p)}</td><td>${fmtDate(p.trialEndsAt)}</td><td>${p.daysLeft}</td></tr>`).join('') || '<tr><td colspan="3" class="helptext">None.</td></tr>'}</tbody></table>
    </div>

    <div class="panel">
      <h2>Gone quiet</h2>
      <p class="helptext" style="margin:-8px 0 14px;">Joined over a week ago, still have access, but haven't been in for 7+ days — worth a nudge.</p>
      <table><thead><tr><th>Customer</th><th>Last seen</th></tr></thead>
      <tbody>${o.quiet.map((p) => `<tr><td>${customerLink(p)}</td><td>${p.lastSeenAt ? `${p.daysSilent} days ago` : 'not since tracking began'}</td></tr>`).join('') || '<tr><td colspan="2" class="helptext">Nobody — everyone with access has been in this week.</td></tr>'}</tbody></table>
    </div>

    ${o.pastDue.length ? `<div class="panel"><h2>Payment past due</h2><table><tbody>${o.pastDue.map((p) => `<tr><td>${customerLink(p)}</td></tr>`).join('')}</tbody></table></div>` : ''}`;
  tabBody.querySelectorAll('[data-open]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); openCustomer(a.dataset.open); }; });
}

/* ================= BILLING ================= */
function renderBillingSummary(b){
  if (!b.linked) return `<p class="helptext">${escapeHtml(b.note || 'Not linked to Stripe.')}</p>`;
  if (b.customerDeleted) return `<p class="errortext">${escapeHtml(b.mismatches[0])}</p><p><a href="${escapeHtml(b.dashboardUrl)}" target="_blank" rel="noopener">Open in Stripe</a></p>`;
  const sub = b.subscription;
  const money = (cents, cur) => (cents / 100).toLocaleString(undefined, { style: 'currency', currency: (cur || 'usd').toUpperCase() });
  return `
    <p class="helptext">${b.mode === 'test' ? 'Stripe TEST mode · ' : ''}${escapeHtml(b.customer?.email || '')} · <a href="${escapeHtml(b.dashboardUrl)}" target="_blank" rel="noopener">Open in Stripe</a>${b.comped ? ' · comped account (differences from Stripe are expected)' : ''}</p>
    ${b.mismatches.length ? `<div style="background:var(--red-bg); color:var(--red); padding:10px 14px; border-radius:10px; margin-bottom:10px;"><strong>Doesn't match BOB:</strong><ul style="margin:6px 0 0 18px;">${b.mismatches.map((m) => `<li>${escapeHtml(m)}</li>`).join('')}</ul></div>` : '<p class="helptext" style="color:var(--green);">Stripe and BOB agree.</p>'}
    ${sub ? `<p class="helptext">Subscription ${escapeHtml(sub.status)}${sub.cancelAtPeriodEnd ? ' (cancels at period end)' : ''} · ${sub.tierFromPrice ? escapeHtml(PLAN_LABEL[sub.tierFromPrice]) + ' price' : 'price not recognised'} · current period ends ${fmtDate(sub.currentPeriodEnd)}</p>` : '<p class="helptext">No subscription in Stripe.</p>'}
    <table><thead><tr><th>Invoice</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>${(b.invoices || []).map((i) => `
      <tr><td>${i.hostedInvoiceUrl ? `<a href="${escapeHtml(i.hostedInvoiceUrl)}" target="_blank" rel="noopener">${escapeHtml(i.number || i.id)}</a>` : escapeHtml(i.number || i.id)}</td>
      <td>${fmtDate(i.created)}</td><td>${money(i.amountDue, i.currency)}</td><td>${escapeHtml(i.status)}</td></tr>`).join('') || '<tr><td colspan="4" class="helptext">No invoices.</td></tr>'}</tbody></table>`;
}

async function renderBilling(){
  const d = await apiFetch('/api/admin/billing');
  const group = (title, note, rows) => `
    <div class="panel">
      <h2>${escapeHtml(title)} <span class="helptext">(${rows.length})</span></h2>
      <p class="helptext" style="margin:-8px 0 14px;">${escapeHtml(note)}</p>
      <table><thead><tr><th>Customer</th><th>Plan</th><th>Status</th><th>Stripe</th></tr></thead><tbody>${rows.map((p) => `
        <tr><td>${customerLink(p)}</td><td>${escapeHtml(PLAN_LABEL[p.subscriptionTier] || p.subscriptionTier)}</td>
        <td><span class="tag ${p.subscriptionStatus === 'active' ? 'active-pol' : 'pending'}">${escapeHtml(p.subscriptionStatus)}</span></td>
        <td>${p.dashboardUrl ? `<a href="${escapeHtml(p.dashboardUrl)}" target="_blank" rel="noopener">Open</a>` : '—'}</td></tr>`).join('') || '<tr><td colspan="4" class="helptext">None.</td></tr>'}</tbody></table>
    </div>`;
  tabBody.innerHTML = `
    <p class="helptext">Stripe is in <strong>${d.mode === 'test' ? 'TEST' : 'LIVE'}</strong> mode. Open a customer and use "Check Stripe" to compare their live subscription against what BOB has stored.</p>
    ${group('Payment past due', 'Their card failed — Stripe is retrying; BOB still gives access while past due.', d.pastDue)}
    ${group('Canceled', 'Subscription ended.', d.canceled)}
    ${group('Started checkout, never subscribed', 'Reached the Stripe checkout page but no active subscription.', d.startedCheckout)}
    ${group('Comped', 'Free accounts you set up by hand — skipped by Stripe events.', d.comped)}`;
  tabBody.querySelectorAll('[data-open]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); openCustomer(a.dataset.open); }; });
}

/* ================= ANNOUNCEMENTS ================= */
function announcementState(a){
  const now = Date.now();
  if (!a.active) return 'inactive';
  if (a.startsAt && new Date(a.startsAt).getTime() > now) return 'scheduled';
  if (a.endsAt && new Date(a.endsAt).getTime() < now) return 'expired';
  return 'live';
}
async function renderAnnouncements(){
  const list = await apiFetch('/api/admin/announcements');
  tabBody.innerHTML = `
    <div class="panel">
      <h2>New announcement</h2>
      <p class="helptext" style="margin:-8px 0 14px;">Shown as a dismissible banner at the top of the app for every customer. Only the newest live one shows at a time.</p>
      <form class="entry" id="annForm">
        <div class="full"><label>Message (500 characters max)</label><textarea name="message" rows="2" maxlength="500" required style="width:100%;"></textarea></div>
        <div><label>Style</label><select name="level"><option value="info">Info</option><option value="warning">Warning</option></select></div>
        <div></div>
        <div><label>Show from (optional)</label><input type="datetime-local" name="startsAt"></div>
        <div><label>Hide after (optional)</label><input type="datetime-local" name="endsAt"></div>
        <div class="full"><button class="primary" type="submit">Publish</button></div>
        <div class="full errortext" id="annError"></div>
      </form>
    </div>
    <div class="panel">
      <h2>All announcements</h2>
      <table><thead><tr><th>Message</th><th>Style</th><th>Window</th><th>Status</th><th></th></tr></thead><tbody>${list.map((a) => {
        const st = announcementState(a);
        return `<tr><td>${escapeHtml(a.message)}</td><td>${escapeHtml(a.level)}</td>
          <td class="helptext">${a.startsAt ? fmtDateTime(a.startsAt) : 'now'} → ${a.endsAt ? fmtDateTime(a.endsAt) : 'no end'}</td>
          <td><span class="tag ${st === 'live' ? 'active-pol' : 'pending'}">${st}</span></td>
          <td style="white-space:nowrap;"><button class="ghost" type="button" data-toggle="${escapeHtml(a.id)}" data-active="${a.active}">${a.active ? 'Deactivate' : 'Activate'}</button>
          <button class="danger" type="button" data-del="${escapeHtml(a.id)}">Delete</button></td></tr>`;
      }).join('') || '<tr><td colspan="5" class="helptext">No announcements yet.</td></tr>'}</tbody></table>
    </div>`;
  const toIso = (v) => (v ? new Date(v).toISOString() : null);
  document.getElementById('annForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    document.getElementById('annError').textContent = '';
    try {
      await apiFetch('/api/admin/announcements', { method: 'POST', body: { message: f.get('message'), level: f.get('level'), startsAt: toIso(f.get('startsAt')), endsAt: toIso(f.get('endsAt')) } });
      renderAnnouncements();
    } catch (err) { document.getElementById('annError').textContent = err.message; }
  });
  tabBody.querySelectorAll('[data-toggle]').forEach((b) => {
    b.onclick = async () => {
      try { await apiFetch(`/api/admin/announcements/${encodeURIComponent(b.dataset.toggle)}`, { method: 'PUT', body: { active: b.dataset.active !== 'true' } }); renderAnnouncements(); }
      catch (err) { alert(err.message); }
    };
  });
  tabBody.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = async () => {
      if (!confirm('Delete this announcement?')) return;
      try { await apiFetch(`/api/admin/announcements/${encodeURIComponent(b.dataset.del)}`, { method: 'DELETE' }); renderAnnouncements(); }
      catch (err) { alert(err.message); }
    };
  });
}

/* ================= shell ================= */
const TABS = { overview: renderOverview, customers: renderCustomers, billing: renderBilling, imos: renderImos, announcements: renderAnnouncements, suggestions: renderSuggestions, audit: renderAudit };
async function showTab(name){
  document.querySelectorAll('#adminTabs .auth-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === name));
  try { await TABS[name](); } catch (err) { tabBody.innerHTML = `<p class="errortext">${escapeHtml(err.message)}</p>`; }
}

async function init(){
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (!session) { window.location.href = '/login.html?redirect=' + encodeURIComponent('/admin.html'); return; }
  try {
    // Cheapest admin-gated call: a 403 here is the definitive "not an admin" answer, and it
    // works even for an admin account that hasn't finished producer setup.
    await apiFetch('/api/admin/audit?page=1');
  } catch (err) {
    statusEl.textContent = err.message === 'Not authorized.' ? "This account isn't set up as an admin." : err.message;
    return;
  }
  document.getElementById('adminBody').style.display = '';
  document.querySelectorAll('#adminTabs .auth-tab').forEach((b) => { b.onclick = () => showTab(b.dataset.tab); });
  showTab('overview');
}
document.getElementById('logoutBtn').onclick = async () => { await supabaseClient.auth.signOut(); window.location.href = '/login.html'; };
init();
