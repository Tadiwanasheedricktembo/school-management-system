(async () => {
 try {
   const login = await fetch('http://127.0.0.1:3010/api/auth/login', {
     method:'POST',
     headers:{'Content-Type':'application/json'},
     body: JSON.stringify({email:'admin@example.com', password:'admin123'})
   });
   const loginData = await login.json(); console.log('login', login.status, loginData);
   const token = loginData.token;
   const create = await fetch('http://127.0.0.1:3010/api/session/create', {
     method:'POST',
     headers:{'Authorization':'Bearer '+token,'Content-Type':'application/json'},
     body: JSON.stringify({course_name:'Math', class_name:'101', lecturer_name:'Prof', note:'test'})
   });
   const createData = await create.json(); console.log('create', create.status, createData);
   const id = createData.session_id;
   const get = await fetch('http://127.0.0.1:3010/api/session/'+id, {headers:{'Authorization':'Bearer '+token}});
   const getData = await get.json(); console.log('get', get.status, getData);
 } catch (e) {
   console.error('err', e);
 }
})();