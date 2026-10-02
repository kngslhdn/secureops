/* SECUREOPS shared authentication runtime
 * One Supabase environment + one persistent auth session for Admin,
 * Emergency Operations and Emergency Settings.
 */
(function(){
  const U=window.SECUREOPS_CONFIG?.SUPABASE_URL;
  const K=window.SECUREOPS_CONFIG?.SUPABASE_PUBLISHABLE_KEY;
  if(!U||!K||!window.supabase) throw new Error('SECUREOPS authentication dependencies are not ready');
  const options={auth:{persistSession:true,autoRefreshToken:true,storageKey:'secureops-auth-token',detectSessionInUrl:true}};
  let client=null;
  window.SECUREOPS_AUTH=Object.freeze({
    storageKey:'secureops-auth-token',
    url:U,
    getClient(){
      if(!client) client=window.supabase.createClient(U,K,options);
      return client;
    },
    async getSession(){
      return this.getClient().auth.getSession();
    },
    onAuthStateChange(cb){
      return this.getClient().auth.onAuthStateChange(cb);
    }
  });
})();