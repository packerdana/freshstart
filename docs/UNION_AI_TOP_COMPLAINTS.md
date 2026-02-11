# Union-side AI (steward coaching) — Top Complaints → Fast Answer Packs

Goal: carrier asks a question in plain English → AI responds quickly with:
1) What to do next (steps)
2) What to say to management (short script)
3) What to document for the steward (bullet list)
4) Citations (JCAM/Articles/ELM/M-41) — keep behind a “Show citations” section

## Top 10 complaint buckets (from Reddit scan)

### 1) Pay / Contract / TA / arbitration
Common questions:
- “How do I figure my pay / step / backpay?”
- “What happens in arbitration / timeline?”
- “Can local management change pay or steps?”

Answer template:
- Do next:
- Say to mgmt:
- Document:
- Citations:

### 2) Forced OT / staffing / 3996
Common questions:
- “Can they force me on my NS day / mandate OT?”
- “What do I write on a 3996?”
- “They denied my 3996—now what?”
- “Do I have to skip breaks/lunch to make 8?”

### 3) Harassment / discipline / scanner pressure
Common questions:
- “They’re threatening discipline for stationary time.”
- “They told me ‘be back in 8’ no matter what.”
- “Investigative interview—what do I say / steward?”
- “Weingarten rights—when/how?”

### 4) Safety (heat, dogs, threats, vehicles)
Common questions:
- “It’s unsafe/too hot—can I stop?”
- “Dog hazard / customer threat—what forms/steps?”
- “Vehicle unsafe—can I refuse?”

### 5) Grievances / repeats / union process
Common questions:
- “What facts do I need?”
- “What are the timelines?”
- “Management keeps repeating the same violation—how to escalate remedies?”

### 6) Attendance / leave / call-ins
Common questions:
- “They’re disciplining me for attendance—what should I do?”
- “What counts as ‘documentation’ / what should I bring?”
- “What should I say in an II about attendance?”

### 7) Breaks, lunch, comfort stops
Common questions:
- “They told me to skip breaks/lunch to make 8.”
- “They’re questioning my comfort stops.”
- “They’re moving my lunch / messing with my break time.”

### 8) Route inspections / adjustments / undertime pressure
Common questions:
- “They’re pushing undertime / pivots every day.”
- “They did an inspection / 3999 / walk and now they’re changing my route.”
- “They’re using scanner data to ‘prove’ my times.”

### 9) Hold-downs, bidding, OT list / assignment rules
Common questions:
- “How do hold-downs work?”
- “Am I being forced incorrectly off my assignment / rotation?”
- “ODL / non-ODL equity—who should be getting the OT?”

### 10) Uniforms, equipment, and vehicle issues
Common questions:
- “My uniform allowance / voucher is late.”
- “They won’t replace broken gear / satchel / shoes.”
- “Vehicle is unsafe / no heat / no AC / bald tires—what do I do?”

## Output format (recommended)

**Quick answer** (2–5 bullets)

**What to say to management** (short script)

**What to document for the steward**
- date/time
- who said what
- what instruction
- what you did
- witnesses
- photos/screenshots

**Citations**
- JCAM/Articles/ELM/M-41 pointers

## Next build steps
1) Decide the citation set priority (JCAM+Articles first; add ELM/M-41 as needed).
2) Implement prompt + retrieval index in `supabase/functions/assistant-chat`.
3) Add a “Show citations” toggle so carriers get action-first answers.
