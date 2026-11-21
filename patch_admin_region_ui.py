from pathlib import Path
p=Path.home()/'js-torneos-pages/admin.html'
s=p.read_text()
mark='</div>\n</div>\n<div id="createScreen" class="hidden">'
assert s.count(mark)==1,("mark count",s.count(mark))
insert='''</div>
<div class="panel" id="regionAdminPanel">
  <details id="regionAdminDetails">
    <summary style="font-size:18px;font-weight:900;cursor:pointer">🌎 Confirmar región de Free Fire</summary>
    <p class="small">Para los ID cuyo apodo se verifica, pero Epinby no informa la región. Pedile al jugador una captura de <strong>Free Fire → Ajustes</strong> donde se vea la región y comprobá que su ID sea el correcto. Esta autorización es privada y dura 90 días.</p>
    <label for="regionLookupId">ID de Free Fire</label>
    <input id="regionLookupId" inputmode="numeric" autocomplete="off" maxlength="16" placeholder="Ej. 10314258356">
    <button type="button" id="regionLookupBtn" class="secondary" style="margin:12px 0">🔍 Consultar apodo</button>
    <div id="regionLookupResult" role="status" aria-live="polite" class="small" style="margin:10px 0;white-space:pre-wrap"></div>
    <div id="regionApprovalInputs" class="hidden" style="margin-top:15px">
      <label for="regionAdminChoice">Región que muestra la captura de Free Fire</label>
      <select id="regionAdminChoice">
        <option value="">Seleccioná una región…</option>
        <option value="SAC">SAC · Sudamérica / Sur</option>
        <option value="NA">NA / NAC · Norte</option>
        <option value="US">US · Estados Unidos</option>
        <option value="BR">BR · Brasil</option>
        <option value="EU">EU · Europa</option>
        <option value="IND">IND · India</option>
        <option value="ME">ME · Oriente Medio</option>
        <option value="SG">SG · Singapur / Asia</option>
        <option value="TW">TW · Taiwán</option>
        <option value="VN">VN · Vietnam</option>
        <option value="CIS">CIS</option>
        <option value="PK">PK · Pakistán</option>
        <option value="BD">BD · Bangladés</option>
        <option value="TH">TH · Tailandia</option>
        <option value="ID">ID · Indonesia</option>
      </select>
      <label style="display:flex;gap:9px;align-items:flex-start;margin-top:14px">
        <input id="regionProofSeen" type="checkbox" style="width:22px;height:22px;flex:none;margin-top:2px">
        <span>Confirmo que revisé la captura del juego, comprobé el ID y la región; no estoy suponiendo la región por el apodo.</span>
      </label>
      <div class="two-actions" style="margin-top:16px">
        <button type="button" id="regionApproveBtn">✓ Confirmar región</button>
        <button type="button" id="regionRevokeBtn" class="secondary">Revocar</button>
      </div>
    </div>
    <p id="regionAdminFeedback" class="small" role="status" aria-live="polite"></p>
  </details>
</div>
</div>
<div id="createScreen" class="hidden">'''
s=s.replace(mark,insert)
assert s.count('admin-region.js?v=1.0.0')==0
old='<script src="admin-extra.js?v=0.5.1"></script>'
assert s.count(old)==1
s=s.replace(old,old+'<script src="admin-region.js?v=1.0.0"></script>')
p.write_text(s)
print("ADMIN_REGION_UI_ADDED")
