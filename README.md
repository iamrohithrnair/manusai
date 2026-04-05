# Graphluence

Graphluence is for marketing consultants who are tired of guessing what actually works on social. You add a company, drop in their social links (think LinkedIn, Instagram—the places competitors actually show up), and the app builds the message Manus AI needs to go do the heavy lifting.

Here's what happens next: Manus analyzes the company you picked *and* the competitors it surfaces, in parallel. You're not waiting for one thread to finish before the other starts. Out of that comes a concrete angle on how to make marketing content for *your* client—not a generic playbook.

Down the road, this can stretch to whatever platforms Manus plugs into. You don't have to rebuild your workflow every time a new channel matters.

You can open the research in the Manus app whenever you want. Fair warning: it takes a few minutes. That's fine—you can leave, grab coffee, deal with email. The app keeps polling in the background, so when it's ready, you'll know.

When the research lands, you get a **knowledge graph**. As a consultant, you can see how everything connects back to the company you specified—competitors, themes, what content seemed to land for them. It's not a spreadsheet of bullets; it's a map you can actually read.

Head to **Content** when you're ready to generate. Manus can run fairly autonomously here. If you want the output to feel human—not polished into plastic—you can record a short audio clip and share it with Manus. It pulls out what you said, catches tone and pacing, and uses that to shape the content. Slides, video scripts, blog posts—the kind of stuff you'd actually ship for marketing. When you like it, approve it. If something's off, say what to change and iterate. After that, push it out on whatever social platforms you use.

---

## What you can do

| | |
|---:|---|
| **Company & social setup** | Add the client company and competitor-facing social URLs so research has real ground to stand on. |
| **Research via Manus** | One prompt path into Manus; company + identified competitors analyzed together; strategy for marketing content as the output. |
| **Background polling** | Start research, leave, come back—results sync when they're ready. |
| **Knowledge graph** | Explore nodes and relationships around *your* company: competitors, signals, what worked for them. |
| **Content generation** | Autonomous drafts with Manus; optional voice note so tone and style match how *you* talk. |
| **Review & ship** | Approve, request edits, iterate, then publish to the channels you choose. |

---

## Running it locally

You'll need Node.js, then:

```bash
npm install
cp .env.example .env   # add your Manus API key and app URL
npm run dev
```

Open the URL from your terminal (usually `http://localhost:3000`).

That's the gist. If you're building marketing that has to compete in the feed—not just fill a calendar—Graphluence is meant to sit between you and the noise.
