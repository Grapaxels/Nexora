import { col } from './db.js';
export async function seed() {
  if (await col('users').findOne({})) return;
  const now = Date.now();
  const users = [['demo-student','student@nexora.edu','Alex Morgan','Midnight Panda'],['demo-priya','priya@nexora.edu','Priya Sharma','Curious Otter'],['demo-arjun','arjun@nexora.edu','Arjun Mehta','Quiet Fox'],['demo-sara','sara@nexora.edu','Sara Khan','Cosmic Owl']].map(u => ({id:u[0],email:u[1],name:u[2],alias:u[3],created:now-86400000*60}));
  await col('users').insertMany(users);
  const items = [
    ['headphones','demo-priya','Over-ear studio headphones','A little less noise, a lot more focus. Comfortable over-ear headphones, in excellent working condition. Comes with the original cable. Happy to let you try them before buying.',1800,'Electronics','Like new','Library square','Sell',1,'headphones'],
    ['books','demo-arjun','The weekend reading stack','A collection of well-loved books looking for their next reader. All pages intact, a few pencil notes. Selling the whole stack together.',450,'Books','Good','North hostel','Sell',1,'books'],
    ['chair','demo-sara','Your new favourite study chair','Comfortable desk chair. Moving out this semester and would love for someone on campus to use it. Pickup from the hostel lobby.',1200,'Furniture','Good','South hostel','Sell',1,'chair'],
    ['lamp','demo-priya','Minimal desk lamp','A simple light for late-night study sessions. Works perfectly. Pick it up from the library square after classes.',0,'Hostel essentials','Good','Library square','Free',0,'lamp'],
    ['bike','demo-arjun','Everyday campus bicycle','Reliable bicycle for getting between lectures. Recently serviced. Test rides welcome near the sports complex.',3500,'Sports','Good','Sports complex','Sell',1,'bike'],
    ['camera','demo-sara','Camera for your next adventure','An entry-level camera for photography club days. Includes strap and a carry bag. Looking to exchange for a tablet or e-reader.',0,'Electronics','Like new','Student centre','Exchange',0,'camera'],
    ['backpack','demo-priya','Everyday college backpack','Room for your laptop, notebooks and all the things you probably do not need. Clean and ready for its next semester.',650,'Clothing','Like new','North hostel','Sell',0,'backpack'],
    ['plant','demo-student','A little green for your desk','An easy-care plant, free to a good home. I am leaving campus and cannot take it with me. Pot included.',0,'Hostel essentials','Good','Student centre','Free',1,'plant']
  ];
  await col('listings').insertMany(items.map((i,n)=>({id:i[0],user_id:i[1],title:i[2],description:i[3],price:i[4],category:i[5],condition:i[6],location:i[7],kind:i[8],semester:!!i[9],images:[`/images/${i[10]}.jpg`],sold:false,created:now-n*3600000})));
  const posts = [
    ['p1','demo-priya','What’s your underrated study spot on campus?','The library is packed this week. Looking for somewhere quiet with a charging point and decent coffee nearby. Share your hidden gems!','Campus life',1],
    ['p2','demo-arjun','Anyone up for a weekend badminton group?','All skill levels welcome. Thinking Saturday at 7 AM at the sports complex. Bring a racket if you have one!','Meetups',1],
    ['p3','demo-sara','Looking for a scientific calculator under ₹600','Need one for this semester. A Casio fx-991 or something similar would be perfect. Can pick up anywhere on campus.','Want to buy',0],
    ['p4','demo-student','A small reminder: it’s okay to start over.','Changed my project idea for the third time today. If you are figuring things out too, you are definitely not alone. We have got this.','Campus life',1],
    ['p5','demo-priya','Book exchange before the new semester?','Let’s trade books instead of buying new ones. Drop the books you have and the ones you need in the comments.','Academics',0]
  ];
  await col('posts').insertMany(posts.map((p,n)=>({id:p[0],user_id:p[1],title:p[2],body:p[3],community:p[4],anonymous:!!p[5],created:now-n*7200000})));
  await col('comments').insertMany([{id:'c1',post_id:'p1',user_id:'demo-arjun',body:'The top floor of the architecture block! Quiet after 4 PM and lots of natural light.',anonymous:true,created:now-100000},{id:'c2',post_id:'p1',user_id:'demo-sara',body:'Try the courtyard behind the student centre. The café there is good too.',anonymous:true,created:now-90000}]);
  await col('votes').insertMany([{user_id:'demo-arjun',post_id:'p1',value:1},{user_id:'demo-sara',post_id:'p1',value:1}]);
}
