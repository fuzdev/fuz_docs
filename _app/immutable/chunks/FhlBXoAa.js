import{$ as e,J as t,M as n,P as r,_t as i,d as a,dt as o,et as s,ft as c,gt as l,nt as u}from"./Bqh8G2yR.js";import{t as d}from"./Cyt8LZpN.js";import"./BPVwp-J3.js";import{n as f}from"./rNUG4KSH.js";import{t as p}from"./qSSedoOV.js";import{t as m}from"./Bj9rU2_z.js";import{n as h,t as g}from"./BluinNKM.js";import{t as _}from"./D5dimfHS.js";var v=r(`<!> <p>Units of work often cut across repos — a type change ripples through three packages, a new
			feature needs coordinated planning in four. A grimoire gives those units a home without
			polluting implementation repos with planning artifacts. It's a markdown meta-repo that holds
			working understanding: what was decided and why, what's next, what connects to what.</p> <p>For AI agents, a grimoire is persistent memory across stateless sessions. Each agent arrives
			fresh, reads the grimoire to orient, does work, and updates it before the session ends. The
			grimoire bridges what one session learned to the next.</p> <p>The full skill documentation is at <a><code>skills/grimoire</code></a>.</p>`,1),y=r(`<!> <p>Three core primitives, plus supporting layers that emerge as the grimoire grows:</p> <table><thead><tr><th>Primitive</th><th>Location</th><th>Purpose</th></tr></thead><tbody><tr><td>Lore</td><td><code>lore/&#123;project&#125;/</code></td><td>Per-repo planning projections — decisions, TODOs, cross-cutting concerns. Standard pair: <code>CLAUDE.md</code> + <code>TODO.md</code></td></tr><tr><td>Quests</td><td><code>quests/</code></td><td>Cross-repo goals with dependencies and completion criteria. Single-repo work stays in
						lore TODOs</td></tr><tr><td>Skills</td><td><code>skills/&#123;name&#125;/</code></td><td><a href="https://agentskills.io/">Agent skill</a> knowledge files — conventions,
						references, and tooling scripts</td></tr></tbody></table> <!> <p><code>writing/</code> holds ideas that span the whole ecosystem rather than projecting a
			single repo — design philosophies, conceptual foundations. Supporting directories like <code>scripts/</code> and <code>scries/</code> for experimental linting may emerge from need;
			a new grimoire starts with just <code>lore/</code> and grows.</p>`,1),b=r(`<!> <p>Each agent session reads the grimoire to orient, does the work, then writes back what changed.</p> <table><thead><tr><th>Phase</th><th>Action</th></tr></thead><tbody><tr><td>Orient</td><td>Read <code>lore/&#123;project&#125;/</code> for planning context and TODOs. Check <code>quests/</code> for cross-repo goals touching this project. Read the repo's own <code>CLAUDE.md</code> for implementation context.</td></tr><tr><td>Work</td><td>Do the implementation work in the target repo.</td></tr><tr><td>Update</td><td>Update <code>TODO.md</code> for work items. Check off quest tasks. Update <code>CLAUDE.md</code> if decisions changed.</td></tr><tr><td>Graduate</td><td>Should content advance? Done quests synthesize into lore, then get deleted. Ideas that
						matured into code get removed from TODOs.</td></tr></tbody></table>`,1),x=r(`<!> <p>Content flows forward through stages and gets deleted from earlier ones when it graduates —
			existing in one place at a time, wherever it's most useful right now.</p> <!> <p>The cycle turns at different speeds — ideas accumulate slowly in lore, quests can move fast
			through implementation.</p>`,1),S=r(`<!> <p><strong>Taste.</strong> A grimoire encodes a developer's preferences — which patterns are
			valued, which tradeoffs are preferred, what "good" looks like. This is what makes a grimoire <em>yours</em> rather than generic documentation. Agents can apply taste fluidly rather than
			following rigid rules.</p> <p><strong>Always slightly wrong.</strong> A grimoire is approximate context, not ground truth.
			It's trying to capture dimensions of a person's entire body of work — too large for any
			document to represent faithfully. When current state matters, read the actual repo. Past a
			certain threshold of staleness, a doc misleads more than it helps.</p> <p><strong>Rewrite, don't just prune.</strong> Conceptual staleness — content whose framing no
			longer matches reality — is more dangerous than old files. A lore doc untouched for months can
			still be accurate; a freshly-written TODO that assumes yesterday's architecture misleads
			immediately. Delete what's dead, rewrite what's drifted. The grimoire stays useful by staying <em>accurate</em>, not just lean.</p> <p><strong>Growth trajectory.</strong> A grimoire starts small — one <code>CLAUDE.md</code>, a
			couple of <code>TODO.md</code> files. Quests appear when work first spans multiple repos.
			Writing appears when ideas emerge that don't project any single repo. Don't build structure
			speculatively.</p>`,1),C=r(`<!> <p>For full conventions — lore structure, quest format, creating new artifacts, common pitfalls —
			see the <a>grimoire skill</a>. For coding
			conventions across the <code>@fuzdev</code> ecosystem, see <!>.</p>`,1),w=r(`<!> <!> <!> <!> <!> <!>`,1);function T(r,T){c(T,!0);let E=f(`grimoire`);m(r,{get tome(){return E},children:(r,o)=>{var c=w(),f=s(c);h(f,{children:(r,o)=>{var c=v(),f=s(c);g(f,{text:`Overview`});var p=u(f,6),m=u(e(p));l(),i(p),t(e=>a(m,`href`,e),[()=>d(`/skills/grimoire`)]),n(r,c)},$$slots:{default:!0}});var m=u(f,2);h(m,{children:(e,t)=>{var r=y(),i=s(r);g(i,{text:`Structure`});var a=u(i,6);_(a,{dangerous_raw_html:`grimoire/
├── lore/           # per-repo planning projections
│   └── <span class="token_svelte_expression"><span class="token_punctuation">{</span><span class="token_lang_ts">project</span><span class="token_punctuation">}</span></span>/
│       ├── CLAUDE.md    # planning context, decisions
│       └── TODO.md      # active work items
├── quests/         # cross-repo goals
│   ├── CLAUDE.md        # quest index
│   └── <span class="token_svelte_expression"><span class="token_punctuation">{</span><span class="token_lang_ts">slug</span><span class="token_punctuation">}</span></span>.md        # individual quests
├── skills/         # agent knowledge modules
│   └── <span class="token_svelte_expression"><span class="token_punctuation">{</span><span class="token_lang_ts">name</span><span class="token_punctuation">}</span></span>/
│       └── SKILL.md
└── writing/        # philosophy and vision (not repo-scoped)`}),l(2),n(e,r)},$$slots:{default:!0}});var T=u(m,2);h(T,{children:(e,t)=>{var r=b(),i=s(r);g(i,{text:`Work loop`}),l(4),n(e,r)},$$slots:{default:!0}});var E=u(T,2);h(E,{children:(e,t)=>{var r=x(),i=s(r);g(i,{text:`Knowledge lifecycle`});var a=u(i,4);_(a,{content:`lore → quest → implementation → published → lore
 (ideas)  (goals)    (code)        (docs)     (new understanding)`}),l(2),n(e,r)},$$slots:{default:!0}});var D=u(E,2);h(D,{children:(e,t)=>{var r=S(),i=s(r);g(i,{text:`Key ideas`}),l(8),n(e,r)},$$slots:{default:!0}});var O=u(D,2);h(O,{children:(r,o)=>{var c=C(),f=s(c);g(f,{text:`More`});var m=u(f,2),h=u(e(m)),_=u(h,4);p(_,{slug:`fuz-stack`}),l(),i(m),t(e=>a(h,`href`,e),[()=>d(`/skills/grimoire`)]),n(r,c)},$$slots:{default:!0}}),n(r,c)},$$slots:{default:!0}}),o()}export{T as t};