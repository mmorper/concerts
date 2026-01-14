# **Claude Code Is a Misnomer**

*It writes code, yes. But that's not why it changed how I work – as a marketer.*

## **The Audacious Goal**

Between Christmas and New Year's, I set out to build a web app.

My wife reminded me that I've used this week for a project just about every year, to learn something new. This year was no different, except that the goal felt more audacious than usual.

I wanted to create an interactive way to explore every concert I've attended since 1984\. Not a spreadsheet. A real application with visualizations, pictures of the bands, live tour dates, and historical setlists. Something I'd actually enjoy using.

I'm a product marketer with a hefty dose of historical product management, too. But to be clear, I am not an engineer. I'd never built a data pipeline. Never integrated an API. Never written a React component.

But I had Claude Code. And I had a hypothesis: I didn't need to know how to code. Maybe I just needed to know what I wanted.

What I didn't expect: the "superpowers" I discovered building this app have direct implications for how I think about marketing workflows. But I'll get to that.

## **The Honest Limitation**

Here's what I can't do: look at code and know if it's good.

I can't evaluate whether a function is efficient, an architecture is sound, or TypeScript is idiomatic. That's not my expertise. It never will be.

But here's what I realized, several frustrating moments into this project: **I don't need to evaluate code. I need to assess outcomes.**

* Does the feature work the way I want?  
* Does the design match my brand?  
* Does the writing sound like me?

These are outcomes. And I'm an expert at evaluating outcomes; it's what product and marketing people do all day.

The question became: how do I get Claude to produce the outcomes I want, consistently, without being able to inspect the machinery?

## **The Unlock**

The answer wasn't better prompting. It was better explicitness.

The more precisely I could describe the outcome I wanted, the better Claude could execute. Vague requests produced vague results – garbage in, mostly garbage out. Specific requests, like exact colors, precise dimensions, and explicit voice guidelines, typically produced exactly what I needed.

This seems obvious in retrospect. But it required a shift in how I worked. Instead of jumping into tasks, I learned a rhythm:

**Document → Ask for thoughts → Lock down → Execute**

First, I document what I want. The outcome, not the implementation. What should this feature do? What should it look like? What should it sound like?

Then I ask Claude for suggestions and questions. "What am I missing? What would you approach differently? What's ambiguous?" Claude often catches edge cases I hadn't considered, or suggests simpler approaches. I did this for functional behaviors, I did this for design and UX things, too. In fact, I even had Claude often do mocks for me just to make sure we were thinking about things the same way. 

Then I lock it down. The spec becomes the source of truth. No more improvising.

Then Claude executes. And because the outcome was explicit, I can evaluate whether we hit it, without reading a single line of code.

## **The Superpowers**

As this workflow matured, I kept hitting some friction points. Each one led me to discover capabilities in Claude Code that I hadn't known existed; capabilities that transformed how we worked together.

### **The First Problem: Claude Kept Forgetting**

Every session started from zero. I'd explain my design patterns. I would point out where my brand guidelines document was located. I'd clarify my conventions. Then the session would end, and the next one would start from ground zero again. 

The repetition was exhausting. And worse, Claude would make reasonable assumptions that didn't match my project. Consistent within a session, inconsistent across sessions.

That's when I discovered **skills**.

Skills are knowledge packages – markdown files that teach Claude about your project's patterns and standards. A design system skill documents my colors, typography, and component patterns. A voice guidelines skill defines how different documents should sound.

When Claude starts a task, it reads the relevant skills. The result: Claude already knows my project's language before writing a single line.

**The moment it clicked:** I watched Claude begin a UI task – convert my [artist gatefold](https://concerts.morperhaus.org/?scene=artists&artist=foo-fighters) (a cool design element that looks like an old school double gatefold vinyl album cover) for mobile – this snazzy UI/UX requires a lot of screen real estate, so I needed something more phone friendly. I first created my design spec for it. Then, I initiated my `/implement` command (see commands below), and without prompting, Claude announced it was reading the design system skill, noted the relevant patterns, and produced code that perfectly matched my conventions and equally conformed to my functional spec requirements, too.

No explanation needed. No correction required. The skill had taught Claude what I would have spent twenty minutes explaining.

**Here's the thing, though:** I didn't write all the skills myself. Take the data schema skill that explains my data structures, which is code to me. I can't tell good from bad. But Claude can. After working on the project for a while, I asked Claude which skills would make it more efficient and help avoid errors across the features I was building. Claude created the skill.

This is the partnership in action. I don't need to know how to document data structures. I need to know what to ask Claude what it needs. Then evaluate whether it's working.

### **The Second Problem: I Kept Repeating Workflows**

Skills solved the consistency problem. But I noticed a new friction: I was doing the identical sequences of tasks over and over.

My friends and coworkers know I have some OCD tendencies. Keeping things organized and orderly comes naturally to me. Making sure processes are followed is just second nature – just ask my team members who use my Jira automations that build out all the necessary tasks for a product marketer to lead a product launch.

I found Claude **commands** essentially do this for me.

To push an update of my app, I started to understand the steps required:

1. Pre-flight checks—make sure my working directory is clean, I'm on the right branch, and the code actually builds  
2. Figure out the version number—is this a bug fix (patch), new feature (minor), or breaking change (major)?  
3. Write the changelog entry—in the right voice, with the right details  
4. Update all the files that contain version info—package.json, the README "What's New" section, the roadmap, and my context files  
5. Move any completed specs from the "future" folder to "implemented"  
6. Validate that everything matches—versions in sync, no errors  
7. Git commit, tag, and push

That's seven steps, each with substeps, each easy to forget. And that last one? I never set up a repository myself, using Claude Code introduced me to the *need* for version tracking, reviewing past work, and rolling back mistakes.

Before commands, I'd miss something every time. Version numbers wouldn't match across files. Changelog entries would be in the wrong voice. Specs wouldn't get moved. This made my OCD twitch.

My `/release` command encodes everything. I type `/release`, answer a few prompts, and Claude orchestrates everything with checkpoints for my review. The command even references other documentation, such as voice guidelines for the changelog and validation rules, rather than duplicating that information.

When I notice myself doing something repeatedly, I document the steps and ask Claude to help refine it. The repetition becomes a command. Instant automation.

### **The Third Problem: The Writing Was Inconsistent**

Code was now consistent. Workflows were automated. But I noticed something else: the writing didn't sound right.

Did I need to solve for this for my vacation project? Of course not. But that OCD crept in again. Changelog entries sounded like technical documentation. The README sounded like a spec. Everything had that flat, AI-assistant tone that didn't match my project's personality.

The same project needs different voices depending on the intended audience, purpose, and deliverable. Changelog entries should feel warm and benefit-focused – they're for people exploring their concert memories. Technical docs should feel practical and humble – I'm not claiming engineering expertise I don't have.

That's when I discovered **voice guidelines**.

Voice guidelines teach Claude to write in different tones for different audiences. In a single release, Claude now writes:

* Changelog entry (product marketer voice): "Trace connections between artists and the venues where you've seen them"  
* Git commit (conventional): "release: v3.4.0 \- Map & Venue Navigation Polish"  
* README update (inviting): "**v3.4.0 is live\!** Explore how artists connect through the venues you've visited"

Same information, appropriate voice for each audience. The writing finally sounds like it should.

### **The Underlying Problem: Sessions Degraded**

There was one more friction point, and it took me longer to understand.

Early on, Claude would start "going off the rails." Forgetting conventions. Making inconsistent choices. Requiring re-explanation. Even later in the project, once I had skills in place.

The issue wasn't Claude forgetting. It was that Claude Code sessions have finite context windows. Long conversations degrade. The skills were there, but the session had lost track of them.

That's when I got savvier about **context management**—designing work around session limits rather than fighting them.

I now structure work into units that can be completed in single sessions. Specifications include "establishing prompts" – copy-paste blocks that can bootstrap a fresh session with everything needed to continue. When context runs low, I start fresh with a clean context rather than pushing through with degraded quality.

Skills, commands, voice guidelines, context management – they're not separate features. They're a system. Each one solved a friction point that revealed the next.

## **The Meta-Level**

Here's where it gets interesting.

I started asking Claude to evaluate my own work:

* "Look at my recent commits. Are there patterns that should become a skill?"  
* "Review this command. Are any steps missing?"  
* "Is this documentation still accurate?"

Claude has suggested skills I hadn't considered. Identified gaps in commands. Caught stale documentation. The system improves itself.

This is the real unlock. Not just using Claude to execute, but using Claude to improve how we work together. The collaboration infrastructure evolves through collaboration.

## **What I've Learned**

**The name is wrong.** "Claude Code" suggests a code writer. But code is just the output. Claude provides a collaboration partner. One that can absorb your standards, automate your workflows, adapt to your voice, and help you think through problems.

**You don't need to read code.** You need to evaluate outcomes. If you can answer "does it work, does it look right, does it sound right?" – you can build software with Claude. OK, to be fair, at least the software I developed. I am sure engineering friends out there will have a view on this one.

**Explicitness is everything.** Vague inputs produce vague outputs. The investment in documenting exactly what you want—colors, dimensions, voice, behavior—pays dividends across every session.

**Document, ask, lock, execute.** This rhythm changed everything. Document the outcome. Ask Claude for suggestions. Lock down the spec. Execute. It keeps Claude on track and keeps you in control.

**The system improves itself.** Ask Claude to evaluate your patterns. Let problems become documentation. Build infrastructure that compounds.

## **The Real Point**

I've invested about 30 hours into this project, and counting. If you'd like to see what my Google Sheet of concerts evolved into, visit [concerts.morperhaus.org](https://concerts.morperhaus.org/). I'm proud of what I've accomplished.

But more importantly, this project has made me think twice about how I work.

You don't need to read code. You need to evaluate outcomes. Does it work? Does it look right? Does it sound right? If you can answer those questions, you can build with Claude. The "superpowers" aren't magic; they're just infrastructure for being explicit about what you want. And that's a skill anyone can learn.

Based on this experience, I'm already rearchitecting how I approach my marketing tasks. I can create skills, commands, and voice guidelines to help my whole team work more efficiently. Scale out our execution. Codify our best practices so they're not trapped in people's heads.

Who would have thought a product called "Claude Code" would be such a tool for marketers? Stay tuned for what comes next…