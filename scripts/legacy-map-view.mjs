/** The preserved v0.2-v0.8 scenarios explicitly exercise the map. v85 checks the new default table. */
export async function useMapForLegacyChecks(page){
 await page.addInitScript(()=>{try{const old=JSON.parse(localStorage.getItem('federation-ui')||'{}');localStorage.setItem('federation-ui',JSON.stringify({...old,workView:'map'}));}catch{}});
}
