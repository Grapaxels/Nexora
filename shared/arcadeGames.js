export const ARCADE_GAMES = [
  { id:'tic-tac-toe', name:'Tic Tac Toe', icon:'✕', description:'Classic 3×3 strategy. Make three in a row.', players:2 },
  { id:'connect-four', name:'Connect Four', icon:'●', description:'Drop discs and connect four before your rival.', players:2 },
  { id:'gomoku', name:'Gomoku', icon:'◆', description:'A 9×9 five-in-a-row strategy duel.', players:2 },
  { id:'nim', name:'Nim 21', icon:'▥', description:'Take 1–3 stones. Whoever takes the last wins.', players:2 },
  { id:'reversi', name:'Reversi', icon:'◐', description:'Flip rival discs and control the board.', players:2 },
  { id:'checkers', name:'Checkers', icon:'◉', description:'Capture every rival piece on an 8×8 board.', players:2 },
  { id:'mancala', name:'Mancala', icon:'◌', description:'Sow stones, capture cleverly, fill your store.', players:2 },
  { id:'dots-boxes', name:'Dots & Boxes', icon:'□', description:'Draw lines, complete boxes, score the most.', players:2 },
  { id:'hexapawn', name:'Hexapawn', icon:'♟', description:'Tiny pawn chess: advance, capture, outplay.', players:2 },
  { id:'three-morris', name:"Three Men's Morris", icon:'△', description:'Place three stones, then move to form a line.', players:2 },
];

const clone=value=>structuredClone(value);
const opponent=p=>p===0?1:0;
const inBoard=(r,c,n)=>r>=0&&c>=0&&r<n&&c<n;
const gridWin=(board,n,needed)=>{
  const dirs=[[1,0],[0,1],[1,1],[1,-1]];
  for(let r=0;r<n;r++)for(let c=0;c<n;c++){
    const v=board[r*n+c];if(v==null)continue;
    for(const [dr,dc] of dirs){let count=1;for(let k=1;k<needed;k++){const rr=r+dr*k,cc=c+dc*k;if(!inBoard(rr,cc,n)||board[rr*n+cc]!==v)break;count++;}if(count>=needed)return v;}
  }
  return null;
};
const lineWins=[[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
const resultState=(s,winner,draw=false)=>({...s,winner,draw,finished:true});

export function createGameState(gameId){
  switch(gameId){
    case 'tic-tac-toe': return {gameId,kind:'grid',size:3,needed:3,board:Array(9).fill(null),current:0,winner:null,draw:false,finished:false,moveCount:0};
    case 'connect-four': return {gameId,kind:'connect4',rows:6,cols:7,board:Array(42).fill(null),current:0,winner:null,draw:false,finished:false,moveCount:0};
    case 'gomoku': return {gameId,kind:'grid',size:9,needed:5,board:Array(81).fill(null),current:0,winner:null,draw:false,finished:false,moveCount:0};
    case 'nim': return {gameId,kind:'nim',stones:21,current:0,winner:null,draw:false,finished:false,moveCount:0};
    case 'reversi': {
      const board=Array(64).fill(null);board[3*8+3]=1;board[3*8+4]=0;board[4*8+3]=0;board[4*8+4]=1;
      return {gameId,kind:'reversi',size:8,board,current:0,winner:null,draw:false,finished:false,moveCount:0};
    }
    case 'checkers': {
      const board=Array(64).fill(null);
      for(let r=0;r<3;r++)for(let c=0;c<8;c++)if((r+c)%2===1)board[r*8+c]=2;
      for(let r=5;r<8;r++)for(let c=0;c<8;c++)if((r+c)%2===1)board[r*8+c]=1;
      return {gameId,kind:'checkers',size:8,board,current:0,forceFrom:null,winner:null,draw:false,finished:false,moveCount:0};
    }
    case 'mancala': return {gameId,kind:'mancala',pits:[4,4,4,4,4,4,0,4,4,4,4,4,4,0],current:0,winner:null,draw:false,finished:false,moveCount:0};
    case 'dots-boxes': return {gameId,kind:'dots',rows:3,cols:3,h:Array(12).fill(null),v:Array(12).fill(null),boxes:Array(9).fill(null),scores:[0,0],current:0,winner:null,draw:false,finished:false,moveCount:0};
    case 'hexapawn': return {gameId,kind:'hexapawn',size:3,board:[2,2,2,null,null,null,1,1,1],current:0,winner:null,draw:false,finished:false,moveCount:0};
    case 'three-morris': return {gameId,kind:'morris',board:Array(9).fill(null),placed:[0,0],current:0,winner:null,draw:false,finished:false,moveCount:0};
    default: throw new Error('Unknown arcade game.');
  }
}

function reversiCaptures(state,index,player){
  if(state.board[index]!=null)return [];
  const r=Math.floor(index/8),c=index%8,out=[];
  for(const [dr,dc] of [[-1,-1],[-1,0],[-1,1],[0,-1],[0,1],[1,-1],[1,0],[1,1]]){
    let rr=r+dr,cc=c+dc;const path=[];
    while(inBoard(rr,cc,8)&&state.board[rr*8+cc]===opponent(player)){path.push(rr*8+cc);rr+=dr;cc+=dc;}
    if(path.length&&inBoard(rr,cc,8)&&state.board[rr*8+cc]===player)out.push(...path);
  }
  return out;
}
function checkersMoves(state,player,capturesOnly=false,fromOnly=null){
  const board=state.board,moves=[];
  for(let from=0;from<64;from++){
    const piece=board[from];if(piece==null||((piece===1||piece===3)?0:1)!==player||fromOnly!=null&&from!==fromOnly)continue;
    const r=Math.floor(from/8),c=from%8,king=piece>=3,dirs=[];
    if(player===0||king)dirs.push([-1,-1],[-1,1]);if(player===1||king)dirs.push([1,-1],[1,1]);
    for(const [dr,dc] of dirs){
      const r1=r+dr,c1=c+dc,r2=r+dr*2,c2=c+dc*2;
      if(!capturesOnly&&inBoard(r1,c1,8)&&board[r1*8+c1]==null)moves.push({from,to:r1*8+c1});
      if(inBoard(r2,c2,8)&&board[r2*8+c2]==null&&board[r1*8+c1]!=null){const mid=board[r1*8+c1],midPlayer=(mid===1||mid===3)?0:1;if(midPlayer!==player)moves.push({from,to:r2*8+c2,capture:r1*8+c1});}
    }
  }
  return moves;
}
function hasThree(board,p){return lineWins.some(line=>line.every(i=>board[i]===p));}
const morrisAdjacent=(a,b)=>{const ar=Math.floor(a/3),ac=a%3,br=Math.floor(b/3),bc=b%3;return Math.max(Math.abs(ar-br),Math.abs(ac-bc))===1;};

export function legalMoves(state, player=state.current){
  if(!state||state.finished)return [];
  switch(state.gameId){
    case 'tic-tac-toe': case 'gomoku': return state.board.map((v,i)=>v==null?i:null).filter(v=>v!=null);
    case 'connect-four': return Array.from({length:7},(_,c)=>c).filter(c=>state.board[c]==null);
    case 'nim': return [1,2,3].filter(n=>n<=state.stones);
    case 'reversi': return state.board.map((_,i)=>reversiCaptures(state,i,player).length?i:null).filter(v=>v!=null);
    case 'checkers': {
      if(state.forceFrom!=null)return checkersMoves(state,player,true,state.forceFrom).filter(m=>m.capture!=null);
      const caps=checkersMoves(state,player,true).filter(m=>m.capture!=null);return caps.length?caps:checkersMoves(state,player,false).filter(m=>m.capture==null);
    }
    case 'mancala': return (player===0?[0,1,2,3,4,5]:[7,8,9,10,11,12]).filter(i=>state.pits[i]>0);
    case 'dots-boxes': {
      const moves=[];state.h.forEach((v,i)=>{if(v==null)moves.push({o:'h',i});});state.v.forEach((v,i)=>{if(v==null)moves.push({o:'v',i});});return moves;
    }
    case 'hexapawn': {
      const moves=[];for(let from=0;from<9;from++){if(state.board[from]!==player+1)continue;const r=Math.floor(from/3),c=from%3,dr=player===0?-1:1,nr=r+dr;if(!inBoard(nr,c,3))continue;if(state.board[nr*3+c]==null)moves.push({from,to:nr*3+c});for(const dc of [-1,1]){const nc=c+dc;if(inBoard(nr,nc,3)&&state.board[nr*3+nc]===opponent(player)+1)moves.push({from,to:nr*3+nc});}}
      return moves;
    }
    case 'three-morris': {
      if(state.placed[player]<3)return state.board.map((v,i)=>v==null?i:null).filter(v=>v!=null);
      const moves=[];state.board.forEach((v,from)=>{if(v!==player)return;state.board.forEach((dest,to)=>{if(dest==null&&morrisAdjacent(from,to))moves.push({from,to});});});return moves;
    }
    default:return [];
  }
}

function sameMove(a,b){return JSON.stringify(a)===JSON.stringify(b);}
function assertMove(state,move){if(state.finished)throw new Error('This game is already finished.');const options=legalMoves(state,state.current);if(!options.some(m=>sameMove(m,move)))throw new Error('That move is not allowed.');}

export function applyGameMove(input,move){
  const state=clone(input);assertMove(state,move);const p=state.current,other=opponent(p);state.moveCount=(state.moveCount||0)+1;
  switch(state.gameId){
    case 'tic-tac-toe': case 'gomoku': {
      state.board[move]=p;const win=gridWin(state.board,state.size,state.needed);if(win!=null)return resultState(state,win);if(state.board.every(v=>v!=null))return resultState(state,null,true);state.current=other;return state;
    }
    case 'connect-four': {
      let row=5;while(row>=0&&state.board[row*7+move]!=null)row--;state.board[row*7+move]=p;const win=gridWin(state.board,6,4); // horizontal works; vertical/diagonal needs rectangular check below
      const b=state.board;let winner=null;for(let r=0;r<6;r++)for(let c=0;c<7;c++){const v=b[r*7+c];if(v==null)continue;for(const [dr,dc] of [[1,0],[0,1],[1,1],[1,-1]]){let ok=true;for(let k=1;k<4;k++){const rr=r+dr*k,cc=c+dc*k;if(rr<0||rr>=6||cc<0||cc>=7||b[rr*7+cc]!==v){ok=false;break;}}if(ok)winner=v;}}
      if(winner!=null)return resultState(state,winner);if(b.every(v=>v!=null))return resultState(state,null,true);state.current=other;return state;
    }
    case 'nim': state.stones-=move;if(state.stones===0)return resultState(state,p);state.current=other;return state;
    case 'reversi': {
      const flips=reversiCaptures(state,move,p);state.board[move]=p;for(const i of flips)state.board[i]=p;
      const otherMoves=legalMoves({...state,current:other},other);if(otherMoves.length)state.current=other;else if(legalMoves({...state,current:p},p).length)state.current=p;else {const counts=[state.board.filter(v=>v===0).length,state.board.filter(v=>v===1).length];return resultState(state,counts[0]===counts[1]?null:(counts[0]>counts[1]?0:1),counts[0]===counts[1]);}return state;
    }
    case 'checkers': {
      const piece=state.board[move.from];state.board[move.from]=null;state.board[move.to]=piece;if(move.capture!=null)state.board[move.capture]=null;const row=Math.floor(move.to/8);if(piece===1&&row===0)state.board[move.to]=3;if(piece===2&&row===7)state.board[move.to]=4;
      if(move.capture!=null){const again={...state,forceFrom:move.to,current:p};const nextCaps=checkersMoves(again,p,true,move.to).filter(m=>m.capture!=null);if(nextCaps.length){state.forceFrom=move.to;return state;}}
      state.forceFrom=null;state.current=other;const otherPieces=state.board.some(v=>v===(other===0?1:2)||v===(other===0?3:4));if(!otherPieces||legalMoves(state,other).length===0)return resultState(state,p);return state;
    }
    case 'mancala': {
      let stones=state.pits[move];state.pits[move]=0;let i=move;while(stones){i=(i+1)%14;if(p===0&&i===13)continue;if(p===1&&i===6)continue;state.pits[i]++;stones--;}
      const ownStart=p===0?0:7,ownEnd=p===0?5:12,store=p===0?6:13;if(i>=ownStart&&i<=ownEnd&&state.pits[i]===1){const opp=12-i;if(state.pits[opp]>0){state.pits[store]+=state.pits[opp]+1;state.pits[opp]=0;state.pits[i]=0;}}
      const side0=state.pits.slice(0,6).reduce((a,b)=>a+b,0),side1=state.pits.slice(7,13).reduce((a,b)=>a+b,0);if(side0===0||side1===0){state.pits[6]+=side0;state.pits[13]+=side1;for(let x=0;x<6;x++)state.pits[x]=0;for(let x=7;x<13;x++)state.pits[x]=0;return resultState(state,state.pits[6]===state.pits[13]?null:(state.pits[6]>state.pits[13]?0:1),state.pits[6]===state.pits[13]);}
      state.current=i===store?p:other;return state;
    }
    case 'dots-boxes': {
      state[move.o][move.i]=p;let gained=0;
      for(let r=0;r<3;r++)for(let c=0;c<3;c++){const bi=r*3+c;if(state.boxes[bi]!=null)continue;const top=state.h[r*3+c],bottom=state.h[(r+1)*3+c],left=state.v[r*4+c],right=state.v[r*4+c+1];if(top!=null&&bottom!=null&&left!=null&&right!=null){state.boxes[bi]=p;state.scores[p]++;gained++;}}
      if(state.boxes.every(v=>v!=null))return resultState(state,state.scores[0]===state.scores[1]?null:(state.scores[0]>state.scores[1]?0:1),state.scores[0]===state.scores[1]);if(!gained)state.current=other;return state;
    }
    case 'hexapawn': {
      state.board[move.to]=p+1;state.board[move.from]=null;const row=Math.floor(move.to/3);if((p===0&&row===0)||(p===1&&row===2))return resultState(state,p);state.current=other;if(legalMoves(state,other).length===0)return resultState(state,p);return state;
    }
    case 'three-morris': {
      if(typeof move==='number'){state.board[move]=p;state.placed[p]++;}else{state.board[move.from]=null;state.board[move.to]=p;}if(hasThree(state.board,p))return resultState(state,p);state.current=other;if(state.placed[0]>=3&&state.placed[1]>=3&&legalMoves(state,other).length===0)return resultState(state,p);if(state.moveCount>100)return resultState(state,null,true);return state;
    }
    default:throw new Error('Unknown arcade game.');
  }
}

export function chooseBotMove(state){
  const moves=legalMoves(state,state.current);if(!moves.length)return null;
  for(const move of moves){try{const next=applyGameMove(state,move);if(next.finished&&next.winner===state.current)return move;}catch{}}
  if(state.gameId==='tic-tac-toe'){const center=moves.find(m=>m===4);if(center!=null)return center;}
  if(state.gameId==='connect-four'){const center=moves.find(m=>m===3);if(center!=null)return center;}
  if(state.gameId==='nim'){const target=state.stones%4;const smart=moves.find(m=>m===target);if(smart)return smart;}
  if(state.gameId==='mancala'){const store=state.current===0?6:13;for(const m of moves){let stones=state.pits[m],i=m;while(stones){i=(i+1)%14;if(state.current===0&&i===13)continue;if(state.current===1&&i===6)continue;stones--;}if(i===store)return m;}}
  return moves[Math.floor(Math.random()*moves.length)];
}

export function gameById(id){return ARCADE_GAMES.find(g=>g.id===id)||null;}
