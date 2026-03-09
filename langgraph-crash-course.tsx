import { useState } from "react";

const modules = [
  {
    id: 0,
    time: "0–5 min",
    title: "What is LangGraph?",
    color: "#6366f1",
    theory: `LangGraph is a library for building **stateful, multi-step AI applications** using a graph-based architecture. It's built on top of LangChain.

**Core idea:** Instead of a linear chain (A → B → C), you model your AI logic as a **directed graph** where:
- **Nodes** = functions / LLM calls / tools
- **Edges** = transitions between nodes (can be conditional)
- **State** = shared data that flows through the graph

**Why LangGraph over plain LangChain?**
| LangChain | LangGraph |
|---|---|
| Linear chains | Cycles & loops |
| Hard to branch | Conditional edges |
| No built-in state | Typed state schema |
| Hard to add human-in-the-loop | Built-in interrupts |`,
    code: `# Install
pip install langgraph langchain-openai

# The mental model
#
#   [START]
#      |
#   [node_a]  ← does something, updates state
#      |
#   [node_b]  ← reads state, does more work
#      |
#   [END]
#
# State flows like a baton through the graph.
# Each node receives state, returns updates to state.`,
    diagram: {
      nodes: ["START", "node_a", "node_b", "END"],
      edges: [["START","node_a"],["node_a","node_b"],["node_b","END"]],
      conditional: []
    }
  },
  {
    id: 1,
    time: "5–12 min",
    title: "Your First Graph",
    color: "#0ea5e9",
    theory: `Every LangGraph app has 3 ingredients:

1. **State** — a TypedDict that defines what data is shared across nodes
2. **Nodes** — plain Python functions \`(state) → dict\`
3. **Graph** — wires everything together with \`StateGraph\`

The node function always returns a **partial update** to the state — you only return the keys you want to change.`,
    code: `from typing import TypedDict
from langgraph.graph import StateGraph, START, END

# 1. Define State
class State(TypedDict):
    messages: list[str]
    count: int

# 2. Define Nodes (functions that receive + update state)
def greet(state: State) -> dict:
    msg = f"Hello! You are visitor #{state['count']}"
    return {"messages": state["messages"] + [msg]}

def farewell(state: State) -> dict:
    msg = "Goodbye!"
    return {"messages": state["messages"] + [msg]}

# 3. Build the Graph
builder = StateGraph(State)
builder.add_node("greet", greet)
builder.add_node("farewell", farewell)

builder.add_edge(START, "greet")
builder.add_edge("greet", "farewell")
builder.add_edge("farewell", END)

graph = builder.compile()

# 4. Run it
result = graph.invoke({"messages": [], "count": 42})
print(result["messages"])
# ["Hello! You are visitor #42", "Goodbye!"]`,
    diagram: {
      nodes: ["START", "greet", "farewell", "END"],
      edges: [["START","greet"],["greet","farewell"],["farewell","END"]],
      conditional: []
    }
  },
  {
    id: 2,
    time: "12–18 min",
    title: "Conditional Edges (Branching)",
    color: "#10b981",
    theory: `The real power of LangGraph is **conditional edges** — the graph decides which node to go to next based on the current state.

You define a **router function** that:
- Takes the current state
- Returns a string (the name of the next node)

Then wire it with \`add_conditional_edges()\`.

This lets you build loops, retries, and decision trees.`,
    code: `from typing import TypedDict, Literal
from langgraph.graph import StateGraph, START, END

class State(TypedDict):
    question: str
    category: str
    answer: str

# Router function — returns the next node name
def classify(state: State) -> dict:
    q = state["question"].lower()
    if "weather" in q:
        return {"category": "weather"}
    elif "math" in q:
        return {"category": "math"}
    else:
        return {"category": "general"}

# The conditional edge function
def route(state: State) -> Literal["weather_node", "math_node", "general_node"]:
    return f"{state['category']}_node"

def weather_node(state: State) -> dict:
    return {"answer": "It's sunny! ☀️"}

def math_node(state: State) -> dict:
    return {"answer": "The answer is 42! 🔢"}

def general_node(state: State) -> dict:
    return {"answer": "Great question! 🤔"}

builder = StateGraph(State)
builder.add_node("classify", classify)
builder.add_node("weather_node", weather_node)
builder.add_node("math_node", math_node)
builder.add_node("general_node", general_node)

builder.add_edge(START, "classify")

# 🔑 Conditional edge: from classify, call route() to decide where to go
builder.add_conditional_edges("classify", route)

builder.add_edge("weather_node", END)
builder.add_edge("math_node", END)
builder.add_edge("general_node", END)

graph = builder.compile()

result = graph.invoke({"question": "What's the weather?", "category": "", "answer": ""})
print(result["answer"])  # "It's sunny! ☀️"`,
    diagram: {
      nodes: ["START", "classify", "weather_node", "math_node", "general_node", "END"],
      edges: [["START","classify"],["weather_node","END"],["math_node","END"],["general_node","END"]],
      conditional: [["classify","weather_node"],["classify","math_node"],["classify","general_node"]]
    }
  },
  {
    id: 3,
    time: "18–24 min",
    title: "Loops & Real LLM Integration",
    color: "#f59e0b",
    theory: `LangGraph shines when you need **loops** — e.g., an agent that keeps trying until it gets a good answer.

The pattern is:
1. LLM generates a response
2. A checker node evaluates it
3. If not good enough → loop back
4. If good → exit

Also: \`add_messages\` is a built-in **reducer** that auto-appends to a message list (instead of replacing it). This is the standard pattern for chat apps.`,
    code: `from typing import Annotated
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, AIMessage
from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages

# add_messages is a reducer: auto-appends instead of replacing
class State(TypedDict):
    messages: Annotated[list, add_messages]
    attempts: int

llm = ChatOpenAI(model="gpt-4o-mini")

def call_llm(state: State) -> dict:
    response = llm.invoke(state["messages"])
    return {
        "messages": [response],  # add_messages appends this
        "attempts": state["attempts"] + 1
    }

def is_good_enough(state: State) -> str:
    last_msg = state["messages"][-1].content
    # Loop if response is too short or too many attempts
    if len(last_msg) < 100 and state["attempts"] < 3:
        return "retry"
    return "done"

def ask_to_elaborate(state: State) -> dict:
    return {"messages": [HumanMessage("Please elaborate more.")]}

builder = StateGraph(State)
builder.add_node("llm", call_llm)
builder.add_node("ask_more", ask_to_elaborate)

builder.add_edge(START, "llm")
builder.add_conditional_edges("llm", is_good_enough, {
    "retry": "ask_more",   # loop back
    "done": END
})
builder.add_edge("ask_more", "llm")  # ← creates the loop

graph = builder.compile()

result = graph.invoke({
    "messages": [HumanMessage("What is LangGraph?")],
    "attempts": 0
})`,
    diagram: {
      nodes: ["START", "llm", "ask_more", "END"],
      edges: [["START","llm"],["ask_more","llm"]],
      conditional: [["llm","ask_more"],["llm","END"]]
    }
  },
  {
    id: 4,
    time: "24–30 min",
    title: "Persistence & Human-in-the-Loop",
    color: "#ec4899",
    theory: `Two killer features that make LangGraph production-ready:

**1. Persistence (Memory)**  
Use a \`checkpointer\` to save graph state between runs. Each run is a "thread" — like a conversation session.

\`MemorySaver\` = in-memory (dev)  
\`SqliteSaver\` / \`PostgresSaver\` = production

**2. Human-in-the-Loop**  
Add \`interrupt_before=["node_name"]\` to pause the graph before a sensitive step. A human can inspect state, modify it, then resume with \`graph.invoke(None, config)\`.

This is perfect for: approval flows, reviewing tool calls, debugging.`,
    code: `from langgraph.graph import StateGraph, START, END
from langgraph.checkpoint.memory import MemorySaver
from typing import TypedDict

class State(TypedDict):
    draft: str
    approved: bool

def write_draft(state: State) -> dict:
    return {"draft": "Here is my draft email: Dear Boss, I quit..."}

def send_email(state: State) -> dict:
    print(f"📧 Sending: {state['draft']}")
    return {}

builder = StateGraph(State)
builder.add_node("write_draft", write_draft)
builder.add_node("send_email", send_email)
builder.add_edge(START, "write_draft")
builder.add_edge("write_draft", "send_email")
builder.add_edge("send_email", END)

# 1. Add checkpointer for persistence
memory = MemorySaver()

# 2. interrupt_before pauses BEFORE send_email runs
graph = builder.compile(
    checkpointer=memory,
    interrupt_before=["send_email"]  # 🛑 pause here!
)

# Each thread_id = a separate session/conversation
config = {"configurable": {"thread_id": "session-1"}}

# Run until interrupt
graph.invoke({"draft": "", "approved": False}, config)

# Inspect state at the pause point
snapshot = graph.get_state(config)
print(snapshot.values["draft"])  # Review the draft

# Optionally update state before resuming
graph.update_state(config, {"draft": "Dear Boss, I need a raise."})

# Resume from where it paused (pass None as input)
graph.invoke(None, config)
# 📧 Sending: Dear Boss, I need a raise.`,
    diagram: {
      nodes: ["START", "write_draft", "🛑 send_email", "END"],
      edges: [["START","write_draft"],["write_draft","🛑 send_email"],["🛑 send_email","END"]],
      conditional: []
    }
  }
];

function GraphDiagram({ diagram }) {
  const { nodes, edges, conditional } = diagram;
  const nodeW = 110, nodeH = 36, gapY = 60;

  const isComplex = nodes.length > 4;

  if (isComplex) {
    // Grid layout for complex graphs
    const grid = {
      "START": [0, 0],
      "classify": [0, 1],
      "weather_node": [-1, 2],
      "math_node": [0, 2],
      "general_node": [1, 2],
      "END": [0, 3],
      // loop graph
      "llm": [0, 1],
      "ask_more": [1, 2],
      // approval
      "write_draft": [0, 1],
      "🛑 send_email": [0, 2],
    };

    const cx = 200, cy = 40;
    const colW = 120;

    const pos = {};
    nodes.forEach(n => {
      const [col, row] = grid[n] || [0, nodes.indexOf(n)];
      pos[n] = { x: cx + col * colW, y: cy + row * gapY };
    });

    const allEdges = [
      ...edges.map(([a, b]) => ({ from: a, to: b, cond: false })),
      ...conditional.map(([a, b]) => ({ from: a, to: b, cond: true }))
    ];

    const svgH = (Math.max(...nodes.map(n => (grid[n]||[0,nodes.indexOf(n)])[1])) + 1) * gapY + 80;

    return (
      <svg width="100%" viewBox={`0 0 400 ${svgH}`} style={{fontFamily:"monospace"}}>
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/>
          </marker>
          <marker id="carrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b"/>
          </marker>
        </defs>
        {allEdges.map(({from, to, cond}, i) => {
          const f = pos[from], t = pos[to];
          if (!f || !t) return null;
          const fx = f.x, fy = f.y + nodeH/2;
          const tx = t.x, ty = t.y - nodeH/2;
          const curved = fx !== tx;
          const d = curved
            ? `M${fx},${fy} C${fx},${fy+30} ${tx},${ty-30} ${tx},${ty}`
            : `M${fx},${fy} L${tx},${ty}`;
          return <path key={i} d={d} stroke={cond?"#f59e0b":"#94a3b8"} strokeWidth="1.5" fill="none" markerEnd={cond?"url(#carrow)":"url(#arrow)"} strokeDasharray={cond?"5,3":""}/>;
        })}
        {nodes.map(n => {
          const {x, y} = pos[n];
          const isStart = n==="START", isEnd = n==="END";
          const fill = isStart||isEnd ? "#1e293b" : n.includes("🛑") ? "#7c3aed" : "#0f172a";
          const stroke = isStart||isEnd ? "#94a3b8" : "#6366f1";
          return (
            <g key={n} transform={`translate(${x - nodeW/2},${y - nodeH/2})`}>
              <rect width={nodeW} height={nodeH} rx={isStart||isEnd?18:6} fill={fill} stroke={stroke} strokeWidth="1.5"/>
              <text x={nodeW/2} y={nodeH/2+1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#e2e8f0">{n}</text>
            </g>
          );
        })}
      </svg>
    );
  }

  // Linear layout
  const svgH = nodes.length * gapY + 40;
  const cx = 150;
  const pos = nodes.reduce((acc, n, i) => { acc[n] = {x: cx, y: 30 + i * gapY}; return acc; }, {});

  const allEdges = [
    ...edges.map(([a,b]) => ({from:a,to:b,cond:false})),
    ...conditional.map(([a,b]) => ({from:a,to:b,cond:true}))
  ];

  return (
    <svg width="100%" viewBox={`0 0 300 ${svgH}`} style={{fontFamily:"monospace"}}>
      <defs>
        <marker id="arr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#94a3b8"/>
        </marker>
        <marker id="carr2" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
          <path d="M0,0 L0,6 L8,3 z" fill="#f59e0b"/>
        </marker>
      </defs>
      {allEdges.map(({from,to,cond},i) => {
        const f = pos[from], t = pos[to];
        if (!f||!t) return null;
        const curved = from==="ask_more" && to==="llm";
        const d = curved
          ? `M${f.x+55},${f.y} C${f.x+100},${f.y} ${t.x+100},${t.y} ${t.x+55},${t.y}`
          : `M${f.x},${f.y+nodeH/2} L${t.x},${t.y-nodeH/2}`;
        return <path key={i} d={d} stroke={cond?"#f59e0b":"#94a3b8"} strokeWidth="1.5" fill="none" markerEnd={cond?"url(#carr2)":"url(#arr2)"} strokeDasharray={cond?"5,3":""}/>;
      })}
      {nodes.map(n => {
        const {x,y} = pos[n];
        const isStart = n==="START", isEnd = n==="END";
        return (
          <g key={n} transform={`translate(${x-nodeW/2},${y-nodeH/2})`}>
            <rect width={nodeW} height={nodeH} rx={isStart||isEnd?18:6}
              fill={n.includes("🛑")?"#4c1d95":isStart||isEnd?"#1e293b":"#0f172a"}
              stroke={n.includes("🛑")?"#a855f7":"#6366f1"} strokeWidth="1.5"/>
            <text x={nodeW/2} y={nodeH/2+1} textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#e2e8f0">{n}</text>
          </g>
        );
      })}
    </svg>
  );
}

export default function App() {
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState("theory");
  const m = modules[active];

  return (
    <div style={{background:"#0f172a", minHeight:"100vh", color:"#e2e8f0", fontFamily:"system-ui, sans-serif", display:"flex", flexDirection:"column"}}>
      {/* Header */}
      <div style={{background:"#1e293b", borderBottom:"1px solid #334155", padding:"16px 24px", display:"flex", alignItems:"center", gap:12}}>
        <div style={{fontSize:22, fontWeight:700, color:"#a5b4fc"}}>⚡ LangGraph</div>
        <div style={{fontSize:14, color:"#64748b"}}>30-Minute Crash Course</div>
        <div style={{marginLeft:"auto", fontSize:13, color:"#64748b"}}>
          Module {active+1} / {modules.length}
        </div>
      </div>

      {/* Module tabs */}
      <div style={{display:"flex", borderBottom:"1px solid #334155", overflowX:"auto"}}>
        {modules.map((mod, i) => (
          <button key={i} onClick={() => { setActive(i); setTab("theory"); }}
            style={{padding:"10px 16px", background:"none", border:"none", cursor:"pointer",
              borderBottom: active===i ? `2px solid ${mod.color}` : "2px solid transparent",
              color: active===i ? mod.color : "#64748b", fontSize:12, whiteSpace:"nowrap",
              fontWeight: active===i ? 600 : 400}}>
            <span style={{marginRight:6}}>{mod.time}</span>
            {mod.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{display:"flex", flex:1, overflow:"hidden", flexWrap:"wrap"}}>
        {/* Left: theory/code tabs */}
        <div style={{flex:"1 1 400px", display:"flex", flexDirection:"column", borderRight:"1px solid #334155"}}>
          {/* Sub-tabs */}
          <div style={{display:"flex", borderBottom:"1px solid #334155"}}>
            {["theory","code"].map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{padding:"8px 20px", background:"none", border:"none", cursor:"pointer",
                  color: tab===t ? m.color : "#64748b",
                  borderBottom: tab===t ? `2px solid ${m.color}` : "2px solid transparent",
                  fontSize:13, fontWeight: tab===t ? 600 : 400, textTransform:"capitalize"}}>
                {t === "theory" ? "📖 Concept" : "💻 Code"}
              </button>
            ))}
          </div>

          <div style={{flex:1, overflow:"auto", padding:"20px"}}>
            {tab === "theory" ? (
              <div style={{lineHeight:1.7, fontSize:14}}>
                <div style={{fontSize:18, fontWeight:700, color: m.color, marginBottom:12}}>
                  {m.title}
                </div>
                {m.theory.split("\n").map((line, i) => {
                  if (line.startsWith("**") && line.endsWith("**")) {
                    return <div key={i} style={{fontWeight:700, color:"#f1f5f9", margin:"12px 0 4px"}}>{line.replace(/\*\*/g,"")}</div>;
                  }
                  if (line.includes("**")) {
                    const parts = line.split(/\*\*(.*?)\*\*/g);
                    return <p key={i} style={{margin:"4px 0", color:"#cbd5e1"}}>
                      {parts.map((p,j) => j%2===1 ? <strong key={j} style={{color:"#f1f5f9"}}>{p}</strong> : p)}
                    </p>;
                  }
                  if (line.startsWith("|")) {
                    const cells = line.split("|").filter(Boolean);
                    const isHeader = i > 0 && m.theory.split("\n")[i-1].startsWith("|");
                    return <div key={i} style={{display:"flex", borderBottom:"1px solid #334155"}}>
                      {cells.map((c,j) => <div key={j} style={{flex:1, padding:"4px 8px", fontSize:12,
                        background: !isHeader && j===0 ? "#1e293b" : "transparent",
                        color: c.includes("---") ? "transparent" : "#cbd5e1"}}>{c.trim()}</div>)}
                    </div>;
                  }
                  if (line.startsWith("- ")) {
                    return <div key={i} style={{margin:"3px 0", paddingLeft:16, color:"#cbd5e1"}}>
                      <span style={{color: m.color}}>›</span> {line.slice(2).replace(/`([^`]+)`/g, (_,c) =>
                        `<code style="background:#1e293b;padding:1px 5px;border-radius:3px;color:#a5b4fc;font-size:12px">${c}</code>`)}
                    </div>;
                  }
                  if (line === "") return <div key={i} style={{height:8}}/>;
                  return <p key={i} style={{margin:"4px 0", color:"#cbd5e1"}}
                    dangerouslySetInnerHTML={{__html: line.replace(/`([^`]+)`/g,
                      (_,c) => `<code style="background:#1e293b;padding:1px 5px;border-radius:3px;color:#a5b4fc;font-size:12px">${c}</code>`)}}
                  />;
                })}
              </div>
            ) : (
              <pre style={{margin:0, fontSize:12, lineHeight:1.6, color:"#a5b4fc", overflowX:"auto",
                background:"#0f172a", padding:0}}>
                <code>{m.code}</code>
              </pre>
            )}
          </div>
        </div>

        {/* Right: diagram */}
        <div style={{flex:"0 0 300px", padding:"20px", display:"flex", flexDirection:"column", gap:16}}>
          <div style={{fontSize:13, fontWeight:600, color:"#64748b", textTransform:"uppercase", letterSpacing:1}}>
            Graph Structure
          </div>
          <div style={{background:"#1e293b", borderRadius:12, padding:16, border:"1px solid #334155"}}>
            <GraphDiagram diagram={m.diagram}/>
          </div>
          <div style={{fontSize:11, color:"#475569", lineHeight:1.6}}>
            <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:4}}>
              <div style={{width:24, height:2, background:"#94a3b8"}}/>
              <span>Normal edge</span>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:6, marginBottom:4}}>
              <div style={{width:24, height:2, background:"#f59e0b", borderTop:"2px dashed #f59e0b"}}/>
              <span>Conditional edge</span>
            </div>
            <div style={{display:"flex", alignItems:"center", gap:6}}>
              <div style={{width:12, height:12, background:"#4c1d95", borderRadius:2, border:"1px solid #a855f7"}}/>
              <span>Interrupt point</span>
            </div>
          </div>

          {/* Progress */}
          <div style={{marginTop:"auto"}}>
            <div style={{fontSize:12, color:"#64748b", marginBottom:8}}>Course Progress</div>
            <div style={{background:"#1e293b", borderRadius:99, height:6, overflow:"hidden"}}>
              <div style={{height:"100%", width:`${((active+1)/modules.length)*100}%`,
                background:`linear-gradient(90deg, #6366f1, ${m.color})`, borderRadius:99,
                transition:"width 0.4s ease"}}/>
            </div>
            <div style={{display:"flex", justifyContent:"space-between", marginTop:12}}>
              <button onClick={() => { if(active>0){setActive(active-1);setTab("theory");}}}
                disabled={active===0}
                style={{padding:"7px 16px", background:"#1e293b", border:"1px solid #334155",
                  borderRadius:6, color: active===0 ? "#475569":"#e2e8f0", cursor: active===0?"not-allowed":"pointer", fontSize:13}}>
                ← Prev
              </button>
              <button onClick={() => { if(active<modules.length-1){setActive(active+1);setTab("theory");}}}
                disabled={active===modules.length-1}
                style={{padding:"7px 16px", background: active===modules.length-1?"#1e293b": m.color,
                  border:"none", borderRadius:6, color:"#fff",
                  cursor: active===modules.length-1?"not-allowed":"pointer", fontSize:13, fontWeight:600}}>
                Next →
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
