/* SECUREOPS shared action feedback UI */
(() => {
  if (window.SecureOpsUI) return;
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  function close(el){ if(el) el.remove(); }
  function show(type,title,message='',details='',buttonText='OK'){
    const old=document.getElementById('secureopsPopup'); if(old) old.remove();
    const icon=type==='success'
      ? '<i class="fi fi-tr-shield-trust" aria-hidden="true"></i>'
      : type==='error'
        ? '<i class="fi fi-tr-circle-xmark" aria-hidden="true"></i>'
        : '<span class="so-popup-warning-mark" aria-hidden="true">!</span>';
    const el=document.createElement('div');
    el.id='secureopsPopup';
    el.className='so-popup-backdrop';
    el.innerHTML='<div class="so-popup" role="dialog" aria-modal="true" aria-labelledby="soPopupTitle">'+
      '<button type="button" class="so-popup-close" aria-label="Close">×</button>'+
      '<div class="so-popup-icon '+esc(type)+'">'+icon+'</div>'+
      '<h3 id="soPopupTitle"></h3>'+
      '<p class="so-popup-message"></p>'+
      (details?'<div class="so-popup-details"></div>':'')+
      '<button type="button" class="so-popup-action"></button></div>';
    el.querySelector('#soPopupTitle').textContent=title;
    el.querySelector('.so-popup-message').textContent=message;
    if(details) el.querySelector('.so-popup-details').innerHTML=details;
    el.querySelector('.so-popup-action').textContent=buttonText;
    document.body.appendChild(el);
    const done=()=>close(el);
    el.querySelector('.so-popup-close').onclick=done;
    el.querySelector('.so-popup-action').onclick=done;
    el.addEventListener('click',e=>{if(e.target===el)done()});
    const onKey=e=>{if(e.key==='Escape'){done();document.removeEventListener('keydown',onKey)}};
    document.addEventListener('keydown',onKey);
    el.querySelector('.so-popup-action').focus();
    return el;
  }
  window.SecureOpsUI={
    show,
    success:(title,message,details='',buttonText='OK')=>show('success',title,message,details,buttonText),
    error:(title,message,details='',buttonText='OK')=>show('error',title,message,details,buttonText),
    warning:(title,message,details='',buttonText='OK')=>show('warning',title,message,details,buttonText)
  };
  const style=document.createElement('style');
  style.id='secureops-popup-style';
  style.textContent=`
    .so-popup-backdrop{position:fixed;inset:0;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(2,10,20,.78);backdrop-filter:blur(5px);animation:soFade .16s ease}
    .so-popup{position:relative;width:min(480px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;padding:28px 26px 24px;border:1px solid rgba(180,210,235,.25);border-radius:18px;background:linear-gradient(145deg,#081f35,#041524);box-shadow:0 28px 90px rgba(0,0,0,.55);color:#fff;text-align:center;font-family:Poppins,Arial,sans-serif;animation:soPop .18s ease}
    .so-popup-close{position:absolute;right:10px;top:8px;width:36px;height:36px;border:0;background:transparent;color:#a9bbca;font-size:27px;cursor:pointer}
    .so-popup-close:hover{color:#fff}
    .so-popup-icon{width:62px;height:62px;margin:0 auto 14px;border-radius:50%;display:grid;place-items:center;font-size:31px;font-weight:800}
    .so-popup-icon.success{background:transparent;border:0;color:#159447;width:auto;height:auto;margin:0 auto 14px}
    .so-popup-icon.success i{font-size:43px;line-height:1;color:#159447;display:block;transform:none}
    .so-popup-icon.error{background:transparent;border:0;color:#e03b3b;width:auto;height:auto;margin:0 auto 14px}
    .so-popup-icon.error i{font-size:43px;line-height:1;color:#e03b3b;display:block}
    .so-popup-icon.warning{background:#fff0c2;border:2px solid #e8b94d}
    .so-popup-warning-mark{display:block;color:#7a4d00;font-size:25px;font-weight:900;line-height:26px;font-family:Arial,sans-serif}
    .so-popup-icon-mark{position:relative;display:block;width:26px;height:26px}
    .so-popup-icon-mark.check:after{content:"";position:absolute;left:5px;top:1px;width:9px;height:17px;border:solid #075b32;border-width:0 3px 3px 0;transform:rotate(45deg);border-radius:1px}
    .so-popup-icon-mark.error:before,.so-popup-icon-mark.error:after{content:"";position:absolute;left:11px;top:2px;width:3px;height:22px;background:#8b1111;border-radius:2px}
    .so-popup-icon-mark.error:before{transform:rotate(45deg)}
    .so-popup-icon-mark.error:after{transform:rotate(-45deg)}
    .so-popup-icon-mark.warning:before{content:"!";position:absolute;inset:0;display:grid;place-items:center;color:#7a4d00;font-size:25px;font-weight:900;line-height:26px;font-family:Arial,sans-serif}
    .so-popup h3{margin:0 0 8px;font-size:1.12rem}
    .so-popup-message{margin:0 auto 16px;line-height:1.5;font-size:.84rem;color:rgba(255,255,255,.86)}
    .so-popup-details{padding:13px 15px;margin:0 0 18px;border:1px solid rgba(180,210,235,.2);border-radius:11px;background:rgba(255,255,255,.035);text-align:left;font-size:.73rem;line-height:1.55}
    .so-popup-details div+div{margin-top:6px}
    .so-popup-action{width:100%;min-height:44px;border:0;border-radius:11px;padding:12px;background:linear-gradient(135deg,#d49a2c,#efc363);color:#071a30;font-weight:800;cursor:pointer}
    @keyframes soFade{from{opacity:0}to{opacity:1}}@keyframes soPop{from{opacity:0;transform:translateY(8px) scale(.97)}to{opacity:1;transform:none}}
    @media(max-width:520px){.so-popup{padding:24px 18px 20px}}
  `;
  document.head.appendChild(style);
})();