// Everyone in the Characters screen, in the order they're shown.
// kind: 'cat' (drawn with buildCat) or 'person' (drawn with buildRoommate, Valerie in her car).
const CHARACTER_INFO = [
  {
    id: 'bruce', kind: 'cat', name: 'Bruce', role: 'Playable cat',
    bio: 'A black-and-white tuxedo menace. Raised like a dog, plays rough with his claws, and slips out through any hole in the window screens.',
    game: 'Ability: POUNCE. Dashes forward claws-first, knocking out any roommate he hits and smashing anything thrown at him. Runs a little faster than Gremlin.',
    tip: 'Pounce through a roommate the moment they wind up to throw.',
  },
  {
    id: 'gremlin', kind: 'cat', name: 'Gremlin', role: 'Playable cat',
    bio: 'Fluffy, grumpy and soft-pawed. Growls first, swats second, then disappears until things calm down.',
    game: 'Ability: GROWL. Stuns every roommate nearby for 3 seconds and swats away anything in the air. Stunned roommates can\'t hurt her. Hold jump to float down on her fluff.',
    tip: 'Floating makes the long gaps easy. Growl, then walk right past.',
  },
  {
    id: 'robert', kind: 'person', name: 'Robert', role: 'Roommate',
    bio: 'Computer nerd and neat freak who keeps his \'91 Accord running himself.',
    game: 'Walks a tidy, steady patrol and lobs spinning wrenches at you in high arcs.',
    tip: 'Wrenches come down where you\'re standing. Keep moving and jump between throws.',
  },
  {
    id: 'bill', kind: 'person', name: 'Bill', role: 'Roommate',
    bio: 'Loves to cook. Doing the dishes afterwards, not so much.',
    game: 'Shuffles around slowly and flings dirty plates straight at you.',
    tip: 'Plates fly low and straight, so a single jump clears them.',
  },
  {
    id: 'steven', kind: 'person', name: 'Steven', role: 'Roommate',
    bio: 'Horror-movie fan with a backwards cap, dark shades and a big beard.',
    game: 'Crouches and lurks, then jump-scares you with a leap when you get close.',
    tip: 'Bait the leap, step back, and stomp him while he catches his breath.',
  },
  {
    id: 'cynthea', kind: 'person', name: 'Cynthea', role: 'Roommate',
    bio: 'The loudest one at the party and the grumpiest one the morning after.',
    game: 'Party mode: bounces around and blasts loud shout waves. Hungover: a grey cloud appears and she barely moves.',
    tip: 'Wait for the grey cloud, then stomp her while she\'s slow.',
  },
  {
    id: 'bobby', kind: 'person', name: 'Crazy Bobby', role: 'Friend',
    bio: 'Life of the party, forever quoting Macho Man Randy Savage. Oooh yeah.',
    game: 'Winds up, leaps at you and lands a flying elbow drop that sends shockwaves along the ground both ways.',
    tip: 'Jump the shockwaves, then stomp him while he gets back up.',
  },
  {
    id: 'val', kind: 'person', name: 'Valerie', role: 'Friend',
    bio: 'The one who drives everybody around. Doesn\'t want to deal with this right now.',
    game: 'Cruises back and forth in her car and floors it when you\'re in front of her.',
    tip: 'Jump over the car, or land on the roof to make her pull over.',
  },
  {
    id: 'stevenp', kind: 'person', name: 'Steven P', role: 'Helper',
    bio: 'The homie of homies. Always shows up when a friend is stuck on the side of the road.',
    game: 'Fall into a gap and he pops up, catches you and tosses you back to solid ground. No life lost. Once per checkpoint.',
    tip: 'Reach the next checkpoint and he\'s back on call.',
  },
];
