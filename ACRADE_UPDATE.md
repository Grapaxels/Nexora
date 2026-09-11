# Nexora Acrade update

## What changed
- Sidebar label renamed from **Offline arcade** to **Acrade**.
- Login/access screen now links to **Nexora Acrade**.
- Acrade contains 10 functional games:
  1. Tic Tac Toe
  2. Connect Four
  3. Gomoku
  4. Nim 21
  5. Reversi
  6. Checkers
  7. Mancala
  8. Dots & Boxes
  9. Hexapawn
  10. Three Men's Morris
- Every game supports **Play with Bot**.
- Every game supports **Play with Friends**.
- Online rooms support **2–50 participants**.
- Quick Match first joins another waiting room, then an active anonymous room; if none exists it creates a waiting room.
- Private rooms get a 6-character room code.
- A user can join by room code even while a round is already being played, until the room reaches 50 participants.
- Classic board games are head-to-head per round. Players 3–50 enter the challenger queue and rotate into later rounds.
- The first round starts automatically as soon as player 2 joins.
- Online room state is stored in MongoDB and polled from the browser, which is compatible with Vercel serverless deployment without requiring a persistent WebSocket server.

## MongoDB
The project creates indexes for the `arcade_rooms` collection automatically. MongoDB Atlas must be reachable from the Vercel deployment for online rooms. Bot games do not need an online room.

## Validation performed
- Server JavaScript syntax checked.
- React/JSX parsed successfully.
- All 10 game engines were automatically played from initial state to a valid completed state.
