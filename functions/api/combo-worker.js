/* Commander Spellbook batch scanner. Runs network requests off the UI thread. */
const API='/api/combos';
self.onmessage=async(event)=>{
  const {queue=[],concurrency=2}=event.data||{};
  let cursor=0,failed=null;
  async function scan(item){
    const q=item.terms.join(' OR ');
    let attempt=0;
    while(true){
      const response=await fetch(API+'?q='+encodeURIComponent(q)+'&page=1',{headers:{Accept:'application/json'}});
      if(response.status===429||response.status>=500){
        if(attempt>=4)throw new Error('Commander Spellbook is temporarily busy (HTTP '+response.status+'). The scan will resume later.');
        const wait=Math.min(30000,1500*Math.pow(2,attempt++));
        await new Promise(resolve=>setTimeout(resolve,wait));continue;
      }
      if(!response.ok)throw new Error('Commander Spellbook returned HTTP '+response.status+'.');
      const data=await response.json();
      const rows=Array.isArray(data)?data:(data.results??data.combos??data.variants??data.items??[]);
      if(!Array.isArray(rows))throw new Error('Unexpected response from Commander Spellbook.');
      self.postMessage({type:'batch',index:item.index,rows});return;
    }
  }
  async function run(){while(cursor<queue.length&&!failed){const item=queue[cursor++];try{await scan(item)}catch(error){failed=error;self.postMessage({type:'error',message:error.message})}}}
  await Promise.all(Array.from({length:Math.max(1,Math.min(2,concurrency))},run));
  if(!failed)self.postMessage({type:'done'});
};
