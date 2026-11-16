const $=id=>document.getElementById(id);
let scryfallCards=null,allCards=[],filtered=[],visible=0;const PAGE_SIZE=60;let observer;let loadingScryfall=null;
function clean(v){return String(v??'').trim()}
function cardNameKey(v){return clean(v).normalize('NFKC').toLocaleLowerCase().replace(/\s+/g,' ')}
function normCard(c,source='scryfall'){const name=clean(c.name??c['Card Name']??c.Name);return {name,type:clean(c.type??c.type_line??c['Card Type']??c.Type),set:clean(c.set_name??c.set??c['Set Name']??c.Set),setCode:clean(c.set_code??c.setCode??(source==='scryfall'?c.set:'')),collector:clean(c.collector_number??c.collector??''),color:Array.isArray(c.colors)?c.colors.join('')||'Colorless':clean(c.color??c['Casting Color']??c.Color),text:clean(c.oracle_text??c.text??c['Card Text']??c.Text),flavor:clean(c.flavor_text??c.flavor??c['Flavor Text']??c.Flavor),value:clean(c.value??c['Current Value']??c.Value),image:clean(c.image_url??c.image??c['Image URL']??c.ImageURL),rarity:clean(c.rarity),artist:clean(c.artist??c.Artist??''),manaValue:Number(c.cmc??c.mana_value??0),colorIdentity:Array.isArray(c.color_identity)?c.color_identity:[],id:clean(c.id??c.scryfall_id),source};}
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
  setupExportButton();$('exportCSV').disabled=filtered.length===0;setupShareButton();
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

function readSharedSearchFromURL(){
  const params=new URLSearchParams(window.location.search);
  if(![...params.keys()].length)return;
  const setIfValid=(id,key)=>{
    const value=params.get(key);
    if(value!==null&&$(id))$(id).value=value;
  };
  setIfValid('search','q');
  setIfValid('scope','scope');
  setIfValid('setFilter','set');
  setIfValid('colorFilter','color');
  setIfValid('artistFilter','artist');
  setIfValid('sort','sort');
  setIfValid('typeAdvanced','type');
  setIfValid('rarityAdvanced','rarity');
  setIfValid('manaMin','min');
  setIfValid('manaMax','max');
  if($('legendaryAdvanced'))$('legendaryAdvanced').checked=params.get('legendary')==='1';
  const identity=params.get('identity')||'';
  document.querySelectorAll('.identity-color').forEach(el=>el.checked=identity.includes(el.value));
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
function showDetail(index){const c=filtered[index];if(!c)return;const opening=$('modal').hidden;detailIndex=index;if(opening){setMobileDetailMode(false)}$('detailImg').src=c.image;$('detailImg').alt=c.name;$('detailName').textContent=c.name;$('detailSet').textContent=['SCRYFALL',c.set,c.setCode?'('+c.setCode.toUpperCase()+')':'',c.collector].filter(Boolean).join(' · ')||'SET UNKNOWN';$('detailType').textContent=c.type;$('detailText').textContent=c.text||'No rules text in this catalog.';$('flavorBlock').hidden=!c.flavor;$('detailFlavor').textContent=c.flavor;$('detailMeta').textContent=[c.color?'Color: '+c.color:'',c.manaCost?'Mana cost: '+c.manaCost:'',c.rarity?'Rarity: '+c.rarity:'',c.artist?'Artist: '+c.artist:'',c.value?'Catalog value: '+c.value:'',c.id?'Scryfall ID: '+c.id:''].filter(Boolean).join(' · ');$('modal').hidden=false;updateDetailNav();document.body.style.overflow='hidden'}
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
