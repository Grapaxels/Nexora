import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Bot, Check, Clipboard, Gamepad2, Hash, LoaderCircle, Radio, RotateCcw, Sparkles, Users, Wifi, WifiOff, X } from 'lucide-react';
import { api } from './lib';
import { ARCADE_GAMES, applyGameMove, chooseBotMove, createGameState, gameById, legalMoves } from '../shared/arcadeGames.js';

function getArcadePlayer(){
  let id=localStorage.getItem('nexora-acrade-player');
  if(!id){id=crypto.randomUUID();localStorage.setItem('nexora-acrade-player',id);}
  return id;
}

function CellPiece({value,type='disc'}){
  if(value==null)return null;
  if(type==='checkers')return <span className={`checker-piece p${value===1||value===3?0:1} ${value>=3?'king':''}`}>{value>=3?'K':''}</span>;
  if(type==='pawn')return <span className={`pawn-piece p${value-1}`}>♟</span>;
  return <span className={`board-piece p${value}`}>{type==='mark'?(value===0?'X':'O'):''}</span>;
}

function SelectMoveBoard({state,onMove,interactive,type}){
  const [selected,setSelected]=useState(null);
  const moves=useMemo(()=>legalMoves(state,state.current),[state]);
  useEffect(()=>setSelected(state.forceFrom??null),[state.moveCount,state.forceFrom]);
  const size=state.size||8;
  const click=index=>{
    if(!interactive)return;
    const piece=state.board[index];
    if(type==='morris'){
      if(state.placed[state.current]<3){if(piece==null&&moves.includes(index))onMove(index);return;}
      if(piece===state.current){setSelected(index);return;}
      if(selected!=null){const move=moves.find(m=>m.from===selected&&m.to===index);if(move){onMove(move);setSelected(null);}}
      return;
    }
    const mine=type==='checkers'?(piece!=null&&((piece===1||piece===3)?0:1)===state.current):(piece===state.current+1);
    if(mine){setSelected(index);return;}
    if(selected!=null){const move=moves.find(m=>m.from===selected&&m.to===index);if(move){onMove(move);setSelected(null);}}
  };
  return <div className={`select-board ${type}`} style={{'--board-size':size}}>{state.board.map((v,i)=>{
    const r=Math.floor(i/size),c=i%size,dest=type==='morris'?(state.placed[state.current]<3?moves.includes(i):selected!=null&&moves.some(m=>m.from===selected&&m.to===i)):selected!=null&&moves.some(m=>m.from===selected&&m.to===i);
    return <button key={i} className={`select-cell ${(r+c)%2?'dark':'light'} ${selected===i?'selected':''} ${dest?'destination':''}`} onClick={()=>click(i)} disabled={!interactive} aria-label={`Board cell ${r+1}, ${c+1}`}><CellPiece value={v} type={type==='morris'?'disc':type}/></button>;
  })}</div>;
}

function GameBoard({state,onMove,interactive=true}){
  const moves=useMemo(()=>legalMoves(state,state.current),[state]);
  if(state.kind==='grid')return <div className={`grid-game ${state.size>3?'gomoku':''}`} style={{'--board-size':state.size}}>{state.board.map((v,i)=><button key={i} className={`grid-cell p${v}`} disabled={!interactive||v!=null} onClick={()=>onMove(i)}><CellPiece value={v} type="mark"/></button>)}</div>;
  if(state.kind==='connect4')return <div className="connect-board">{state.board.map((v,i)=><button key={i} className="connect-cell" disabled={!interactive||!moves.includes(i%7)} onClick={()=>onMove(i%7)} aria-label={`Drop in column ${(i%7)+1}`}><CellPiece value={v}/></button>)}</div>;
  if(state.kind==='nim')return <div className="nim-game"><div className="nim-stones">{Array.from({length:state.stones},(_,i)=><span key={i}/>)}</div><strong>{state.stones} stones left</strong><div className="nim-actions">{[1,2,3].map(n=><button key={n} className="btn" disabled={!interactive||!moves.includes(n)} onClick={()=>onMove(n)}>Take {n}</button>)}</div></div>;
  if(state.kind==='reversi')return <div className="reversi-board">{state.board.map((v,i)=><button key={i} className={`reversi-cell ${moves.includes(i)&&interactive?'legal':''}`} disabled={!interactive||!moves.includes(i)} onClick={()=>onMove(i)}><CellPiece value={v}/></button>)}</div>;
  if(state.kind==='checkers')return <SelectMoveBoard state={state} onMove={onMove} interactive={interactive} type="checkers"/>;
  if(state.kind==='hexapawn')return <SelectMoveBoard state={state} onMove={onMove} interactive={interactive} type="pawn"/>;
  if(state.kind==='mancala'){
    const legal=new Set(moves);
    return <div className="mancala-board"><div className="mancala-store p1"><span>{state.pits[13]}</span></div><div className="mancala-middle"><div className="mancala-row top">{[12,11,10,9,8,7].map(i=><button key={i} disabled={!interactive||!legal.has(i)} onClick={()=>onMove(i)}><span>{state.pits[i]}</span></button>)}</div><div className="mancala-row bottom">{[0,1,2,3,4,5].map(i=><button key={i} disabled={!interactive||!legal.has(i)} onClick={()=>onMove(i)}><span>{state.pits[i]}</span></button>)}</div></div><div className="mancala-store p0"><span>{state.pits[6]}</span></div></div>;
  }
  if(state.kind==='dots'){
    const legalKeys=new Set(moves.map(m=>`${m.o}${m.i}`));const cells=[];
    for(let y=0;y<7;y++)for(let x=0;x<7;x++){
      if(y%2===0&&x%2===0)cells.push(<span key={`${y}-${x}`} className="dot-node"/>);
      else if(y%2===0){const row=y/2,col=(x-1)/2,i=row*3+col,v=state.h[i];cells.push(<button key={`${y}-${x}`} className={`dot-edge h p${v}`} disabled={!interactive||!legalKeys.has(`h${i}`)} onClick={()=>onMove({o:'h',i})}/>);}
      else if(x%2===0){const row=(y-1)/2,col=x/2,i=row*4+col,v=state.v[i];cells.push(<button key={`${y}-${x}`} className={`dot-edge v p${v}`} disabled={!interactive||!legalKeys.has(`v${i}`)} onClick={()=>onMove({o:'v',i})}/>);}
      else {const row=(y-1)/2,col=(x-1)/2,v=state.boxes[row*3+col];cells.push(<span key={`${y}-${x}`} className={`dot-box p${v}`}>{v==null?'':v+1}</span>);}
    }
    return <div><div className="dots-score"><span>Player 1 <strong>{state.scores[0]}</strong></span><span>Player 2 <strong>{state.scores[1]}</strong></span></div><div className="dots-board">{cells}</div></div>;
  }
  if(state.kind==='morris')return <SelectMoveBoard state={{...state,size:3}} onMove={onMove} interactive={interactive} type="morris"/>;
  return null;
}

function StatusBar({state,mode,seat=0,room}){
  let text;
  if(mode==='friends'&&seat<0)text=`Watching round ${room?.round||1} · challenger queue #${room?.queuePosition||1}`;
  else if(state.finished)text=state.draw?'Draw game.':mode==='bot'?(state.winner===0?'You won!':'Bot won.'):(state.winner===seat?'You won this round!':`Player ${state.winner+1} won this round.`);
  else if(mode==='bot')text=state.current===0?'Your turn':'Bot is thinking…';
  else text=state.current===seat?'Your turn':`Player ${state.current+1}'s turn`;
  return <div className={`game-status ${state.finished?'finished':''}`}><span className={`turn-dot p${state.current}`}/><strong>{text}</strong></div>;
}

function RoomRoster({room}){
  if(!room)return null;
  return <aside className="room-roster"><div className="room-roster-head"><div><strong>Room players</strong><small>{room.playerCount}/{room.capacity} joined</small></div><span>{room.queuedCount?`${room.queuedCount} queued`:'2 active'}</span></div><div className="room-player-list">{room.players.map(player=><div key={player.index} className={`room-player ${player.role}`}><span className={`room-player-dot ${player.activeSeat==null?'queue':`p${player.activeSeat}`}`}/><div><strong>{player.label}</strong><small>{player.activeSeat!=null?`Playing as Player ${player.activeSeat+1}`:`Challenger #${player.queuePosition}`}</small></div></div>)}</div><p>Classic games are head-to-head. Players 3–50 remain in the challenger queue and rotate into later rounds.</p></aside>;
}

export default function Arcade(){
  const playerRef=useRef(getArcadePlayer());
  const [online,setOnline]=useState(navigator.onLine);
  const [selectedId,setSelectedId]=useState(null);
  const [mode,setMode]=useState(null);
  const [localState,setLocalState]=useState(null);
  const [room,setRoom]=useState(null);
  const [joinCode,setJoinCode]=useState('');
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [copied,setCopied]=useState(false);
  const selected=gameById(selectedId);
  const roomState=room?.state;
  const request=(path,options={})=>api(path,{...options,headers:{'X-Arcade-Player':playerRef.current,...(options.headers||{})}});

  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
  useEffect(()=>{
    if(mode!=='bot'||!localState||localState.finished||localState.current!==1)return;
    const timer=setTimeout(()=>{setLocalState(current=>{if(!current||current.finished||current.current!==1)return current;const move=chooseBotMove(current);return move==null?current:applyGameMove(current,move);});},480);
    return()=>clearTimeout(timer);
  },[mode,localState]);
  useEffect(()=>{
    if(mode!=='friends'||!room?.id)return;
    let stopped=false;
    const poll=async()=>{try{const next=await request(`/arcade/rooms/${room.id}`);if(!stopped){setRoom(next);setError('');}}catch(e){if(!stopped&&e.status!==404)setError(e.message);}};
    const id=setInterval(poll,1100);return()=>{stopped=true;clearInterval(id);};
  },[mode,room?.id]);

  const botMove=move=>{if(!localState||localState.finished||localState.current!==0)return;try{setLocalState(applyGameMove(localState,move));setError('');}catch(e){setError(e.message);}};
  const onlineMove=async move=>{if(!room||room.status!=='active'||room.seat<0||room.state.current!==room.seat||busy)return;setBusy(true);try{setRoom(await request(`/arcade/rooms/${room.id}/move`,{method:'POST',body:{move}}));setError('');}catch(e){setError(e.message);try{setRoom(await request(`/arcade/rooms/${room.id}`));}catch{}}finally{setBusy(false);}};
  const startBot=()=>{setMode('bot');setRoom(null);setError('');setLocalState(createGameState(selectedId));};
  const startFriends=()=>{setMode('friends');setLocalState(null);setRoom(null);setError('');};
  const roomAction=async(kind)=>{if(!online){setError('You are offline. Connect to the internet to play with friends.');return;}setBusy(true);setError('');try{const next=kind==='quick'?await request('/arcade/match',{method:'POST',body:{gameId:selectedId}}):await request('/arcade/rooms',{method:'POST',body:{gameId:selectedId}});setRoom(next);}catch(e){setError(e.message);}finally{setBusy(false);}};
  const joinRoom=async e=>{e?.preventDefault();if(joinCode.trim().length!==6)return;setBusy(true);setError('');try{const next=await request('/arcade/rooms/join',{method:'POST',body:{code:joinCode.trim().toUpperCase()}});setSelectedId(next.gameId);setMode('friends');setRoom(next);}catch(e2){setError(e2.message);}finally{setBusy(false);}};
  const nextRound=async()=>{if(!room?.id||busy)return;setBusy(true);setError('');try{setRoom(await request(`/arcade/rooms/${room.id}/next`,{method:'POST'}));}catch(e){if(e.status===409){try{setRoom(await request(`/arcade/rooms/${room.id}`));}catch{};}else setError(e.message);}finally{setBusy(false);}};
  const copyCode=async()=>{if(!room?.code)return;try{await navigator.clipboard.writeText(room.code);setCopied(true);setTimeout(()=>setCopied(false),1500);}catch{setError('Copy failed. Select the room code manually.');}};
  const leave=async()=>{const current=room;setRoom(null);setMode(null);setError('');if(current?.id)try{await request(`/arcade/rooms/${current.id}/leave`,{method:'POST'});}catch{}};
  const backToGames=async()=>{if(room?.id)try{await request(`/arcade/rooms/${room.id}/leave`,{method:'POST'});}catch{}setRoom(null);setMode(null);setSelectedId(null);setLocalState(null);setError('');};

  if(!selected)return <section className="arcade-page"><div className="page-heading arcade-heading"><div><div className="eyebrow">PLAY. PAIR. COMPETE.</div><h1>Nexora Acrade</h1><p>Ten fully playable games. Challenge the bot or enter an anonymous online room with up to 50 people.</p></div><div className={`network-pill ${online?'online':'offline'}`}>{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?'Online rooms ready':'Bot games available offline'}</div></div><div className="acrade-intro"><div><Sparkles size={21}/><strong>10 games, two ways to play</strong><p>Every game supports an automated bot and online rooms.</p></div><div><Users size={21}/><strong>2–50 people per room</strong><p>Two active players compete while everyone else rotates through the challenger queue.</p></div><div><Hash size={21}/><strong>Quick Match + room codes</strong><p>Join a live anonymous room or create a code for your friends.</p></div></div><div className="game-catalog">{ARCADE_GAMES.map((g,i)=><button key={g.id} className="game-card" onClick={()=>{setSelectedId(g.id);setError('');}}><span className="game-number">{String(i+1).padStart(2,'0')}</span><span className="game-icon">{g.icon}</span><strong>{g.name}</strong><p>{g.description}</p><span className="game-player-count"><Users size={13}/> Bot or 2–50 online</span></button>)}</div></section>;

  if(!mode)return <section className="arcade-page"><button className="acrade-back" onClick={()=>setSelectedId(null)}><ArrowLeft size={16}/> All games</button><div className="mode-hero"><span className="game-icon large">{selected.icon}</span><div><div className="eyebrow">{selected.name.toUpperCase()}</div><h1>How do you want to play?</h1><p>{selected.description}</p></div></div><div className="mode-grid"><button className="mode-card" onClick={startBot}><span><Bot size={30}/></span><div><strong>Play with Bot</strong><p>Start instantly against Nexora's automated opponent. No room or second person required.</p></div><b>START SOLO →</b></button><button className="mode-card" onClick={startFriends}><span><Users size={30}/></span><div><strong>Play with Friends</strong><p>Quick Match, create a room, or join by code. Every online room accepts up to 50 people.</p></div><b>PLAY ONLINE →</b></button></div></section>;

  if(mode==='friends'&&!room)return <section className="arcade-page"><button className="acrade-back" onClick={()=>setMode(null)}><ArrowLeft size={16}/> Choose mode</button><div className="page-heading"><div><div className="eyebrow">{selected.name.toUpperCase()} · ONLINE</div><h1>Play with Friends</h1><p>Minimum 2 players to start. Up to 50 people can join each room.</p></div><div className={`network-pill ${online?'online':'offline'}`}>{online?<Wifi size={15}/>:<WifiOff size={15}/>} {online?'Connected':'Offline'}</div></div>{error&&<div className="acrade-error"><X size={16}/>{error}</div>}<div className="friend-options"><button disabled={busy||!online} onClick={()=>roomAction('quick')}><span><Radio size={28}/></span><strong>Quick Match</strong><p>Join an anonymous room that is waiting or already playing. If no room exists, you wait until somebody joins.</p><b>{busy?'MATCHING…':'FIND ROOM →'}</b></button><button disabled={busy||!online} onClick={()=>roomAction('private')}><span><Hash size={28}/></span><strong>Create Room</strong><p>Create a room for 2–50 people and get a six-character code to share.</p><b>CREATE CODE →</b></button><form onSubmit={joinRoom}><span><Users size={28}/></span><strong>Join Room</strong><p>Enter a six-character room code. You can join while a round is already in progress.</p><div className="join-code-row"><input value={joinCode} onChange={e=>setJoinCode(e.target.value.toUpperCase().replace(/[^A-Z2-9]/g,'').slice(0,6))} maxLength={6} placeholder="ABC234" aria-label="Room code"/><button className="btn primary" disabled={busy||!online||joinCode.length!==6}>Join</button></div></form></div></section>;

  if(mode==='friends'&&room?.status==='waiting')return <section className="arcade-page"><button className="acrade-back" onClick={leave}><ArrowLeft size={16}/> Leave room</button><div className="waiting-layout"><div className="waiting-room"><span className="waiting-icon"><LoaderCircle size={34}/></span><div className="eyebrow">{selected.name.toUpperCase()}</div><h1>Waiting for one more player</h1><p>{room.mode==='quick'?'Your anonymous room is live. The first round starts automatically when Player 2 arrives.':'Share this room code. The first round starts as soon as at least two people are here.'}</p><div className="room-code"><span>{room.code}</span><button onClick={copyCode}>{copied?<Check size={19}/>:<Clipboard size={19}/>} {copied?'Copied':'Copy code'}</button></div><div className="waiting-players"><span className="ready"><Check size={15}/> {room.playerCount} player joined</span><span><LoaderCircle size={15}/> Need {Math.max(0,2-room.playerCount)} more</span></div>{error&&<div className="acrade-error"><X size={16}/>{error}</div>}</div><RoomRoster room={room}/></div></section>;

  const state=mode==='bot'?localState:roomState;const seat=mode==='bot'?0:room?.seat??-1;const canMove=!!state&&!state.finished&&(mode==='bot'?state.current===0:(room.status==='active'&&seat>=0&&state.current===seat&&!busy));
  const playerSubtitle=mode==='bot'?'You vs Bot':seat>=0?`Round ${room.round} · You are active Player ${seat+1}`:`Round ${room.round} · Challenger queue #${room.queuePosition}`;
  return <section className="arcade-page"><div className="play-top"><button className="acrade-back" onClick={mode==='bot'?()=>{setMode(null);setLocalState(null);}:leave}><ArrowLeft size={16}/> {mode==='bot'?'Choose mode':'Leave room'}</button>{mode==='friends'&&<div className="room-top-actions"><span className="room-count"><Users size={14}/>{room.playerCount}/{room.capacity}</span><button className="mini-room-code" onClick={copyCode}><Hash size={14}/>{room.code}{copied?<Check size={13}/>:<Clipboard size={13}/>}</button></div>}</div><div className={`play-layout ${mode==='friends'?'with-roster':''}`}><div className="play-shell"><div className="play-header"><div><span className="game-icon small">{selected.icon}</span><div><strong>{selected.name}</strong><small>{playerSubtitle}</small></div></div><div className="player-pills"><span className="p0">{room?.activePlayers?.[0]?.label||'Player 1'}</span><span className="versus">VS</span><span className="p1">{mode==='bot'?'Bot':room?.activePlayers?.[1]?.label||'Player 2'}</span></div></div>{state&&<><StatusBar state={state} mode={mode} seat={seat} room={room}/><div className={`board-wrap ${!canMove?'locked':''}`}><GameBoard state={state} onMove={mode==='bot'?botMove:onlineMove} interactive={canMove}/>{mode==='friends'&&seat<0&&!state.finished&&<div className="spectator-note"><Users size={18}/><span><strong>You’re in the challenger queue.</strong><small>Watch this round. The queue rotates when the next round begins.</small></span></div>}</div>{state.finished&&<div className="game-finish"><strong>{state.draw?'Nobody takes this round.':'Round complete.'}</strong><p>{mode==='bot'?'Reset the board for another round against the bot.':room.queuedCount?`${room.queuedCount} challenger${room.queuedCount===1?' is':'s are'} waiting. Start the next round to rotate players.`:'Start another round in the same room.'}</p><div>{mode==='bot'?<button className="btn primary" onClick={()=>setLocalState(createGameState(selectedId))}><RotateCcw size={16}/> Play again</button>:<button className="btn primary" disabled={busy} onClick={nextRound}><RotateCcw size={16}/> {busy?'Starting…':'Next round'}</button>}<button className="btn" onClick={backToGames}><Gamepad2 size={16}/> All games</button></div></div>}</>}{error&&<div className="acrade-error"><X size={16}/>{error}</div>}</div>{mode==='friends'&&<RoomRoster room={room}/>}</div></section>;
}
