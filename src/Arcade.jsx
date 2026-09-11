import { useCallback, useEffect, useRef, useState } from 'react';
import { Gamepad2, Trophy, Wifi, WifiOff, Zap } from 'lucide-react';

const WIDTH=900,HEIGHT=360,GROUND=295;

export default function Arcade(){
  const canvasRef=useRef(null),frameRef=useRef(0),gameRef=useRef(null);
  const [status,setStatus]=useState('ready'),[score,setScore]=useState(0),[best,setBest]=useState(()=>Number(localStorage.getItem('nexora-arcade-best')||0)),[online,setOnline]=useState(navigator.onLine);

  const draw=useCallback((game)=>{
    const ctx=canvasRef.current?.getContext('2d');if(!ctx)return;
    ctx.clearRect(0,0,WIDTH,HEIGHT);
    ctx.fillStyle='#f7faf9';ctx.fillRect(0,0,WIDTH,HEIGHT);
    ctx.strokeStyle='#dfe9e6';ctx.lineWidth=1;
    for(let x=0;x<WIDTH;x+=45){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,GROUND);ctx.stroke();}
    for(let y=25;y<GROUND;y+=45){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(WIDTH,y);ctx.stroke();}
    ctx.fillStyle='#192b29';ctx.fillRect(0,GROUND,WIDTH,HEIGHT-GROUND);
    ctx.fillStyle='#0a887b';
    for(let x=-(game.distance%55);x<WIDTH;x+=55)ctx.fillRect(x,GROUND+24,29,3);
    for(const star of game.stars){ctx.save();ctx.translate(star.x,star.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#12a594';ctx.fillRect(-7,-7,14,14);ctx.restore();ctx.fillStyle='#f7faf9';ctx.fillRect(star.x-2,star.y-2,4,4);}
    for(const block of game.blocks){ctx.fillStyle='#111f1e';ctx.fillRect(block.x,GROUND-block.h,block.w,block.h);ctx.fillStyle='#19a997';ctx.fillRect(block.x+5,GROUND-block.h+6,block.w-10,5);ctx.fillStyle='#f7faf9';ctx.font='700 11px Manrope, sans-serif';ctx.textAlign='center';ctx.fillText(block.label,block.x+block.w/2,GROUND-12);}
    const p=game.player;ctx.save();ctx.translate(p.x,p.y);ctx.fillStyle='#0a887b';ctx.fillRect(0,0,40,45);ctx.fillStyle='#fff';ctx.fillRect(8,10,7,7);ctx.fillRect(25,10,7,7);ctx.fillStyle='#132523';ctx.fillRect(11,12,3,3);ctx.fillRect(28,12,3,3);ctx.fillRect(10,31,22,4);ctx.fillStyle='#132523';ctx.fillRect(4,45,11,8);ctx.fillRect(27,45,11,8);ctx.restore();
    ctx.fillStyle='#75827e';ctx.font='600 12px DM Sans, sans-serif';ctx.textAlign='left';ctx.fillText('NEXORA NETWORK // CAMPUS RUN',22,27);
  },[]);

  const finish=useCallback((points)=>{
    cancelAnimationFrame(frameRef.current);setStatus('over');
    setBest(old=>{const next=Math.max(old,points);localStorage.setItem('nexora-arcade-best',String(next));return next;});
  },[]);

  const tick=useCallback((time)=>{
    const game=gameRef.current;if(!game||game.stopped)return;
    const dt=Math.min((time-game.last)/16.67,2);game.last=time;game.distance+=game.speed*dt;game.speed=Math.min(12,6.3+game.distance/3500);
    const p=game.player;p.vy+=.76*dt;p.y+=p.vy*dt;if(p.y>GROUND-53){p.y=GROUND-53;p.vy=0;p.grounded=true;}
    game.spawn-=game.speed*dt;if(game.spawn<=0){const h=32+Math.random()*39,w=32+Math.random()*29;game.blocks.push({x:WIDTH+40,w,h,label:['BOOK','BIKE','LAB','CAFE'][Math.floor(Math.random()*4)]});game.spawn=260+Math.random()*250;}
    game.starSpawn-=game.speed*dt;if(game.starSpawn<=0){game.stars.push({x:WIDTH+30,y:GROUND-105-Math.random()*85});game.starSpawn=420+Math.random()*400;}
    game.blocks.forEach(o=>o.x-=game.speed*dt);game.stars.forEach(s=>s.x-=game.speed*dt);
    const hit=game.blocks.some(o=>p.x+35>o.x&&p.x+5<o.x+o.w&&p.y+50>GROUND-o.h);
    for(const star of game.stars){if(!star.got&&p.x+42>star.x-9&&p.x<star.x+9&&p.y+53>star.y-9&&p.y<star.y+9){star.got=true;game.bonus+=50;}}
    game.blocks=game.blocks.filter(o=>o.x+o.w>-10);game.stars=game.stars.filter(s=>s.x>0&&!s.got);
    const points=Math.floor(game.distance/9)+game.bonus;setScore(points);draw(game);
    if(hit){game.stopped=true;finish(points);return;}frameRef.current=requestAnimationFrame(tick);
  },[draw,finish]);

  const start=useCallback(()=>{
    cancelAnimationFrame(frameRef.current);const game={last:performance.now(),distance:0,speed:6.3,spawn:330,starSpawn:550,bonus:0,stopped:false,blocks:[],stars:[],player:{x:86,y:GROUND-53,vy:0,grounded:true}};gameRef.current=game;setScore(0);setStatus('playing');draw(game);frameRef.current=requestAnimationFrame(tick);
  },[draw,tick]);
  const jump=useCallback(()=>{const game=gameRef.current;if(status!=='playing'){start();return;}if(game?.player.grounded){game.player.vy=-14.2;game.player.grounded=false;}},[start,status]);

  useEffect(()=>{const game={distance:0,blocks:[],stars:[],player:{x:86,y:GROUND-53}};draw(game);},[draw]);
  useEffect(()=>{const key=e=>{if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();jump();}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[jump]);
  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
  useEffect(()=>()=>cancelAnimationFrame(frameRef.current),[]);

  return <section className="arcade-page"><div className="page-heading arcade-heading"><div><div className="eyebrow">NO SIGNAL. STILL SOCIAL.</div><h1>Nexora Offline Arcade</h1><p>A campus runner built into the app. No internet, downloads, or tracking needed.</p></div><div className={`network-pill ${online?'online':'offline'}`}>{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?'Online':'Offline mode'}</div></div><div className="arcade-shell"><div className="arcade-toolbar"><div><span className="arcade-logo"><Gamepad2 size={21}/></span><div><strong>Campus Run</strong><small>Jump over deadlines. Collect teal sparks.</small></div></div><div className="arcade-stats"><span>SCORE <strong>{String(score).padStart(4,'0')}</strong></span><span><Trophy size={15}/> BEST <strong>{String(best).padStart(4,'0')}</strong></span></div></div><div className="game-stage" onPointerDown={jump}><canvas ref={canvasRef} width={WIDTH} height={HEIGHT} aria-label="Campus Run game area"/><div className={`game-message ${status==='playing'?'hidden':''}`}><span><Zap size={25}/></span><h2>{status==='over'?'Run complete':'Ready between classes?'}</h2><p>{status==='over'?`You scored ${score}. One more run?`:'Use Space, W, ↑, tap, or click to jump.'}</p><button className="btn primary" onClick={e=>{e.stopPropagation();start();}}>{status==='over'?'Run again':'Start run'}</button></div></div><div className="arcade-footer"><span><kbd>SPACE</kbd><kbd>↑</kbd><kbd>W</kbd> to jump</span><button className="jump-button" onPointerDown={e=>{e.stopPropagation();jump();}}><Zap size={18}/> JUMP</button><span>High score stays on this device</span></div></div><div className="offline-note"><WifiOff size={21}/><div><strong>Available when the network is not.</strong><p>Visit this arcade once while online. Nexora caches the game on this device so you can return when campus Wi-Fi disappears.</p></div></div></section>;
}
