import express from 'express';
import { randomUUID, randomBytes, randomInt, createHash, timingSafeEqual, scryptSync } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { col, clean, closeDatabase } from './db.js';
import { mailProvider, sendVerificationCode } from './mail.js';

const app=express();
const production=process.env.NODE_ENV==='production';
const normalizeOrigin=value=>(value||'').trim().replace(/\/$/,'');
const appOrigin=normalizeOrigin(process.env.APP_ORIGIN);
const legacyApiOrigin=normalizeOrigin(process.env.API_PUBLIC_ORIGIN);
const publicOrigin=appOrigin||legacyApiOrigin;
const admins=(process.env.ADMIN_EMAILS||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
const superAdminEmail=(process.env.SUPER_ADMIN_EMAIL||'').trim().toLowerCase();
if(production && (!mailProvider() || !appOrigin.startsWith('https://'))) throw new Error('Production requires SMTP or Resend email credentials plus an HTTPS APP_ORIGIN value.');
const hash=text=>createHash('sha256').update(text).digest('hex');
const fail=(status,message)=>{const e=new Error(message);e.status=status;throw e;};
function txt(value,label,max=2000,min=1){if(typeof value!=='string'||value.trim().length<min||value.trim().length>max)fail(400,`${label} must be ${min}–${max} characters.`);return value.trim();}
function choice(value,options,label){if(!options.includes(value))fail(400,`Choose a valid ${label}.`);return value;}
const publicUser=(u,role='member',permissions=[])=>({id:u.id,name:u.name,alias:u.alias,joined:u.created,verified:u.verified!==false,isAdmin:['admin','superadmin'].includes(role)||admins.includes(u.email),isSuperAdmin:role==='superadmin',permissions:role==='superadmin'?['reports','users','listings','verification','roles']:permissions});
const tokenFrom=req=>(req.headers.cookie||'').split(';').map(s=>s.trim()).find(s=>s.startsWith('nexora_session='))?.slice(15);
const auth=(req,res,next)=>req.user?next():res.status(401).json({error:'Join your campus to continue.'});
const member=(req,res,next)=>req.user?next():res.status(401).json({error:'Verify your email to access campus content.'});
const superAdmin=(req,res,next)=>req.user&&req.sessionRole==='superadmin'?next():res.status(403).json({error:'Super administrator access required.'});
const adminMember=(req,res,next)=>req.user&&(req.sessionRole==='admin'||req.sessionRole==='superadmin'||admins.includes(req.user.email))?next():res.status(403).json({error:'Administrator access required.'});
const adminAccess=permission=>(req,res,next)=>req.user&&(req.sessionRole==='superadmin'||admins.includes(req.user.email)||req.adminPermissions?.includes(permission)||(permission==='users'&&req.adminPermissions?.includes('verification')))?next():res.status(403).json({error:'This administrator permission is required.'});
function uploadPath(value){
  if(typeof value!=='string')return null;
  let path=value;
  for(const origin of [publicOrigin,legacyApiOrigin].filter(Boolean))if(path.startsWith(origin)){path=path.slice(origin.length);break;}
  return /^\/api\/uploads\/[a-f0-9-]+\.(?:jpg|png|webp)$/.test(path)?path:null;
}
async function login(res,u,role='member',permissions=[]){const token=randomBytes(32).toString('hex');await col('sessions').insertOne({token:hash(token),user_id:u.id,role,expires:new Date(Date.now()+7*86400000)});res.cookie('nexora_session',token,{httpOnly:true,sameSite:'lax',secure:production,maxAge:7*86400000,path:'/'});return publicUser(u,role,permissions);}
function validAdminPassword(value){const stored=process.env.SUPER_ADMIN_PASSWORD_HASH||'',parts=stored.split('$');if(parts.length!==3||parts[0]!=='scrypt')return false;const expected=Buffer.from(parts[2],'hex'),actual=scryptSync(value,parts[1],expected.length);return expected.length>0&&timingSafeEqual(actual,expected);}
const limits=new Map();
function limit(key,max=10,window=60000){const now=Date.now(),item=limits.get(key);if(!item||item.until<now)limits.set(key,{count:1,until:now+window});else if(++item.count>max)fail(429,'Too many attempts. Please try again in a few minutes.');}
setInterval(()=>{for(const [k,v] of limits)if(v.until<Date.now())limits.delete(k);},60000).unref();
app.disable('x-powered-by');
app.set('trust proxy',1);
app.use((req,res,next)=>{res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','same-origin');res.setHeader('X-Frame-Options','DENY');res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');if(production)res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");next();});
app.use(express.json({limit:'5mb'}));
app.use(async(req,res,next)=>{
  if(req.path.startsWith('/api'))res.setHeader('Cache-Control','no-store');
  const allowed=(production?[appOrigin]:[appOrigin,'http://localhost:5173','http://127.0.0.1:5173','http://localhost:3001','http://127.0.0.1:3001']).map(normalizeOrigin).filter(Boolean);
  if(req.headers.origin&&allowed.includes(req.headers.origin)){
    res.setHeader('Access-Control-Allow-Origin',req.headers.origin);
    res.setHeader('Access-Control-Allow-Credentials','true');
    res.setHeader('Access-Control-Allow-Headers','Content-Type');
    res.setHeader('Access-Control-Allow-Methods','GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Vary','Origin');
  }
  if(req.method==='OPTIONS')return req.headers.origin&&allowed.includes(req.headers.origin)?res.sendStatus(204):res.status(403).json({error:'This origin is not allowed.'});
  if(!['GET','HEAD'].includes(req.method)&&req.headers.origin&&!allowed.includes(req.headers.origin))return res.status(403).json({error:'This origin is not allowed.'});
  const token=tokenFrom(req);
  if(token){const s=await col('sessions').findOne({token:hash(token),expires:{$gt:new Date()}});if(s){const user=await col('users').findOne({id:s.user_id});if(user?.blocked)await col('sessions').deleteOne({_id:s._id});else{const assignment=s.role==='superadmin'?null:await col('admin_roles').findOne({user_id:user.id});req.user=user;req.sessionRole=s.role==='superadmin'?'superadmin':assignment?'admin':'member';req.adminPermissions=assignment?.permissions||[];}}}
  next();
});
app.get('/api/config',(req,res)=>res.json({campus:process.env.CAMPUS_NAME||'Nexora University',anyEmail:true,mailConfigured:!!mailProvider()}));
app.get('/api/me',(req,res)=>res.json({user:req.user?publicUser(req.user,req.sessionRole,req.adminPermissions):null}));
app.post('/api/auth/request',async(req,res)=>{
  limit(`auth:${req.ip}`,10,900000);
  const email=txt(req.body.email,'Email',254).toLowerCase(),name=txt(req.body.name,'Name',60);
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))fail(400,'Enter a valid email address.');
  limit(`email:${email}`,3,900000);
  if(superAdminEmail&&email===superAdminEmail)return res.json({adminPasswordRequired:true,message:'Enter the administrator password to continue.'});
  const code=String(randomInt(100000,1000000));
  await col('codes').updateOne({email},{$set:{hash:hash(code),expires:new Date(Date.now()+600000),attempts:0,name}},{upsert:true});
  if(mailProvider()){
    try{await sendVerificationCode({to:email,code});}
    catch{await col('codes').deleteOne({email});fail(503,'Email could not be sent. Please try again later.');}
  }else console.log(`[Nexora development sign-in] ${email}: ${code}`);
  res.json({message:mailProvider()?'Check your email inbox for a six-digit code.':'Development mode: your code is in the API terminal. No email was sent.'});
});
app.post('/api/auth/verify',async(req,res)=>{
  limit(`verify:${req.ip}`,20,900000);
  const email=txt(req.body.email,'Email',254).toLowerCase(),code=txt(req.body.code,'Code',6,6);
  const record=await col('codes').findOneAndUpdate({email,expires:{$gt:new Date()},attempts:{$lt:5}},{$inc:{attempts:1}},{returnDocument:'before'});
  if(!record)fail(400,'Code expired. Request a new code.');
  if(!timingSafeEqual(Buffer.from(hash(code)),Buffer.from(record.hash)))fail(400,'Incorrect code. Please try again.');
  const consumed=await col('codes').deleteOne({_id:record._id,hash:record.hash});if(!consumed.deletedCount)fail(400,'This code was already used.');
  const user=await col('users').findOneAndUpdate({email},{$set:{verified:true},$setOnInsert:{id:randomUUID(),email,name:record.name,alias:`${['Quiet','Curious','Cosmic','Midnight'][randomInt(4)]} ${['Fox','Owl','Panda','Otter'][randomInt(4)]} ${randomInt(100,999)}`,created:Date.now()}},{upsert:true,returnDocument:'after'});
  const assignment=await col('admin_roles').findOne({user_id:user.id});
  res.json({user:await login(res,user,assignment?'admin':'member',assignment?.permissions||[])});
});
app.post('/api/auth/admin',async(req,res)=>{
  limit(`admin:${req.ip}`,6,900000);
  const email=txt(req.body.email,'Email',254).toLowerCase(),password=txt(req.body.password,'Password',200,8);
  if(!superAdminEmail||email!==superAdminEmail||!validAdminPassword(password))fail(401,'Incorrect administrator email or password.');
  const user=await col('users').findOneAndUpdate({email},{$set:{blocked:false},$setOnInsert:{id:randomUUID(),email,name:'Nexora Super Admin',alias:'Nexora Admin',created:Date.now()}},{upsert:true,returnDocument:'after'});
  res.json({user:await login(res,user,'superadmin')});
});
app.post('/api/auth/logout',async(req,res)=>{const t=tokenFrom(req);if(t)await col('sessions').deleteOne({token:hash(t)});res.clearCookie('nexora_session',{path:'/'});res.json({ok:true});});
app.use('/api',(req,res,next)=>{if(req.method!=='GET')limit(`write:${req.user?.id||req.ip}`,90);next();});
async function listingView(l,user){const u=await col('users').findOne({id:l.user_id});return {...clean(l),seller:u.name,saved:!!(user&&await col('saved').findOne({user_id:user.id,listing_id:l.id})),isOwner:user?.id===l.user_id};}
app.get('/api/listings',member,async(req,res)=>res.json(await Promise.all((await col('listings').find().sort({created:-1}).toArray()).map(l=>listingView(l,req.user)))));
app.post('/api/listings',auth,async(req,res)=>{
  const b=req.body,id=randomUUID(),price=Number(b.price);
  if(!Number.isSafeInteger(price)||price<0||price>10000000)fail(400,'Enter a valid whole-rupee price.');
  const images=b.images;if(!Array.isArray(images)||images.length<1||images.length>4||images.some(s=>!uploadPath(s)))fail(400,'Upload 1–4 photos of your item.');
  const owned=await col('uploads').countDocuments({url:{$in:images},user_id:req.user.id});if(owned!==new Set(images).size)fail(403,'Use your own uploaded photos.');
  const kind=choice(b.kind,['Sell','Free','Exchange'],'listing type');if(kind==='Sell'&&price<1)fail(400,'Set a price or choose Free.');
  await col('listings').insertOne({id,user_id:req.user.id,title:txt(b.title,'Title',100),description:txt(b.description,'Description',3000,10),price:kind==='Sell'?price:0,category:choice(b.category,['Books','Electronics','Furniture','Clothing','Sports','Hostel essentials'],'category'),condition:choice(b.condition,['Like new','Good','Fair'],'condition'),location:txt(b.location,'Campus location',100),kind,semester:!!b.semester,images,sold:false,created:Date.now()});res.status(201).json({id});
});
app.post('/api/uploads',auth,async(req,res)=>{
  const data=txt(req.body.data,'Image',4300000),match=data.match(/^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=]+)$/);if(!match)fail(400,'Choose a JPEG, PNG or WebP image.');
  const bytes=Buffer.from(match[2],'base64');if(bytes.length>3*1024*1024)fail(400,'Each photo must be under 3 MB.');
  const valid=match[1]==='jpeg'?bytes[0]===255&&bytes[1]===216&&bytes[2]===255:match[1]==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP';if(!valid)fail(400,'The file is not a valid image.');
  const name=`${randomUUID()}.${match[1]==='jpeg'?'jpg':match[1]}`,path=`/api/uploads/${name}`,url=production&&publicOrigin?`${publicOrigin}${path}`:path;
  await col('uploads').insertOne({url,name,user_id:req.user.id,contentType:`image/${match[1]}`,data:bytes,created:Date.now()});res.status(201).json({url});
});
app.get('/api/uploads/:name',member,async(req,res)=>{
  if(!/^[a-f0-9-]+\.(?:jpg|png|webp)$/.test(req.params.name))fail(404,'Photo not found.');
  const upload=await col('uploads').findOne({name:req.params.name});if(!upload)fail(404,'Photo not found.');
  res.setHeader('Cache-Control','private, max-age=86400');res.type(upload.contentType);res.send(Buffer.isBuffer(upload.data)?upload.data:Buffer.from(upload.data.buffer));
});
app.patch('/api/listings/:id',auth,async(req,res)=>{const l=await col('listings').findOne({id:req.params.id});if(!l)fail(404,'Listing not found.');if(l.user_id!==req.user.id)fail(403,'Only the seller can update this listing.');if(typeof req.body.sold!=='boolean')fail(400,'Choose a valid status.');await col('listings').updateOne({id:l.id},{$set:{sold:req.body.sold}});res.json({ok:true});});
app.post('/api/listings/:id/save',auth,async(req,res)=>{if(!await col('listings').findOne({id:req.params.id}))fail(404,'Listing not found.');const filter={user_id:req.user.id,listing_id:req.params.id},prev=await col('saved').findOne(filter);if(prev)await col('saved').deleteOne(filter);else await col('saved').updateOne(filter,{$set:filter},{upsert:true});res.json({saved:!prev});});
app.get('/api/users/:id',member,async(req,res)=>{const u=await col('users').findOne({id:req.params.id});if(!u)fail(404,'Seller not found.');res.json({...publicUser(u),listings:await Promise.all((await col('listings').find({user_id:u.id}).sort({created:-1}).toArray()).map(l=>listingView(l,req.user)))});});
async function postView(p,user){const u=await col('users').findOne({id:p.user_id});const {user_id,...safe}=clean(p);const votes=await col('votes').find({post_id:p.id}).toArray();return {...safe,author:p.anonymous?u.alias:u.name,isOwner:p.user_id===user?.id,score:votes.reduce((sum,v)=>sum+v.value,0),vote:votes.find(v=>v.user_id===user?.id)?.value||0,comments:await col('comments').countDocuments({post_id:p.id})};}
app.get('/api/posts',member,async(req,res)=>res.json(await Promise.all((await col('posts').find().sort({created:-1}).toArray()).map(p=>postView(p,req.user)))));
app.post('/api/posts',auth,async(req,res)=>{const b=req.body,id=randomUUID();await col('posts').insertOne({id,user_id:req.user.id,title:txt(b.title,'Title',180),body:txt(b.body,'Post',5000,5),community:choice(b.community,['Campus life','Academics','Meetups','Want to buy'],'community'),anonymous:!!b.anonymous,created:Date.now()});res.status(201).json({id});});
app.post('/api/posts/:id/vote',auth,async(req,res)=>{if(!await col('posts').findOne({id:req.params.id}))fail(404,'Post not found.');const value=choice(req.body.value,[-1,0,1],'vote'),filter={user_id:req.user.id,post_id:req.params.id};if(value===0)await col('votes').deleteOne(filter);else await col('votes').updateOne(filter,{$set:{value}},{upsert:true});res.json({ok:true});});
app.get('/api/posts/:id/comments',member,async(req,res)=>res.json(await Promise.all((await col('comments').find({post_id:req.params.id}).sort({created:1}).toArray()).map(async c=>{const u=await col('users').findOne({id:c.user_id});const {user_id,...safe}=clean(c);return {...safe,author:c.anonymous?u.alias:u.name};}))));
app.post('/api/posts/:id/comments',auth,async(req,res)=>{if(!await col('posts').findOne({id:req.params.id}))fail(404,'Post not found.');await col('comments').insertOne({id:randomUUID(),post_id:req.params.id,user_id:req.user.id,body:txt(req.body.body,'Comment',2000),anonymous:!!req.body.anonymous,created:Date.now()});res.status(201).json({ok:true});});
app.post('/api/conversations',auth,async(req,res)=>{
  let seller,listing=null,anonymous=false;
  if(req.body.postId){const p=await col('posts').findOne({id:txt(req.body.postId,'Post ID',100)});if(!p)fail(404,'Post not found.');seller=p.user_id;anonymous=true;}
  else{const l=await col('listings').findOne({id:txt(req.body.listingId,'Listing ID',100)});if(!l)fail(404,'Listing not found.');if(l.sold)fail(400,'This item is no longer available.');seller=l.user_id;listing=l.id;}
  if(seller===req.user.id)fail(400,'This is your own post or listing.');
  const c=await col('conversations').findOneAndUpdate({buyer_id:req.user.id,seller_id:seller,listing_id:listing,anonymous},{$setOnInsert:{id:randomUUID(),created:Date.now()}},{upsert:true,returnDocument:'after'});res.json({id:c.id});
});
async function conversation(id,u){const c=await col('conversations').findOne({id});if(!c)fail(404,'Conversation not found.');if(c.buyer_id!==u.id&&c.seller_id!==u.id)fail(403,'You cannot access this conversation.');return c;}
app.get('/api/conversations',auth,async(req,res)=>{const cs=await col('conversations').find({$or:[{buyer_id:req.user.id},{seller_id:req.user.id}]}).toArray();res.json((await Promise.all(cs.map(async c=>{const u=await col('users').findOne({id:c.buyer_id===req.user.id?c.seller_id:c.buyer_id}),l=c.listing_id?await col('listings').findOne({id:c.listing_id}):null,msg=await col('messages').findOne({conversation_id:c.id},{sort:{created:-1}});return {id:c.id,name:c.anonymous?u.alias:u.name,anonymous:c.anonymous,title:l?.title||'Campus connection',image:l?.images[0],lastMessage:msg?.body||'Say hello to start the conversation',updated:msg?.created||c.created};}))).sort((a,b)=>b.updated-a.updated));});
app.get('/api/conversations/:id/messages',auth,async(req,res)=>{await conversation(req.params.id,req.user);res.json((await col('messages').find({conversation_id:req.params.id}).sort({created:1}).toArray()).map(m=>{const {user_id,...safe}=clean(m);return {...safe,mine:user_id===req.user.id};}));});
app.post('/api/conversations/:id/messages',auth,async(req,res)=>{await conversation(req.params.id,req.user);await col('messages').insertOne({id:randomUUID(),conversation_id:req.params.id,user_id:req.user.id,body:txt(req.body.body,'Message',3000),created:Date.now()});res.status(201).json({ok:true});});
app.post('/api/reports',auth,async(req,res)=>{const b=req.body,type=choice(b.type,['listing','post','comment'],'report type'),id=txt(b.id,'Content ID',100),table={listing:'listings',post:'posts',comment:'comments'}[type];if(!await col(table).findOne({id}))fail(404,'Content not found.');await col('reports').insertOne({id:randomUUID(),user_id:req.user.id,target_type:type,target_id:id,reason:txt(b.reason,'Reason',1000,5),status:'open',created:Date.now()});res.status(201).json({ok:true});});
app.get('/api/admin/overview',adminMember,async(_req,res)=>{const [users,listings,posts,reports,blocked]=await Promise.all([col('users').countDocuments(),col('listings').countDocuments(),col('posts').countDocuments(),col('reports').countDocuments({status:'open'}),col('users').countDocuments({blocked:true})]);res.json({users,listings,posts,reports,blocked});});
app.get('/api/admin/users',adminAccess('users'),async(_req,res)=>{const users=await col('users').find().sort({created:-1}).toArray();const roles=await col('admin_roles').find().toArray();res.json(await Promise.all(users.map(async u=>({id:u.id,name:u.name,email:u.email,alias:u.alias,created:u.created,blocked:!!u.blocked,verified:u.verified!==false,adminPermissions:roles.find(r=>r.user_id===u.id)?.permissions||[],listings:await col('listings').countDocuments({user_id:u.id}),posts:await col('posts').countDocuments({user_id:u.id})}))));});
app.patch('/api/admin/users/:id',superAdmin,async(req,res)=>{if(req.user.id===req.params.id&&req.body.blocked)fail(400,'The active super administrator cannot be blocked.');if(typeof req.body.blocked!=='boolean')fail(400,'Choose a valid access status.');const result=await col('users').updateOne({id:req.params.id},{$set:{blocked:req.body.blocked}});if(!result.matchedCount)fail(404,'User not found.');if(req.body.blocked)await col('sessions').deleteMany({user_id:req.params.id});res.json({ok:true});});
app.patch('/api/admin/users/:id/verification',adminAccess('verification'),async(req,res)=>{if(typeof req.body.verified!=='boolean')fail(400,'Choose a valid verification status.');const result=await col('users').updateOne({id:req.params.id},{$set:{verified:req.body.verified}});if(!result.matchedCount)fail(404,'User not found.');res.json({ok:true});});
app.patch('/api/admin/roles/:id',superAdmin,async(req,res)=>{if(req.user.id===req.params.id)fail(400,'Super administrator permissions cannot be changed.');const allowed=['reports','users','listings','verification'],permissions=Array.isArray(req.body.permissions)?[...new Set(req.body.permissions)]:null;if(!permissions||permissions.some(p=>!allowed.includes(p)))fail(400,'Choose valid administrator permissions.');if(!await col('users').findOne({id:req.params.id}))fail(404,'User not found.');if(permissions.length)await col('admin_roles').updateOne({user_id:req.params.id},{$set:{permissions,assigned_by:req.user.id,updated:Date.now()}},{upsert:true});else await col('admin_roles').deleteOne({user_id:req.params.id});res.json({ok:true});});
app.get('/api/admin/content',adminAccess('listings'),async(_req,res)=>{const [listings,posts]=await Promise.all([col('listings').find().sort({created:-1}).limit(200).toArray(),col('posts').find().sort({created:-1}).limit(200).toArray()]);const decorate=async(item)=>{const owner=await col('users').findOne({id:item.user_id});return {...clean(item),owner:owner?.name||'Unknown user'};};res.json({listings:await Promise.all(listings.map(decorate)),posts:await Promise.all(posts.map(decorate))});});
app.delete('/api/admin/content/:type/:id',superAdmin,async(req,res)=>{const type=choice(req.params.type,['listing','post','comment'],'content type'),id=req.params.id,table={listing:'listings',post:'posts',comment:'comments'}[type],result=await col(table).deleteOne({id});if(!result.deletedCount)fail(404,'Content not found.');if(type==='listing'){await Promise.all([col('saved').deleteMany({listing_id:id}),col('conversations').deleteMany({listing_id:id})]);}if(type==='post'){const comments=await col('comments').find({post_id:id}).project({id:1}).toArray();await Promise.all([col('votes').deleteMany({post_id:id}),col('comments').deleteMany({post_id:id}),col('reports').updateMany({target_id:{$in:[id,...comments.map(c=>c.id)]}},{$set:{status:'removed'}})]);}await col('reports').updateMany({target_type:type,target_id:id},{$set:{status:'removed'}});res.json({ok:true});});
app.get('/api/admin/reports',adminAccess('reports'),async(_req,res)=>{res.json(await Promise.all((await col('reports').find().sort({created:-1}).toArray()).map(async r=>({...clean(r),content:clean(await col({listing:'listings',post:'posts',comment:'comments'}[r.target_type]).findOne({id:r.target_id}))}))));});
app.patch('/api/admin/reports/:id',adminAccess('reports'),async(req,res)=>{await col('reports').updateOne({id:req.params.id},{$set:{status:choice(req.body.status,['open','reviewed','dismissed','removed'],'status')}});res.json({ok:true});});
app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint not found.'}));
app.use(express.static(resolve('dist')));
app.get('/{*path}',(_req,res)=>existsSync(resolve('dist/index.html'))?res.sendFile(resolve('dist/index.html')):res.status(404).send('Start Vite with npm run dev.'));
app.use((err,req,res,_next)=>{if(!err.status||err.status>=500)console.error(err.message);res.status(err.status||500).json({error:err.status?err.message:'Something went wrong. Please try again.'});});
const port=Number(process.env.PORT||3001);
if(!process.env.VERCEL){
  const server=app.listen(port,process.env.HOST||'127.0.0.1',()=>console.log(`Nexora API ready at http://127.0.0.1:${port}`));
  for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await closeDatabase();process.exit(0);}));
}
export default app;
