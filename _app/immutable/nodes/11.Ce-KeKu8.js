import"../chunks/DsnmJJEf.js";import{p as L,c as q,f as i,a,s as o,d as k,t as y,b as n,ap as d,r as $}from"../chunks/Bl9Qqa7N.js";import{s as T}from"../chunks/CLGo5n5t.js";import{r as x}from"../chunks/Bt8mpV8T.js";import{C as b}from"../chunks/CQ-HaRZI.js";import{T as U}from"../chunks/BMu6GtZn.js";import{T as l,a as c}from"../chunks/CG93bdJg.js";import{T as S}from"../chunks/x3D2R3TR.js";import{g as E}from"../chunks/Cdsbb3iz.js";var I=i(`<!> <p>Units of work often cut across repos — a type change ripples through three packages, a new
			feature needs coordinated planning in four. A grimoire gives those units a home without
			polluting implementation repos with planning artifacts. It's a markdown meta-repo that holds
			working understanding: what was decided and why, what's next, what connects to what.</p> <p>For AI agents, a grimoire is persistent memory across stateless sessions. Each agent arrives
			fresh, reads the grimoire to orient, does work, and updates it before the session ends. The
			grimoire bridges what one session learned to the next.</p> <p>The full skill documentation is at <a><code>skills/grimoire</code></a>.</p>`,1),W=i(`<!> <p>Three core primitives, plus supporting layers that emerge as the grimoire grows:</p> <table><thead><tr><th>Primitive</th><th>Location</th><th>Purpose</th></tr></thead><tbody><tr><td>Lore</td><td><code>lore/&#123;project&#125;/</code></td><td>Per-repo planning projections — decisions, TODOs, cross-cutting concerns. Standard
						pair: <code>CLAUDE.md</code> + <code>TODO.md</code></td></tr><tr><td>Quests</td><td><code>quests/</code></td><td>Cross-repo goals with dependencies and completion criteria. Single-repo work stays in
						lore TODOs</td></tr><tr><td>Skills</td><td><code>skills/&#123;name&#125;/</code></td><td><a href="https://agentskills.io/">Agent skill</a> knowledge files — conventions, references,
						and tooling scripts</td></tr></tbody></table> <!> <p><code>writing/</code> holds ideas that span the whole ecosystem rather than projecting a
			single repo — design philosophies, conceptual foundations. Supporting directories like <code>scripts/</code> and <code>scries/</code> for experimental linting may emerge from need;
			a new grimoire starts with just <code>lore/</code> and grows.</p>`,1),z=i(`<!> <p>Each agent session reads the grimoire to orient, does the work, then writes back what changed.</p> <table><thead><tr><th>Phase</th><th>Action</th></tr></thead><tbody><tr><td>Orient</td><td>Read <code>lore/&#123;project&#125;/</code> for planning context and TODOs. Check <code>quests/</code> for cross-repo goals touching this project. Read the repo's own <code>CLAUDE.md</code> for implementation context.</td></tr><tr><td>Work</td><td>Do the implementation work in the target repo.</td></tr><tr><td>Update</td><td>Update <code>TODO.md</code> for work items. Check off quest tasks. Update <code>CLAUDE.md</code> if decisions changed.</td></tr><tr><td>Graduate</td><td>Should content advance? Done quests synthesize into lore, then get deleted. Ideas that
						matured into code get removed from TODOs.</td></tr></tbody></table>`,1),F=i(`<!> <p>Content flows forward through stages and gets deleted from earlier ones when it graduates —
			existing in one place at a time, wherever it's most useful right now.</p> <!> <p>The cycle turns at different speeds — ideas accumulate slowly in lore, quests can move fast
			through implementation — but content should exist in one place at a time, wherever it's most
			useful right now.</p>`,1),K=i(`<!> <p><strong>Taste.</strong> A grimoire encodes a developer's preferences — which patterns are
			valued, which tradeoffs are preferred, what "good" looks like. This is what makes a grimoire <em>yours</em> rather than generic documentation. Agents can apply taste fluidly rather than following
			rigid rules.</p> <p><strong>Always slightly wrong.</strong> A grimoire is approximate context, not ground truth. It's
			trying to capture dimensions of a person's entire body of work — too large for any document to represent
			faithfully. When current state matters, read the actual repo. Past a certain threshold of staleness,
			a doc misleads more than it helps.</p> <p><strong>Rewrite, don't just prune.</strong> Conceptual staleness — content whose framing no
			longer matches reality — is more dangerous than old files. A lore doc untouched for months can
			still be accurate; a freshly-written TODO that assumes yesterday's architecture misleads
			immediately. Delete what's dead, rewrite what's drifted. The grimoire stays useful by staying <em>accurate</em>, not just lean.</p> <p><strong>Growth trajectory.</strong> A grimoire starts small — one <code>CLAUDE.md</code>, a
			couple of <code>TODO.md</code> files. Quests appear when work first spans multiple repos. Writing
			appears when ideas emerge that don't project any single repo. Don't build structure speculatively.</p>`,1),R=i(`<!> <p>For full conventions — lore structure, quest format, creating new artifacts, common pitfalls —
			see the <a>grimoire skill</a>. For coding conventions across
			the <code>@fuzdev</code> ecosystem, see <!>.</p>`,1),G=i("<!> <!> <!> <!> <!> <!>",1);function ee(O,D){L(D,!0);const A=E("grimoire");U(O,{get tome(){return A},children:(C,Q)=>{var u=G(),g=a(u);l(g,{children:(s,p)=>{var e=I(),t=a(e);c(t,{text:"Overview"});var r=o(t,6),h=o(k(r));d(),$(r),y(m=>T(h,"href",m),[()=>x("/skills/grimoire")]),n(s,e)},$$slots:{default:!0}});var f=o(g,2);l(f,{children:(s,p)=>{var e=W(),t=a(e);c(t,{text:"Structure"});var r=o(t,6);b(r,{dangerous_raw_html:`grimoire/
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
└── writing/        # philosophy and vision (not repo-scoped)`}),d(2),n(s,e)},$$slots:{default:!0}});var w=o(f,2);l(w,{children:(s,p)=>{var e=z(),t=a(e);c(t,{text:"Work loop"}),d(4),n(s,e)},$$slots:{default:!0}});var v=o(w,2);l(v,{children:(s,p)=>{var e=F(),t=a(e);c(t,{text:"Knowledge lifecycle"});var r=o(t,4);b(r,{content:`lore → quest → implementation → published → lore
 (ideas)  (goals)    (code)        (docs)     (new understanding)`}),d(2),n(s,e)},$$slots:{default:!0}});var _=o(v,2);l(_,{children:(s,p)=>{var e=K(),t=a(e);c(t,{text:"Key ideas"}),d(8),n(s,e)},$$slots:{default:!0}});var j=o(_,2);l(j,{children:(s,p)=>{var e=R(),t=a(e);c(t,{text:"More"});var r=o(t,2),h=o(k(r)),m=o(h,4);S(m,{name:"fuz-stack"}),d(),$(r),y(P=>T(h,"href",P),[()=>x("/skills/grimoire")]),n(s,e)},$$slots:{default:!0}}),n(C,u)},$$slots:{default:!0}}),q()}export{ee as component};
