const INTRO = [
  "This record was created to keep track of all memes that have been minted as NFTs or tokens, as well as all additional NFTs the meme creators have minted as derivatives of their work, and any other culturally impactful stories that have been put onchain.",
  "It is maintained by the Bureau of Internet Culture, a collective of people who collect memes. We believe that internet memes should be created natively as digital objects to track their provenance. Please help us expand this list by offering any knowledge you may have.",
];

const NOTES = [
  "This document has several sheets, breaking entries down into different categories.",
  "Most memes are minted as 1-of-1 artworks, which is a format closely analogous to what we are used to in the traditional art world. However, this is not always the case.",
  "Some memes have their 'first editions' minted as open editions. Other memes may have been 'officially' minted in the context of their first appearance — for example, both pepe and trollface were minted in their original comic strips.",
  "With this said, the ontology of memes, art and ownership are still very much up for debate. This is what we hope to help explore in the process of cataloguing these meme NFTs.",
];

const LEGEND: [string, string][] = [
  [
    "Meme name",
    "The most recognized name(s) of the meme. The name is hyperlinked to its KYM entry if it exists, and otherwise to another documenting or originating source. A meme must have a single entry — additional related images from the same creator are in the collections sheet. The only exception to this is Gigachad, as both linked images are equally recognizeable.",
  ],
  [
    "Creator name",
    "The real name or handle of the creator. This is hyperlinked to an existing social media they control, which may in some cases be a blog.",
  ],
  [
    "Price of last sale",
    "Manually updated. Usually quoted in eth as this is the sale currency for most meme NFTs. This is hyperlinked to a marketplace listing of the token. This link typically includes the contract address and ID of the token.",
  ],
];

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="text-xl font-semibold tracking-tight">Rules</h1>

      <div className="card space-y-3 p-5 leading-relaxed">
        {INTRO.map((p) => (
          <p key={p}>{p}</p>
        ))}
      </div>

      <p className="card border-warn/40 bg-warn/5 p-4 text-sm font-medium text-warn">
        Tokens should only be added if they have some tangible connection to the
        creator of their image. Your standard memecoin does not belong here.
      </p>

      <div className="card space-y-3 p-5 text-sm leading-relaxed text-muted">
        {NOTES.map((p) => (
          <p key={p}>{p}</p>
        ))}
        <p className="italic">[need to go over nuances of each question]</p>
      </div>

      <div className="card p-5">
        <h2 className="mb-3 font-medium">Legend</h2>
        <dl className="space-y-3 text-sm">
          {LEGEND.map(([term, def]) => (
            <div key={term}>
              <dt className="font-medium">{term}</dt>
              <dd className="text-muted">{def}</dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
