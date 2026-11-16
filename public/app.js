const $=id=>document.getElementById(id);
let scryfallCards=null,allCards=[],filtered=[],visible=0;const PAGE_SIZE=60;let observer;let loadingScryfall=null;
function clean(v){return String(v??'').trim()}
function cardNameKey(v){return clean(v).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ')}
function normCard(c,source='scryfall'){const name=clean(c.name??c['Card Name']??c.Name);return {name,type:clean(c.type??c.type_line??c['Card Type']??c.Type),set:clean(c.set_name??c.set??c['Set Name']??c.Set),setCode:clean(c.set_code??c.setCode??(source==='scryfall'?c.set:'')),collector:clean(c.collector_number??c.collector??''),color:Array.isArray(c.colors)?c.colors.join('')||'Colorless':clean(c.color??c['Casting Color']??c.Color),text:clean(c.oracle_text??c.text??c['Card Text']??c.Text),flavor:clean(c.flavor_text??c.flavor??c['Flavor Text']??c.Flavor),value:clean(c.value??c['Current Value']??c.Value),image:clean(c.image_url??c.image??c['Image URL']??c.ImageURL),rarity:clean(c.rarity),artist:clean(c.artist??c.Artist??''),manaValue:Number(c.cmc??c.mana_value??0),manaCost:clean(c.mana_cost),colorIdentity:Array.isArray(c.color_identity)?c.color_identity:[],id:clean(c.id??c.scryfall_id),oracleId:clean(c.oracle_id),layout:clean(c.layout),power:clean(c.power),toughness:clean(c.toughness),loyalty:clean(c.loyalty),keywords:Array.isArray(c.keywords)?c.keywords:[],legalities:c.legalities||null,prices:c.prices||null,purchaseUris:c.purchase_uris||null,scryfallUri:clean(c.scryfall_uri),source};}
function parseCSV(text){let rows=[],row=[],field='',quoted=false;for(let i=0;i<text.length;i++){const ch=text[i];if(quoted){if(ch==='"'&&text[i+1]==='"'){field+='"';i++}else if(ch==='"')quoted=false;else field+=ch}else{if(ch==='"')quoted=true;else if(ch===','){row.push(field);field=''}else if(ch==='\n'){row.push(field);rows.push(row);row=[];field=''}else if(ch!=='\r')field+=ch}}if(field.length||row.length){row.push(field);rows.push(row)}if(!rows.length)return[];const headers=rows.shift().map(x=>x.trim().replace(/^\uFEFF/,''));return rows.filter(r=>r.some(v=>v.trim())).map(r=>Object.fromEntries(headers.map((h,i)=>[h,r[i]??''])))}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function options(id,values,label){const el=$(id),old=el.value;el.innerHTML=`<option value="">${label}</option>`+values.filter(Boolean).sort((a,b)=>a.localeCompare(b)).map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('');if(values.includes(old))el.value=old}
function initializeFilters(){options('setFilter',[...new Set(allCards.map(c=>c.set))],'All sets');options('colorFilter',[...new Set(allCards.map(c=>c.color))],'All colors');options('artistFilter',[...new Set(allCards.map(c=>c.artist))],'All artists');setupAdvancedFilters()}


(function addAdvancedSearchStyles(){
  if(document.getElementById('advancedSearchStyle'))return;
  const style=document.createElement('style');
  style.id='advancedSearchStyle';
  style.textContent=`
    .advanced-panel{margin-top:12px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.025);overflow:hidden}
    .advanced-panel summary{cursor:pointer;list-style:none;padding:12px 14px;font-weight:650;display:flex;gap:12px;align-items:center;flex-wrap:wrap}
    .advanced-panel summary::-webkit-details-marker{display:none}
    .advanced-panel summary:after{content:"+";margin-left:auto;font-size:20px;color:var(--gold)}
    .advanced-panel[open] summary:after{content:"−"}
    .advanced-hint{font-size:12px;font-weight:400;color:var(--muted)}
    .advanced-body{display:grid;grid-template-columns:repeat(auto-fit,minmax(155px,1fr));gap:12px;padding:0 14px 14px;align-items:end}
    .advanced-body>label,.advanced-body fieldset{min-width:0}
    .advanced-body>label{display:flex;flex-direction:column;gap:6px}
    .advanced-body select,.advanced-body input[type=number]{width:100%;min-width:0}
    .advanced-body fieldset{border:1px solid var(--line);border-radius:9px;padding:8px 10px;margin:0}
    .advanced-body legend{font-size:12px;color:var(--muted);padding:0 4px}
    .mana-range{display:flex;gap:8px}
    .mana-range label{flex:1;font-size:12px;color:var(--muted)}
    .identity-filter{grid-column:span 2}
    .identity-options{display:flex;gap:10px;flex-wrap:wrap}
    .identity-options label,.legendary-filter{display:flex;align-items:center;gap:5px;font-size:13px}
    .legendary-filter{align-self:center;flex-direction:row!important;padding:8px 0}
    @media(max-width:520px){.identity-filter{grid-column:1/-1}.advanced-panel summary{align-items:flex-start}}
  `;
  document.head.appendChild(style);
})();

function setupAdvancedFilters(){
  if($('advancedFilters'))return;
  const filters=document.querySelector('.filters');
  if(!filters)return;
  const panel=document.createElement('details');
  panel.id='advancedFilters';
  panel.className='advanced-panel';
  panel.innerHTML=`
    <summary>Advanced search <span class="advanced-hint">Type, rarity, mana value, color identity</span></summary>
    <div class="advanced-body">
      <label>Card type
        <select id="typeAdvanced">
          <option value="">Any card type</option>
          <option value="Creature">Creature</option>
          <option value="Instant">Instant</option>
          <option value="Sorcery">Sorcery</option>
          <option value="Artifact">Artifact</option>
          <option value="Enchantment">Enchantment</option>
          <option value="Planeswalker">Planeswalker</option>
          <option value="Land">Land</option>
          <option value="Battle">Battle</option>
          <option value="Kindred">Kindred</option>
        </select>
      </label>
      <label>Rarity
        <select id="rarityAdvanced">
          <option value="">Any rarity</option>
          <option value="common">Common</option>
          <option value="uncommon">Uncommon</option>
          <option value="rare">Rare</option>
          <option value="mythic">Mythic</option>
          <option value="special">Special</option>
          <option value="bonus">Bonus</option>
        </select>
      </label>
      <fieldset class="mana-range">
        <legend>Mana value</legend>
        <label>Min <input id="manaMin" type="number" min="0" max="30" step="1" inputmode="numeric" placeholder="0"></label>
        <label>Max <input id="manaMax" type="number" min="0" max="30" step="1" inputmode="numeric" placeholder="Any"></label>
      </fieldset>
      <fieldset class="identity-filter">
        <legend>Color identity must include</legend>
        <div class="identity-options">
          <label><input type="checkbox" value="W" class="identity-color"> White</label>
          <label><input type="checkbox" value="U" class="identity-color"> Blue</label>
          <label><input type="checkbox" value="B" class="identity-color"> Black</label>
          <label><input type="checkbox" value="R" class="identity-color"> Red</label>
          <label><input type="checkbox" value="G" class="identity-color"> Green</label>
        </div>
      </fieldset>
      <label class="legendary-filter"><input id="legendaryAdvanced" type="checkbox"> Legendary cards only</label>
    </div>`;
  filters.insertAdjacentElement('afterend',panel);
  panel.querySelectorAll('select,input').forEach(el=>el.addEventListener('input',search));
  panel.querySelectorAll('select,input').forEach(el=>el.addEventListener('change',search));
}
function resetAdvancedFilters(){
  if(!$('advancedFilters'))return;
  $('typeAdvanced').value='';
  $('rarityAdvanced').value='';
  $('manaMin').value='';
  $('manaMax').value='';
  $('legendaryAdvanced').checked=false;
  document.querySelectorAll('.identity-color').forEach(el=>el.checked=false);
}

function sourceCards(){return scryfallCards||[]}
function updateStatus(message){$('catalogStatus').textContent=message}
function search(){if(!scryfallCards){loadScryfall().then(()=>{allCards=sourceCards();initializeFilters();readSharedSearchFromURL();runSearch()}).catch(e=>{updateStatus('Could not load the Scryfall catalog: '+e.message+'');$('count').textContent='Scryfall catalog unavailable.';runSearch()});return}runSearch()}
function runSearch(){
  allCards=sourceCards();
  const q=$('search').value.trim().toLocaleLowerCase();
  const scope=$('scope').value,set=$('setFilter').value,color=$('colorFilter').value,artist=$('artistFilter').value,sort=$('sort').value;
  const type=$('typeAdvanced')?.value||'',rarity=$('rarityAdvanced')?.value||'';
  const minRaw=$('manaMin')?.value??'',maxRaw=$('manaMax')?.value??'';
  const minMana=minRaw===''?null:Number(minRaw),maxMana=maxRaw===''?null:Number(maxRaw);
  const identity=[...document.querySelectorAll('.identity-color:checked')].map(el=>el.value);
  const legendary=$('legendaryAdvanced')?.checked||false;
  filtered=allCards.filter(c=>{
    if(set&&c.set!==set)return false;
    if(color&&c.color!==color)return false;
    if(artist&&c.artist!==artist)return false;
    if(type&&!c.type.toLocaleLowerCase().includes(type.toLocaleLowerCase()))return false;
    if(rarity&&c.rarity!==rarity)return false;
    if(minMana!==null&&c.manaValue<minMana)return false;
    if(maxMana!==null&&c.manaValue>maxMana)return false;
    if(identity.length&&!identity.every(symbol=>c.colorIdentity.includes(symbol)))return false;
    if(legendary&&!c.type.toLocaleLowerCase().includes('legendary'))return false;
    if(!q)return true;
    let values=scope==='name'?[c.name]:scope==='text'?[c.text]:scope==='flavor'?[c.flavor]:scope==='type'?[c.type]:scope==='artist'?[c.artist]:[c.name,c.artist,c.type,c.text,c.flavor,c.set,c.setCode,c.collector,c.color,c.rarity];
    return values.some(v=>v.toLocaleLowerCase().includes(q));
  });
  filtered.sort((a,b)=>sort==='name-desc'?b.name.localeCompare(a.name):sort==='set'?a.set.localeCompare(b.set)||a.name.localeCompare(b.name):a.name.localeCompare(b.name));
  visible=0;$('grid').innerHTML='';$('empty').hidden=filtered.length>0;
  $('count').textContent=`${filtered.length.toLocaleString()} card${filtered.length===1?'':'s'} found`;
  setupExportButton();$('exportCSV').disabled=filtered.length===0;setupShareButton();setupSavedSearchUI();
  const label='Scryfall catalog';$('catalogLabel').textContent=`${label} · ${allCards.length.toLocaleString()} loaded`;
  renderMore();
}

function csvCell(value){
  const text=String(value??'');
  return /[",\r\n]/.test(text)?'"'+text.replace(/"/g,'""')+'"':text;
}
function exportCSV(){
  if(!filtered.length)return;
  // ManaBox's own collection CSV uses these field names. Scryfall ID is
  // essential for identifying the exact printing; each printing is one row.
  const rows=[['Card name','Set code','Set name','Collector number','Quantity','Foil','Scryfall ID']];
  let skipped=0;
  for(const c of filtered){
    if(!c.id||!c.name){skipped++;continue}
    rows.push([c.name,c.setCode,c.set,c.collector,1,'false',c.id]);
  }
  if(rows.length===1){
    updateStatus('No exportable cards were found (Scryfall IDs are missing).');
    return;
  }
  const csv=rows.map(row=>row.map(csvCell).join(',')).join('\r\n')+'\r\n';
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='mtg-card-search-results.csv';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  updateStatus(`Exported ${ (rows.length-1).toLocaleString() } card printings to CSV${skipped?`; skipped ${skipped} cards without Scryfall IDs`:''}.`);
}

function applySearchParams(params){
  $('search').value='';$('scope').value='all';$('setFilter').value='';$('colorFilter').value='';$('artistFilter').value='';$('sort').value='name';
  resetAdvancedFilters();
  const setIfValid=(id,key)=>{
    const value=params.get(key);
    if(value!==null&&$(id))$(id).value=value;
  };
  setIfValid('search','q');setIfValid('scope','scope');setIfValid('setFilter','set');setIfValid('colorFilter','color');setIfValid('artistFilter','artist');setIfValid('sort','sort');
  setIfValid('typeAdvanced','type');setIfValid('rarityAdvanced','rarity');setIfValid('manaMin','min');setIfValid('manaMax','max');
  if($('legendaryAdvanced'))$('legendaryAdvanced').checked=params.get('legendary')==='1';
  const identity=params.get('identity')||'';
  document.querySelectorAll('.identity-color').forEach(el=>el.checked=identity.includes(el.value));
}
function readSharedSearchFromURL(){
  const params=new URLSearchParams(window.location.search);
  if(![...params.keys()].length)return;
  applySearchParams(params);
}
function buildShareURL(){
  const params=new URLSearchParams();
  const add=(key,value)=>{if(value!==undefined&&value!==null&&String(value)!=='')params.set(key,String(value))};
  add('q',$('search').value.trim());
  add('scope',$('scope').value==='all'?'':$('scope').value);
  add('set',$('setFilter').value);
  add('color',$('colorFilter').value);
  add('artist',$('artistFilter').value);
  add('sort',$('sort').value==='name'?'':$('sort').value);
  add('type',$('typeAdvanced')?.value||'');
  add('rarity',$('rarityAdvanced')?.value||'');
  add('min',$('manaMin')?.value||'');
  add('max',$('manaMax')?.value||'');
  const identity=[...document.querySelectorAll('.identity-color:checked')].map(el=>el.value).join('');
  add('identity',identity);
  if($('legendaryAdvanced')?.checked)params.set('legendary','1');
  const query=params.toString();
  return window.location.origin+window.location.pathname+(query?'?'+query:'');
}
async function shareSearch(){
  const url=buildShareURL();
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      await navigator.clipboard.writeText(url);
      updateStatus('Shareable search link copied to clipboard!');
    }else{
      const field=document.createElement('textarea');
      field.value=url;field.setAttribute('readonly','');
      field.style.position='fixed';field.style.opacity='0';
      document.body.appendChild(field);field.select();
      const copied=document.execCommand('copy');field.remove();
      updateStatus(copied?'Shareable search link copied to clipboard!':'Copy this link: '+url);
    }
  }catch(error){
    updateStatus('Copy this shareable search link: '+url);
  }
}
function setupShareButton(){
  if($('shareSearch'))return;
  const bar=document.querySelector('.resultsbar');
  if(!bar)return;
  const button=document.createElement('button');
  button.type='button';
  button.id='shareSearch';
  button.className='textbtn sharebtn';
  button.textContent='Share Search';
  button.title='Copy a link that opens this exact search and filter combination';
  button.setAttribute('aria-label','Copy shareable link for current search');
  button.addEventListener('click',shareSearch);
  const exportButton=$('exportCSV');
  if(exportButton)bar.insertBefore(button,exportButton);
  else bar.appendChild(button);
}

const SAVED_SEARCHES_KEY='mtgCardExplorer.savedSearches.v1';
function getSavedSearches(){
  try{const value=JSON.parse(localStorage.getItem(SAVED_SEARCHES_KEY)||'[]');return Array.isArray(value)?value.filter(x=>x&&typeof x.name==='string'&&typeof x.params==='string'):[]}
  catch(error){return[]}
}
function writeSavedSearches(items){
  try{localStorage.setItem(SAVED_SEARCHES_KEY,JSON.stringify(items));return true}
  catch(error){updateStatus('Could not save searches. Browser storage may be full or disabled.');return false}
}
function setupSavedSearchUI(){
  if($('saveSearch')||!document.querySelector('.resultsbar'))return;
  const bar=document.querySelector('.resultsbar');
  const save=document.createElement('button');save.type='button';save.id='saveSearch';save.className='textbtn';save.textContent='Save Search';save.title='Save the current search in this browser';
  save.addEventListener('click',()=>{
    const name=window.prompt('Name this search:');if(name===null)return;
    const trimmed=name.trim();if(!trimmed){updateStatus('Please enter a name for this saved search.');return}
    const items=getSavedSearches();
    const duplicate=items.findIndex(x=>x.name.toLocaleLowerCase()===trimmed.toLocaleLowerCase());
    const entry={name:trimmed,params:new URL(buildShareURL()).searchParams.toString(),savedAt:new Date().toISOString()};
    if(duplicate>=0){if(!window.confirm('A saved search with that name already exists. Replace it?'))return;items[duplicate]=entry}else items.push(entry);
    if(writeSavedSearches(items)){renderSavedSearches();updateStatus('Saved search: '+trimmed)}
  });
  const list=document.createElement('button');list.type='button';list.id='toggleSavedSearches';list.className='textbtn';list.textContent='Saved Searches';list.addEventListener('click',()=>{const panel=$('savedSearchPanel');panel.hidden=!panel.hidden;if(!panel.hidden)renderSavedSearches()});
  const exportButton=$('exportCSV');
  if(exportButton){bar.insertBefore(save,exportButton);bar.insertBefore(list,exportButton)}else{bar.append(save,list)}
  const panel=document.createElement('section');panel.id='savedSearchPanel';panel.hidden=true;panel.className='saved-search-panel';
  panel.innerHTML=`<div class="saved-search-heading"><strong>My Saved Searches</strong><span class="saved-search-tools"><button type="button" id="exportSavedSearches" class="textbtn">Export</button><button type="button" id="importSavedSearches" class="textbtn">Import</button><button type="button" id="closeSavedSearches" class="textbtn" aria-label="Close saved searches">Close</button></span></div><div id="savedSearchList"></div><input type="file" id="savedSearchFile" accept="application/json,.json" hidden>`;
  bar.insertAdjacentElement('afterend',panel);
  $('closeSavedSearches').addEventListener('click',()=>panel.hidden=true);
  $('exportSavedSearches').addEventListener('click',exportSavedSearches);
  $('importSavedSearches').addEventListener('click',()=>$('savedSearchFile').click());
  $('savedSearchFile').addEventListener('change',importSavedSearches);
  $('savedSearchList').addEventListener('click',e=>{
    const load=e.target.closest('[data-load-search]');const del=e.target.closest('[data-delete-search]');
    if(load){const item=getSavedSearches()[Number(load.dataset.loadSearch)];if(!item)return;applySearchParams(new URLSearchParams(item.params));search();updateStatus('Loaded saved search: '+item.name);panel.hidden=true}
    if(del){const index=Number(del.dataset.deleteSearch);const items=getSavedSearches();if(!items[index])return;if(!window.confirm('Delete saved search “'+items[index].name+'”?'))return;items.splice(index,1);if(writeSavedSearches(items))renderSavedSearches()}
  });
  addSavedSearchStyles();renderSavedSearches();
}
function renderSavedSearches(){
  if(!$('savedSearchList'))return;const items=getSavedSearches();
  $('toggleSavedSearches').textContent=`Saved Searches (${items.length})`;
  if(!items.length){$('savedSearchList').innerHTML='<p class="saved-search-empty">No saved searches yet. Run a search and choose Save Search.</p>';return}
  $('savedSearchList').innerHTML=items.map((item,index)=>`<div class="saved-search-item"><div class="saved-search-name">${esc(item.name)}</div><div class="saved-search-actions"><button type="button" class="textbtn" data-load-search="${index}">Load</button><button type="button" class="textbtn" data-delete-search="${index}">Delete</button></div></div>`).join('');
}
function exportSavedSearches(){
  const data=JSON.stringify({format:'mtg-card-explorer-saved-searches',version:1,searches:getSavedSearches()},null,2);
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mtg-card-explorer-saved-searches.json';document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importSavedSearches(event){
  const file=event.target.files?.[0];if(!file)return;
  try{const parsed=JSON.parse(await file.text());const incoming=Array.isArray(parsed)?parsed:parsed.searches;if(!Array.isArray(incoming))throw new Error('This file does not contain a saved-search list.');
    const valid=incoming.filter(x=>x&&typeof x.name==='string'&&typeof x.params==='string').map(x=>({name:x.name.trim(),params:x.params,savedAt:x.savedAt||new Date().toISOString()})).filter(x=>x.name);
    const merged=getSavedSearches();for(const item of valid){const i=merged.findIndex(x=>x.name.toLocaleLowerCase()===item.name.toLocaleLowerCase());if(i>=0)merged[i]=item;else merged.push(item)}
    if(writeSavedSearches(merged)){renderSavedSearches();updateStatus(`Imported ${valid.length} saved search${valid.length===1?'':'es'}. Existing names were updated.`)}
  }catch(error){updateStatus('Could not import saved searches: '+error.message)}
  event.target.value='';
}
function addSavedSearchStyles(){
  if($('savedSearchStyle'))return;const style=document.createElement('style');style.id='savedSearchStyle';style.textContent=`
    .saved-search-panel{margin:10px 0 16px;padding:14px;border:1px solid var(--line);border-radius:12px;background:rgba(255,255,255,.035)}
    .saved-search-panel[hidden]{display:none}.saved-search-heading,.saved-search-item{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
    .saved-search-heading{margin-bottom:10px}.saved-search-tools,.saved-search-actions{display:flex;gap:8px;align-items:center}.saved-search-item{padding:10px 0;border-top:1px solid var(--line)}
    .saved-search-name{font-weight:600;overflow-wrap:anywhere}.saved-search-empty{color:var(--muted);font-size:13px;margin:8px 0}
  `;document.head.appendChild(style);
}

function setupExportButton(){
  if($('exportCSV'))return;
  const bar=document.querySelector('.resultsbar');
  if(!bar)return;
  const button=document.createElement('button');
  button.type='button';
  button.id='exportCSV';
  button.className='textbtn exportbtn';
  button.textContent='Export CSV';
  button.title='Download all matching card printings as a ManaBox-compatible CSV';
  button.setAttribute('aria-label','Export all matching card printings to a ManaBox-compatible CSV');
  button.addEventListener('click',exportCSV);
  const reset=$('reset');
  bar.insertBefore(button,reset||null);
}

function cardHTML(c,index){const snippet=c.text||'';const printing=[c.setCode?'('+c.setCode.toUpperCase()+')':'',c.collector].filter(Boolean).join(' ');return `<article class="card" tabindex="0" role="button" data-index="${index}" aria-label="View ${esc(c.name)}"><img loading="lazy" src="${esc(c.image)}" alt="${esc(c.name)}" onerror="this.style.visibility='hidden'"><div class="name">${esc(c.name||'Unnamed card')}</div><div class="sourcebadge">${'Scryfall'}</div><div class="set">${esc(c.set)}${c.color?' · '+esc(c.color):''}</div>${printing?`<div class="printing">${esc(printing)}</div>`:''}${snippet?`<p class="snippet">${esc(snippet)}</p>`:''}${c.flavor?`<p class="flavorsnippet">${esc(c.flavor)}</p>`:''}</article>`}
function renderMore(){const end=Math.min(visible+PAGE_SIZE,filtered.length);if(end<=visible)return;const frag=document.createDocumentFragment(),temp=document.createElement('div');temp.innerHTML=filtered.slice(visible,end).map((c,i)=>cardHTML(c,visible+i)).join('');while(temp.firstChild)frag.appendChild(temp.firstChild);$('grid').appendChild(frag);visible=end}
let detailIndex=-1;
function showDetail(index){const c=filtered[index];if(!c)return;const opening=$('modal').hidden;detailIndex=index;if(opening){setMobileDetailMode(false)}$('detailImg').src=c.image;$('detailImg').alt=c.name;$('detailName').textContent=c.name;$('detailSet').textContent=['SCRYFALL',c.set,c.setCode?'('+c.setCode.toUpperCase()+')':'',c.collector].filter(Boolean).join(' · ')||'SET UNKNOWN';$('detailType').textContent=c.type;$('detailText').textContent=c.text||'No rules text in this catalog.';$('flavorBlock').hidden=!c.flavor;$('detailFlavor').textContent=c.flavor;$('detailMeta').textContent=[c.color?'Color: '+c.color:'',c.manaCost?'Mana cost: '+c.manaCost:'',c.rarity?'Rarity: '+c.rarity:'',c.artist?'Artist: '+c.artist:'',c.value?'Catalog value: '+c.value:'',c.id?'Scryfall ID: '+c.id:''].filter(Boolean).join(' · ');setupCardExplorerButton();$('modal').hidden=false;updateDetailNav();document.body.style.overflow='hidden'}
function setupCardExplorerButton(){
  if($('openCardExplorer'))return;
  const button=document.createElement('button');button.type='button';button.id='openCardExplorer';button.className='textbtn card-explorer-launch';button.textContent='Explore This Card';button.addEventListener('click',()=>{const card=filtered[detailIndex];if(!card)return;openCardExplorer(card)});
  $('detailMeta').insertAdjacentElement('afterend',button);
  addCardExplorerStyles();
}
function addCardExplorerStyles(){
  if($('cardExplorerStyle'))return;
  const style=document.createElement('style');style.id='cardExplorerStyle';style.textContent=`
    .card-explorer-launch{display:inline-flex;margin-top:14px;padding:10px 14px;border:1px solid #806b43;border-radius:10px;background:#29251d;color:#f1d49a;font-weight:750;cursor:pointer}
    .card-explorer-launch:hover{border-color:var(--gold);background:#342d20}
    .card-explorer-modal[hidden]{display:none}.card-explorer-modal{position:fixed;inset:0;z-index:15;display:grid;place-items:center;padding:18px}
    .card-explorer-shade{position:absolute;inset:0;background:#000d;backdrop-filter:blur(7px)}
    .card-explorer-window{position:relative;display:flex;flex-direction:column;width:min(1100px,100%);height:min(850px,calc(100vh - 36px));background:#191d27;border:1px solid #555d72;border-radius:18px;box-shadow:0 30px 110px #000c;overflow:hidden}
    .card-explorer-header{display:flex;align-items:center;gap:14px;padding:16px 20px;border-bottom:1px solid var(--line);background:#202431}
    .card-explorer-header h2{font-size:20px;line-height:1.2;margin:3px 0 0}.card-explorer-kicker{font-size:10px;letter-spacing:.15em;color:var(--gold);font-weight:800}
    .card-explorer-close{margin-left:auto;flex:none;width:38px;height:38px;border:1px solid var(--line);border-radius:50%;background:#303647;color:white;font-size:24px;cursor:pointer}
    .card-explorer-tabs{display:flex;gap:5px;padding:10px 16px;border-bottom:1px solid var(--line);overflow-x:auto;background:#171a22}
    .card-explorer-tab{flex:none;border:1px solid transparent;border-radius:9px;padding:9px 14px;background:transparent;color:var(--muted);font-weight:700;cursor:pointer}
    .card-explorer-tab[aria-selected=true]{border-color:#76633f;background:#302b21;color:#f1d49a}
    .card-explorer-content{padding:20px;overflow:auto;min-height:0;flex:1}.ce-overview{display:grid;grid-template-columns:minmax(180px,290px) 1fr;gap:24px;align-items:start}
    .ce-image{width:100%;max-width:290px;display:block;border-radius:13px;box-shadow:0 12px 35px #0008}.ce-type{color:#c4cad7;margin:5px 0 18px}.ce-section-title{font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin:20px 0 8px}.ce-rules{white-space:pre-line;line-height:1.65}.ce-meta{color:var(--muted);font-size:12px;line-height:1.8;margin-top:15px;padding-top:13px;border-top:1px solid var(--line)}
    .ce-price-panel{margin-top:17px;padding:14px;border:1px solid var(--line);border-radius:12px;background:#202431}.ce-price-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}.ce-price-head .ce-section-title{margin:0}.ce-price-source{font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em}.ce-price-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(105px,1fr));gap:9px;margin-top:12px}.ce-price-item{display:flex;flex-direction:column;gap:5px;padding:10px;border-radius:9px;background:#292f3d}.ce-price-item span{font-size:11px;color:var(--muted)}.ce-price-item strong{font-size:17px;color:#f1d49a}.ce-price-empty{margin-top:10px;color:var(--muted);font-size:12px}.ce-price-foot{margin-top:10px;color:var(--muted);font-size:10px;line-height:1.5}.ce-price-foot a{color:#e4c98f;text-decoration:underline;text-underline-offset:2px}.ce-rulings{display:grid;gap:11px}.ce-ruling{padding:14px 15px;border:1px solid var(--line);border-radius:12px;background:#202431}.ce-ruling-head{display:flex;align-items:center;gap:9px;flex-wrap:wrap;margin-bottom:8px}.ce-ruling-date{font-size:12px;font-weight:800;color:#f1d49a}.ce-ruling-source{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);padding:3px 7px;border:1px solid var(--line);border-radius:20px}.ce-ruling-comment{font-size:13px;line-height:1.65;color:#e0e4ec;white-space:pre-line}.ce-rulings-intro{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;margin:0 0 14px;color:var(--muted);font-size:12px}.ce-rulings-intro a{color:#e4c98f;text-decoration:underline;text-underline-offset:3px}.ce-printings{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:14px}.ce-printing{min-width:0;padding:10px;border:1px solid var(--line);border-radius:12px;background:#202431}.ce-printing img{width:100%;aspect-ratio:488/680;object-fit:contain;border-radius:8px;background:#11131a}.ce-printing-name{font-weight:700;font-size:12px;margin:7px 0 3px;overflow-wrap:anywhere}.ce-printing-meta{font-size:11px;color:var(--muted);line-height:1.5}.ce-empty{color:var(--muted);padding:20px;border:1px dashed var(--line);border-radius:12px}.ce-placeholder{max-width:650px;margin:25px auto;text-align:center;padding:35px 22px;border:1px dashed var(--line);border-radius:14px;color:var(--muted)}.ce-placeholder strong{display:block;color:var(--text);font-size:18px;margin-bottom:8px}.ce-similar-intro{color:var(--muted);margin:0 0 14px;line-height:1.55}.ce-similar-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(245px,1fr));gap:12px}.ce-similar-card{display:flex;gap:12px;align-items:flex-start;text-align:left;width:100%;min-width:0;padding:11px;border:1px solid var(--line);border-radius:12px;background:#202431;color:var(--text);cursor:pointer}.ce-similar-card:hover{border-color:#a58b58;background:#292d39}.ce-similar-card img{width:76px;flex:none;aspect-ratio:488/680;object-fit:contain;border-radius:7px;background:#11131a}.ce-similar-info{min-width:0;flex:1}.ce-similar-name{font-weight:750;line-height:1.3;overflow-wrap:anywhere}.ce-similar-type{font-size:11px;color:var(--muted);margin:4px 0 7px}.ce-similar-reason{font-size:12px;color:#e0c68f;line-height:1.45}.ce-similar-score{font-size:10px;color:var(--muted);margin-top:6px}.ce-combo-list{display:grid;gap:13px}.ce-combo{border:1px solid var(--line);border-radius:13px;background:#202431;padding:15px}.ce-combo-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}.ce-combo-title{font-size:15px;font-weight:800;margin:0}.ce-combo-badges{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.ce-combo-badge{font-size:10px;padding:4px 7px;border-radius:20px;background:#30394a;color:#d8deeb}.ce-combo-badge.infinite{background:#193b32;color:#a8e4c6}.ce-combo-section{margin-top:12px}.ce-combo-section h4{font-size:10px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);margin:0 0 5px}.ce-combo-section p,.ce-combo-section ol{font-size:12px;line-height:1.6;color:#d0d5df;margin:0;white-space:pre-line}.ce-combo-section ol{padding-left:20px}.ce-combo-source{font-size:11px;color:var(--muted);margin-top:12px}.ce-combo-source a{color:#e4c98f}.ce-combo-card-link{display:inline;padding:0;border:0;background:none;color:#e4c98f;font:inherit;text-decoration:underline;text-decoration-color:#76633f;text-underline-offset:2px;cursor:pointer}.ce-combo-card-link:hover{color:#fff1c9;text-decoration-color:#fff1c9}.ce-combo-pieces{display:flex;flex-wrap:wrap;gap:10px;margin-top:8px}.ce-combo-piece{display:flex;align-items:center;gap:8px;min-width:0;max-width:240px;padding:6px 9px 6px 6px;border:1px solid var(--line);border-radius:10px;background:#252b38;color:var(--text);font:inherit;text-align:left}.ce-combo-piece[data-ce-combo-index]{cursor:pointer}.ce-combo-piece[data-ce-combo-index]:hover{border-color:#a58b58;background:#303747}.ce-combo-piece img{display:block;width:42px;height:59px;flex:none;object-fit:contain;border-radius:4px;background:#11131a}.ce-combo-piece-name{font-size:12px;font-weight:700;line-height:1.35;overflow-wrap:anywhere}.ce-combo-piece-unavailable{font-size:12px;color:#e4c98f;overflow-wrap:anywhere}
    @media(max-width:650px){.card-explorer-modal{padding:5px}.card-explorer-window{height:calc(100vh - 10px);border-radius:13px}.card-explorer-header{padding:12px}.card-explorer-content{padding:14px}.ce-overview{grid-template-columns:1fr;gap:15px}.ce-image{max-width:210px;margin:auto}.card-explorer-tabs{padding:8px}.card-explorer-tab{padding:8px 11px;font-size:12px}.ce-printings{grid-template-columns:repeat(2,minmax(0,1fr))}}
  `;document.head.appendChild(style);
}
function ensureCardExplorerModal(){
  if($('cardExplorerModal'))return;
  const modal=document.createElement('div');modal.id='cardExplorerModal';modal.className='card-explorer-modal';modal.hidden=true;
  modal.innerHTML=`<div class="card-explorer-shade" data-ce-close="1"></div><section class="card-explorer-window" role="dialog" aria-modal="true" aria-labelledby="cardExplorerTitle"><header class="card-explorer-header"><div><div class="card-explorer-kicker">MTG CARD EXPLORER</div><h2 id="cardExplorerTitle"></h2></div><button type="button" class="card-explorer-close" data-ce-close="1" aria-label="Close Card Explorer">×</button></header><nav class="card-explorer-tabs" role="tablist" aria-label="Card information"><button type="button" class="card-explorer-tab" data-ce-tab="overview" aria-selected="true">Overview</button><button type="button" class="card-explorer-tab" data-ce-tab="printings" aria-selected="false">Printings</button><button type="button" class="card-explorer-tab" data-ce-tab="rulings" aria-selected="false">Rulings</button><button type="button" class="card-explorer-tab" data-ce-tab="combos" aria-selected="false">Combos</button><button type="button" class="card-explorer-tab" data-ce-tab="similar" aria-selected="false">Similar Cards</button></nav><div class="card-explorer-content" id="cardExplorerContent"></div></section>`;
  document.body.appendChild(modal);modal.addEventListener('click',e=>{if(e.target.dataset.ceClose){closeCardExplorer();return}const comboCard=e.target.closest('[data-ce-combo-index]');if(comboCard){const next=allCards[Number(comboCard.dataset.ceComboIndex)];if(next)openCardExplorer(next);return}const similar=e.target.closest('[data-ce-similar-index]');if(similar){const next=allCards[Number(similar.dataset.ceSimilarIndex)];if(next)openCardExplorer(next);return}const tab=e.target.closest('[data-ce-tab]');if(tab)selectCardExplorerTab(tab.dataset.ceTab)});
  document.addEventListener('keydown',e=>{if(!$('cardExplorerModal')||$('cardExplorerModal').hidden)return;if(e.key==='Escape'){closeCardExplorer();e.stopPropagation()}});
  addCardExplorerStyles();
}
let cardExplorerCard=null,cardExplorerTab='overview';
const rulingsCache=new Map();
function scryfallCardUrl(card){return card.setCode&&card.collector?'https://scryfall.com/card/'+encodeURIComponent(card.setCode.toLowerCase())+'/'+encodeURIComponent(card.collector):'https://scryfall.com/search?q='+encodeURIComponent('!"'+card.name+'"')}
async function fetchCardRulings(card){
  if(!card.id)throw new Error('This catalog entry does not include a Scryfall card ID, so its rulings cannot be looked up directly.');
  if(rulingsCache.has(card.id))return rulingsCache.get(card.id);
  const promise=fetch('https://api.scryfall.com/cards/'+encodeURIComponent(card.id)+'/rulings',{headers:{Accept:'application/json'}}).then(async response=>{
    if(!response.ok){if(response.status===404)throw new Error('Scryfall does not have a rulings record for this card.');if(response.status===429)throw new Error('Scryfall is temporarily rate-limiting requests. Please try again shortly.');throw new Error('Scryfall returned HTTP '+response.status+' while loading rulings.');}
    const payload=await response.json();return Array.isArray(payload.data)?payload.data:[];
  }).catch(error=>{if(error instanceof TypeError)throw new Error('Could not reach Scryfall. Check your internet connection and try again.');throw error});
  rulingsCache.set(card.id,promise);try{return await promise}catch(error){rulingsCache.delete(card.id);throw error}
}
function renderRuling(ruling){const date=clean(ruling.published_at);const source=clean(ruling.source)||'Official ruling';return `<article class="ce-ruling"><div class="ce-ruling-head"><time class="ce-ruling-date" datetime="${esc(date)}">${esc(date||'Date unavailable')}</time><span class="ce-ruling-source">${esc(source)}</span></div><div class="ce-ruling-comment">${esc(ruling.comment||'No ruling text supplied.')}</div></article>`}
async function renderCardRulings(card,content){
  content.innerHTML='<p class="ce-rulings-intro">Official card rulings from Scryfall, sourced from Wizards of the Coast where available. Rulings are shown newest first.</p><div class="ce-empty">Loading rulings…</div>';
  try{const rulings=await fetchCardRulings(card);if(cardExplorerCard!==card||cardExplorerTab!=='rulings'||!content.isConnected)return;
    const url=scryfallCardUrl(card);
    content.innerHTML=`<div class="ce-rulings-intro"><span>${rulings.length.toLocaleString()} ruling${rulings.length===1?'':'s'} found</span><a href="${esc(url)}" target="_blank" rel="noopener noreferrer">View card on Scryfall ↗</a></div>${rulings.length?`<div class="ce-rulings">${rulings.slice().sort((a,b)=>String(b.published_at||'').localeCompare(String(a.published_at||''))).map(renderRuling).join('')}</div>`:'<div class="ce-empty">Scryfall has no official rulings listed for this card. This is normal for many cards; it does not mean the card has no applicable rules interactions.</div>'}`;
  }catch(error){if(cardExplorerCard!==card||cardExplorerTab!=='rulings'||!content.isConnected)return;content.innerHTML=`<div class="ce-empty"><strong>Could not load rulings.</strong><p>${esc(error.message||'Scryfall is temporarily unavailable.')}</p><button type="button" class="textbtn" id="retryCardRulings">Try again</button></div>`;const retry=$('retryCardRulings');if(retry)retry.addEventListener('click',()=>{rulingsCache.delete(card.id);renderCardRulings(card,content)})}
}
function openCardExplorer(card,keepTab=false){cardExplorerCard=card;if(!keepTab)cardExplorerTab='overview';closeDetail();ensureCardExplorerModal();$('cardExplorerTitle').textContent=card.name;$('cardExplorerModal').hidden=false;document.body.style.overflow='hidden';document.querySelectorAll('.card-explorer-tab').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.ceTab===cardExplorerTab)));renderCardExplorerTab()}
function closeCardExplorer(){if(!$('cardExplorerModal'))return;$('cardExplorerModal').hidden=true;document.body.style.overflow='';cardExplorerCard=null}
function selectCardExplorerTab(tab){cardExplorerTab=tab;document.querySelectorAll('.card-explorer-tab').forEach(el=>el.setAttribute('aria-selected',String(el.dataset.ceTab===tab)));renderCardExplorerTab()}
function getCardPrintings(card){if(card.oracleId)return allCards.filter(x=>x.oracleId===card.oracleId);return allCards.filter(x=>cardNameKey(x.name)===cardNameKey(card.name))}
const SIMILAR_STOP_WORDS=new Set('this that with from your have into when then than them they their there here each other another target targets card cards creature creatures player players opponent opponents control controls battlefield graveyard library hand exile cast create gets get gain loses lose may can could would should until end turn beginning whenever when if while all any each one two three four five six seven eight nine ten a an the and or but for of to in on by as is are be it its do does not no you'.split(' '));
function similarityTokens(text){return new Set(String(text||'').toLowerCase().replace(/\{[^}]+\}/g,' ').replace(/[^a-z0-9'-]+/g,' ').split(/\s+/).filter(w=>w.length>=4&&!SIMILAR_STOP_WORDS.has(w)&&!/^\d+$/.test(w)))}
function typeParts(typeLine){const parts=String(typeLine||'').split(/[—–-]/);const main=(parts[0]||'').toLowerCase().trim().split(/\s+/).filter(Boolean);const sub=(parts.slice(1).join(' ')||'').toLowerCase().trim().split(/\s+/).filter(Boolean);return {main,sub}}
function getSimilarCards(card){
  const baseType=typeParts(card.type),baseKeywords=new Set((card.keywords||[]).map(x=>String(x).toLowerCase())),baseTokens=similarityTokens(card.text),baseIdentity=new Set(card.colorIdentity||[]);
  const candidates=new Map();
  allCards.forEach((candidate,index)=>{
    if(candidate.oracleId&&card.oracleId&&candidate.oracleId===card.oracleId)return;
    if(cardNameKey(candidate.name)===cardNameKey(card.name))return;
    const key=candidate.oracleId||cardNameKey(candidate.name);if(!key||candidates.has(key))return;
    const t=typeParts(candidate.type),sharedSub=t.sub.filter(x=>baseType.sub.includes(x)),sharedMain=t.main.filter(x=>baseType.main.includes(x));
    const sharedKeywords=(candidate.keywords||[]).filter(x=>baseKeywords.has(String(x).toLowerCase()));
    const tokens=similarityTokens(candidate.text),sharedTerms=[...tokens].filter(x=>baseTokens.has(x));
    const union=new Set([...tokens,...baseTokens]);const textRatio=union.size?sharedTerms.length/union.size:0;
    const sharedColors=(candidate.colorIdentity||[]).filter(x=>baseIdentity.has(x)).length;
    const manaDistance=Math.abs((Number(candidate.manaValue)||0)-(Number(card.manaValue)||0));
    let score=sharedSub.length*15+sharedMain.length*5+sharedKeywords.length*12+Math.min(sharedTerms.length,12)*1.7+textRatio*18+sharedColors*1.5+(manaDistance<=1?2:manaDistance<=2?1:0);
    if(candidate.type&&card.type&&candidate.type.toLowerCase()===card.type.toLowerCase())score+=4;
    if(!score)return;
    const reasons=[];
    if(sharedSub.length)reasons.push('Shares subtype: '+sharedSub.slice(0,3).map(x=>x[0].toUpperCase()+x.slice(1)).join(', '));
    if(sharedKeywords.length)reasons.push('Shared keyword: '+sharedKeywords.slice(0,3).join(', '));
    if(sharedMain.length&&!sharedSub.length)reasons.push('Same card type: '+sharedMain.slice(0,2).join(', '));
    if(sharedTerms.length>=3)reasons.push('Related rules text');
    if(!reasons.length&&sharedColors)reasons.push('Similar color identity');
    if(!reasons.length)reasons.push('Similar card characteristics');
    candidates.set(key,{card:candidate,index,score,reasons});
  });
  return [...candidates.values()].filter(x=>x.score>=7).sort((a,b)=>b.score-a.score||a.card.name.localeCompare(b.card.name)).slice(0,30);
}
function renderSimilarCards(card){
  const matches=getSimilarCards(card);
  if(!matches.length)return '<div class="ce-empty">No strong matches were found in the loaded catalog. Try another card with more defined types, keywords, or rules text.</div>';
  return `<p class="ce-similar-intro">These suggestions are ranked using shared card types and subtypes, keywords, rules-text vocabulary, color identity, and mana value. They are similarity suggestions—not confirmed combos or guaranteed functional replacements.</p><div class="ce-similar-list">${matches.map(m=>`<button type="button" class="ce-similar-card" data-ce-similar-index="${m.index}">${m.card.image?`<img loading="lazy" src="${esc(m.card.image)}" alt="${esc(m.card.name)}">`:'<span class="ce-empty">No image</span>'}<span class="ce-similar-info"><span class="ce-similar-name">${esc(m.card.name)}</span><span class="ce-similar-type">${esc(m.card.type||'Card type unavailable')} · MV ${Number(m.card.manaValue)||0}</span><span class="ce-similar-reason">${esc(m.reasons.slice(0,2).join(' · '))}</span><span class="ce-similar-score">${esc(m.card.set||'Unknown set')}${m.card.setCode?' · '+esc(m.card.setCode.toUpperCase()):''}</span></span></button>`).join('')}</div>`;
}
const SPELLBOOK_API='/api/combos';
const SPELLBOOK_SITE='https://commanderspellbook.com';
const comboCache=new Map();
function comboField(value){if(value==null)return '';if(Array.isArray(value))return value.map(comboField).filter(Boolean).join('\n');if(typeof value==='object')return String(value.feature?.name??value.template?.name??value.card?.name??value.name??value.display??value.text??value.description??'');return String(value)}
function comboCardNames(combo){const raw=combo.cards??combo.uses??combo.cardNames??combo.card_names??combo.ingredients??[];if(Array.isArray(raw))return raw.map(x=>typeof x==='string'?x:(x?.card?.name??x?.name??'')).filter(Boolean);if(typeof raw==='string')return raw.split(/\s*,\s*/).filter(Boolean);return []}
function comboContainsCard(combo,name){const key=cardNameKey(name);return comboCardNames(combo).some(n=>cardNameKey(n)===key)}
function comboList(value){if(Array.isArray(value))return value.map(comboField).filter(Boolean);if(value==null||value==='')return [];return [comboField(value)]}
function comboIsInfinite(combo){const results=comboList(combo.produces??combo.results??combo.outcomes??combo.result??combo.outcome);return results.some(x=>/infinite/i.test(x))||/infinite/i.test(comboField(combo.description??combo.name??''))}
function comboUrl(combo){const id=combo.id??combo.spellbookId??combo.spellbook_id??combo.variantId??combo.variant_id;return id?SPELLBOOK_SITE+'/combo/'+encodeURIComponent(String(id))+'/':SPELLBOOK_SITE}
async function fetchCardCombos(card){
  const key=card.oracleId||card.name;if(comboCache.has(key))return comboCache.get(key);
  const query='card:"'+String(card.name).replace(/"/g,'\\"')+'"';
  const url=SPELLBOOK_API+'?q='+encodeURIComponent(query)+'&page=1';
  const promise=fetch(url,{headers:{Accept:'application/json'}}).then(async r=>{
    if(!r.ok)throw new Error(r.status===429?'Commander Spellbook is rate-limiting requests. Please try again shortly.':'Commander Spellbook returned HTTP '+r.status);
    return r.json();
  }).then(data=>{
    const rows=Array.isArray(data)?data:(data.results??data.combos??data.variants??data.items??[]);
    if(!Array.isArray(rows))throw new Error('Commander Spellbook returned an unexpected response format.');
    return rows.filter(x=>comboContainsCard(x,card.name));
  }).catch(err=>{
    if(err instanceof TypeError)throw new Error("Could not reach the site combo proxy. The Cloudflare Function may not have deployed yet; check the deployment build logs.");
    throw err;
  });
  comboCache.set(key,promise);
  try{return await promise}catch(err){comboCache.delete(key);throw err}
}
function comboCardPieceMarkup(name){
  const index=allCards.findIndex(c=>cardNameKey(c.name)===cardNameKey(name));
  const card=index>=0?allCards[index]:null;
  const image=card?.image?`<img loading="lazy" decoding="async" fetchpriority="low" src="${esc(card.image)}" alt="${esc(name)} card image" width="42" height="59">`:'';
  const label=`<span class="ce-combo-piece-name">${esc(name)}</span>`;
  return index>=0?`<button type="button" class="ce-combo-piece" data-ce-combo-index="${index}" aria-label="Explore ${esc(name)}">${image}${label}</button>`:`<span class="ce-combo-piece">${image}<span class="ce-combo-piece-unavailable">${esc(name)}</span></span>`;
}
function renderComboCard(combo){
  const cards=comboCardNames(combo),prereq=comboList(combo.easyPrerequisites??combo.easy_prerequisites??combo.prerequisites??combo.notablePrerequisites??combo.notable_prerequisites),steps=comboList(combo.steps??combo.description??combo.instructions),results=comboList(combo.produces??combo.results??combo.outcomes??combo.result??combo.outcome),mana=comboField(combo.manaNeeded??combo.mana_needed),notes=comboField(combo.notes??combo.comment),infinite=comboIsInfinite(combo),url=comboUrl(combo),title=comboField(combo.name??combo.title)||cards.join(' + ')||'Known card combination';
  return `<article class="ce-combo"><div class="ce-combo-head"><h3 class="ce-combo-title">${esc(title)}</h3></div><div class="ce-combo-badges">${infinite?'<span class="ce-combo-badge infinite">Infinite result</span>':''}${mana?`<span class="ce-combo-badge">Mana: ${esc(mana)}</span>`:''}<span class="ce-combo-badge">${cards.length} cards</span></div><div class="ce-combo-section"><h4>Cards required</h4><div class="ce-combo-pieces">${cards.length?cards.map(comboCardPieceMarkup).join(''):'Card list unavailable'}</div></div>${prereq.length?`<div class="ce-combo-section"><h4>Prerequisites</h4><p>${esc(prereq.join('\n'))}</p></div>`:''}${steps.length?`<div class="ce-combo-section"><h4>How it works</h4>${steps.length>1?`<ol>${steps.map(x=>'<li>'+esc(x)+'</li>').join('')}</ol>`:`<p>${esc(steps[0])}</p>`}</div>`:''}${results.length?`<div class="ce-combo-section"><h4>Results</h4><p>${esc(results.join('\n'))}</p></div>`:''}${notes?`<div class="ce-combo-section"><h4>Notes</h4><p>${esc(notes)}</p></div>`:''}<div class="ce-combo-source">Combo data from <a href="${esc(url)}" target="_blank" rel="noopener noreferrer">Commander Spellbook</a></div></article>`;
}
async function renderCardCombos(card,content){
  const key=card.oracleId||card.name;
  content.innerHTML='<p class="ce-similar-intro">Searching Commander Spellbook for documented combos involving this card. Results include the listed pieces, prerequisites, instructions, and outcomes when supplied by the database.</p><div class="ce-empty">Loading known combos…</div>';
  try{
    const combos=await fetchCardCombos(card);
    if(cardExplorerCard!==card||cardExplorerTab!=='combos'||!content.isConnected)return;
    content.innerHTML=combos.length?`<p class="ce-similar-intro">Found ${combos.length} documented combo${combos.length===1?'':'s'} involving ${esc(card.name)}. Combo details are supplied by Commander Spellbook; check prerequisites and format legality before relying on an interaction.</p><div class="ce-combo-list">${combos.map(renderComboCard).join('')}</div>`:'<div class="ce-empty">No documented combos were found for this card in Commander Spellbook. That does not necessarily mean the card has no possible synergies or combos.</div>';
  }catch(err){
    if(cardExplorerCard!==card||cardExplorerTab!=='combos'||!content.isConnected)return;
    content.innerHTML=`<div class="ce-empty"><strong>Could not load combo data.</strong><p>${esc(err.message||'The combo database is temporarily unavailable.')}</p><button type="button" class="textbtn" id="retryCardCombos">Try again</button></div>`;
    const retry=$('retryCardCombos');if(retry)retry.addEventListener('click',()=>{comboCache.delete(key);renderCardCombos(card,content)});
  }
}
function formatCardPrice(value){if(value===null||value===undefined||value==='')return 'Not available';const n=Number(value);return Number.isFinite(n)?n.toLocaleString('en-US',{style:'currency',currency:'USD'}):'Not available'}
function renderCardPricePanel(card){const prices=card.prices||{};const rows=[['Nonfoil',prices.usd],['Foil',prices.usd_foil],['Etched foil',prices.usd_etched]].filter(([,v])=>v!==undefined);const tcg=card.purchaseUris?.tcgplayer;return `<section class="ce-price-panel"><div class="ce-price-head"><h3 class="ce-section-title">Current market prices</h3><span class="ce-price-source">Scryfall · USD</span></div>${rows.length?`<div class="ce-price-grid">${rows.map(([label,value])=>`<div class="ce-price-item"><span>${label}</span><strong>${formatCardPrice(value)}</strong></div>`).join('')}</div>`:'<div class="ce-price-empty">Price information is not available for this catalog entry.</div>'}<div class="ce-price-foot">Prices are Scryfall-reported estimates and may not reflect a specific seller or the exact condition of a physical card.${tcg?` <a href="${esc(tcg)}" target="_blank" rel="noopener noreferrer">View listings on TCGplayer ↗</a>`:''}</div></section>`}

function renderCardExplorerTab(){
  if(!cardExplorerCard||!$('cardExplorerContent'))return;
  const c=cardExplorerCard,content=$('cardExplorerContent');
  if(cardExplorerTab==='overview'){
    const stats=[c.manaCost?'Mana cost: '+c.manaCost:'',Number.isFinite(c.manaValue)?'Mana value: '+c.manaValue:'',c.color?'Colors: '+c.color:'',c.colorIdentity?.length?'Color identity: '+c.colorIdentity.join(''):'Color identity: Colorless',c.power||c.toughness?'Power / Toughness: '+[c.power,c.toughness].filter(Boolean).join('/'):'',c.loyalty?'Loyalty: '+c.loyalty:'',c.rarity?'Rarity: '+c.rarity:'',c.keywords?.length?'Keywords: '+c.keywords.join(', '):''].filter(Boolean);
    content.innerHTML=`<div class="ce-overview"><div>${c.image?`<img class="ce-image" src="${esc(c.image)}" alt="${esc(c.name)}">`:'<div class="ce-empty">Card image unavailable in the catalog.</div>'}</div><div><div class="eyebrow">${esc(c.set||'Unknown set')}${c.setCode?' · '+esc(c.setCode.toUpperCase()):''}</div><h2 style="margin:6px 0 0;font-size:25px">${esc(c.name)}</h2><div class="ce-type">${esc(c.type||'Card type unavailable')}</div><h3 class="ce-section-title">Oracle text</h3><div class="ce-rules">${esc(c.text||'No rules text.')}</div>${c.flavor?`<h3 class="ce-section-title">Flavor text</h3><div class="ce-rules" style="color:var(--muted);font-style:italic">${esc(c.flavor)}</div>`:''}<div class="ce-meta">${stats.map(esc).join('<br>')}${c.artist?'<br>Illustrated by: '+esc(c.artist):''}${c.id?'<br>Scryfall ID: '+esc(c.id):''}</div>${renderCardPricePanel(c)}</div></div>`;
  }else if(cardExplorerTab==='printings'){
    const printings=getCardPrintings(c).sort((a,b)=>a.set.localeCompare(b.set)||a.collector.localeCompare(b.collector));
    content.innerHTML=printings.length?`<p style="color:var(--muted);margin-top:0">${printings.length.toLocaleString()} printing${printings.length===1?'':'s'} found in the loaded Scryfall catalog.</p><div class="ce-printings">${printings.map(p=>`<article class="ce-printing">${p.image?`<img loading="lazy" src="${esc(p.image)}" alt="${esc(p.name)} — ${esc(p.set)}">`:'<div class="ce-empty">No image</div>'}<div class="ce-printing-name">${esc(p.set||'Unknown set')}</div><div class="ce-printing-meta">${esc((p.setCode||'').toUpperCase())}${p.collector?' · #'+esc(p.collector):''}<br>${esc(p.rarity||'Rarity unknown')}${p.artist?' · '+esc(p.artist):''}</div></article>`).join('')}</div>`:'<div class="ce-empty">No other printings were found in the loaded catalog.</div>';
  }else if(cardExplorerTab==='rulings'){
    renderCardRulings(c,content);
  }else if(cardExplorerTab==='combos'){
    renderCardCombos(c,content);
  }else{
    content.innerHTML=renderSimilarCards(c);
  }
}

function updateDetailNav(){const total=filtered.length;const prev=$('prevCard'),next=$('nextCard');if(!prev||!next)return;const prevIndex=total?((detailIndex-1+total)%total):0;const nextIndex=total?((detailIndex+1)%total):0;prev.disabled=total<2;next.disabled=total<2;prev.setAttribute('aria-label',total>1?`Previous card: ${filtered[prevIndex].name}`:'Previous card');next.setAttribute('aria-label',total>1?`Next card: ${filtered[nextIndex].name}`:'Next card')}
function navigateDetail(delta){const total=filtered.length;if(total<2)return;const nextIndex=(detailIndex+delta+total)%total;showDetail(nextIndex)}
function setMobileDetailMode(imageOnly){const detail=document.querySelector('.detail');const button=$('viewMode');if(!detail||!button)return;detail.classList.toggle('image-only',!!imageOnly);button.textContent=imageOnly?'☰ Details':'▣ Image';button.setAttribute('aria-label',imageOnly?'Show card details':'Show card image')}
function closeDetail(){$('modal').hidden=true;document.body.style.overflow='';setMobileDetailMode(false)}
async function loadBundled(){updateStatus('Connecting to the Scryfall catalog…');search()}
async function loadScryfall(){
  if(scryfallCards)return scryfallCards;
  if(loadingScryfall)return loadingScryfall;
  loadingScryfall=(async()=>{
    updateStatus('Loading Scryfall catalog in mobile-friendly batches…');
    const mr=await fetch('data/scryfall/manifest.json',{cache:'no-store'});
    if(!mr.ok)throw new Error('No Scryfall manifest found. Run the GitHub Actions updater first.');
    const manifest=await mr.json();
    if(manifest.status!=='ready'||!Array.isArray(manifest.shards)||!manifest.shards.length)throw new Error('Scryfall catalog is not ready yet. Run the GitHub Actions updater first.');
    if(typeof DecompressionStream==='undefined')throw new Error('This browser does not support gzip decompression. Please use a current version of Safari or another modern browser.');
    const loaded=[];
    let completed=0;
    for(const shard of manifest.shards){
      updateStatus(`Loading Scryfall catalog… ${completed} of ${manifest.shards.length} data files (${loaded.length.toLocaleString()} cards). Loading ${shard.file}…`);
      const r=await fetch('data/scryfall/'+shard.file+'?v='+encodeURIComponent(manifest.updated_at||'catalog'),{cache:'force-cache'});
      if(!r.ok)throw new Error('Could not download '+shard.file+' (HTTP '+r.status+').');
      const compressed=await r.arrayBuffer();
      let json;
      const bytes=new Uint8Array(compressed);
      if(bytes.length>=2&&bytes[0]===0x1f&&bytes[1]===0x8b){
        const stream=new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
        json=await new Response(stream).text();
      }else{
        json=new TextDecoder().decode(compressed);
      }
      const cards=JSON.parse(json);
      if(!Array.isArray(cards))throw new Error(shard.file+' did not contain a card array.');
      // Avoid spreading a large shard into Array.push(...items): Safari can throw
      // an argument/stack limit error on the largest all-printings shard.
      for(let i=0;i<cards.length;i++)loaded.push(normCard(cards[i],'scryfall'));
      completed++;
      updateStatus(`Loading Scryfall catalog… ${completed} of ${manifest.shards.length} data files (${loaded.length.toLocaleString()} cards).`);
    }
    scryfallCards=loaded;
    const artistCount=new Set(scryfallCards.map(c=>c.artist).filter(Boolean)).size;
    updateStatus(`Scryfall catalog loaded: ${scryfallCards.length.toLocaleString()} cards · ${artistCount.toLocaleString()} artists · data updated ${manifest.updated_at||'date unknown'}.`);
    if(artistCount===0)updateStatus('Scryfall catalog loaded, but it contains no artist names. Check the Scryfall catalog data.');
    return scryfallCards;
  })().finally(()=>{loadingScryfall=null});
  return loadingScryfall;
}
['search','scope','setFilter','colorFilter','artistFilter','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{search()}));$('clear').addEventListener('click',()=>{$('search').value='';search();$('search').focus()});$('reset').addEventListener('click',()=>{$('search').value='';$('scope').value='all';$('setFilter').value='';$('colorFilter').value='';$('artistFilter').value='';$('sort').value='name';resetAdvancedFilters();search()});$('grid').addEventListener('click',e=>{const card=e.target.closest('.card');if(card)showDetail(Number(card.dataset.index))});$('grid').addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.classList.contains('card')){e.preventDefault();showDetail(Number(e.target.dataset.index))}});$('modal').addEventListener('click',e=>{if(e.target.dataset.close)closeDetail()});document.addEventListener('keydown',e=>{if($('modal').hidden)return;if(e.key==='Escape'){closeDetail();return}if(e.key==='ArrowLeft'){e.preventDefault();navigateDetail(-1);return}if(e.key==='ArrowRight'){e.preventDefault();navigateDetail(1)}});$('prevCard').addEventListener('click',()=>navigateDetail(-1));$('nextCard').addEventListener('click',()=>navigateDetail(1));$('viewMode').addEventListener('click',()=>{const detail=document.querySelector('.detail');setMobileDetailMode(!detail.classList.contains('image-only'))});if('IntersectionObserver'in window){observer=new IntersectionObserver(entries=>{if(entries.some(x=>x.isIntersecting))renderMore()},{rootMargin:'800px'});observer.observe($('sentinel'))}else window.addEventListener('scroll',()=>{if(window.innerHeight+window.scrollY>=document.body.offsetHeight-700)renderMore()});

(function addShareSearchStyle(){
  if(document.getElementById('shareSearchStyle'))return;
  const style=document.createElement('style');
  style.id='shareSearchStyle';
  style.textContent='.resultsbar .sharebtn{white-space:nowrap}';
  document.head.appendChild(style);
})();

(function addExportButtonStyle(){
  if(document.getElementById('exportCSVStyle'))return;
  const style=document.createElement('style');
  style.id='exportCSVStyle';
  style.textContent='.resultsbar{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.resultsbar #count{margin-right:auto}.resultsbar .exportbtn{white-space:nowrap}.resultsbar .exportbtn:disabled{opacity:.45;cursor:not-allowed}';
  document.head.appendChild(style);
})();

setupAdvancedFilters();loadBundled();
