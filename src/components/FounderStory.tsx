export const FOUNDER_NAME = 'Rena Dong';

export const FOUNDER_QUOTE = 'I sometimes wished there was an easier way to let someone know where I was, keep them updated during my journey, and let them know when I had arrived.';

const STORY = [
  'The inspiration behind SafeRoute came from my own experiences.',
  'I often had late-night school performances or competitions, and after they finished, I sometimes had to walk back alone. Even though I knew where I was going, walking alone late at night could make me feel uncomfortable. I sometimes wished there was an easier way to let someone know where I was, keep them updated during my journey, and let them know when I had arrived.',
  "I realized that many other people, especially students, could experience similar situations. People often rely on texting friends or family to check in, but remembering to send updates isn't always convenient.",
  'That got me thinking: What if there was one simple app that made staying connected during a journey easier?',
  "That's what inspired me to create SafeRoute.",
  'I wanted to build an application that would help people feel more comfortable and prepared when travelling alone, while still allowing them to be independent.',
  'Through features like Journey Sharing, SafeArrival, and SafeSOS, my goal is to make it easier for people to stay connected with those they trust and access help when they need it.',
  "SafeRoute is more than just an app idea to me. It's something inspired by an experience I've personally had, and I want to turn that experience into something that could help others.",
];

/** The founder's own words. Keep them as written. */
export function FounderStory() {
  return (
    <div className="space-y-4 text-[17px] leading-relaxed text-slate-700">
      {STORY.map((p) => <p key={p}>{p}</p>)}
      <p className="font-semibold text-navy">{FOUNDER_NAME}, Founder of SafeRoute</p>
    </div>
  );
}
