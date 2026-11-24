const $=s=>document.querySelector(s);
const ss=(k,v)=>{try{sessionStorage.setItem(k,v)}catch(e){}};
$('#visitor').onclick=()=>{ss('rl_in','1');location.href='/'};
$('#join').onclick=()=>ss('rl_in','1');
(async()=>{try{const s=await (await fetch('/api/status',{credentials:'same-origin'})).json();
 if(s.user){ss('rl_in','1');try{localStorage.setItem('rl_member','1')}catch(e){}
  $('#back').hidden=false;$('#backName').textContent='Welcome back, '+s.user.username+'!';}}catch(e){}})();
