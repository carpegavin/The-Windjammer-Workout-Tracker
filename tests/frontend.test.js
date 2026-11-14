const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");
const metrics = require("../public/metrics");
const root = path.join(__dirname, "..", "public");
const script = name => fs.readFileSync(path.join(root, name), "utf8");
const tick = () => new Promise(resolve => setImmediate(resolve));
function exerciseDOM(api) {
  const dom = new JSDOM(script("exercise.html"), { url: "http://localhost/exercise", runScripts: "outside-only" });
  dom.window.WorkoutMetrics = metrics;
  dom.window.API = api;
  dom.window.eval(script("exercise.js"));
  return dom;
}
function fillResistance(window) {
  const document = window.document;
  document.querySelector("#type").value = "resistance";
  document.querySelector("#type").dispatchEvent(new window.Event("change"));
  for (const [id, value] of Object.entries({ name: "Bench press", weight: "100", sets: "3", reps: "10", "resistance-duration": "20" })) {
    document.getElementById(id).value = value;
    document.getElementById(id).dispatchEvent(new window.Event("input"));
  }
}
function submit(window, selector = ".add-another") {
  window.document.querySelector("form").dispatchEvent(new window.SubmitEvent("submit", { bubbles: true, cancelable: true, submitter: window.document.querySelector(selector) }));
}
test("metrics calculate resistance volume and repetitions, not just entered loads", () => {
  assert.deepEqual(metrics.summarize([{type:"resistance",weight:100,sets:3,reps:10,duration:20},{type:"cardio",distance:2.5,duration:30}]), {duration:50,volume:3000,sets:3,repetitions:30,distance:2.5});
});
test("dashboard groups values by the same exercise identity and orders sessions", () => {
  const data = [{_id:"b",day:"2026-02-02",exercises:[{name:"Run",type:"cardio",duration:20},{name:"Bench",type:"resistance",duration:10}]},{_id:"a",day:"2026-02-01",exercises:[{name:"run",type:"cardio",duration:15}]}];
  const result = metrics.dashboard(data);
  assert.deepEqual(result.sessions.map(item=>item._id), ["a","b"]);
  assert.equal(data[0]._id,"b", "input must not be mutated");
  assert.deepEqual(result.exercises, [{name:"run",type:"cardio",count:2,duration:35},{name:"Bench",type:"resistance",count:1,duration:10}]);
});
test("validation rejects blank, negative, fractional, nonfinite, and oversized measurements", () => {
  const valid={type:"resistance",name:"Bench",weight:0,sets:3,reps:10,duration:20};
  assert.equal(metrics.validateExercise(valid), "");
  for (const change of [{name:" "},{duration:0},{weight:-1},{sets:1.5},{reps:Infinity},{duration:1441},{type:"unknown"}]) assert.notEqual(metrics.validateExercise({...valid,...change}), "");
});
test("no record on page visit; first save is atomic, pending clicks blocked, reset cannot save blank", async () => {
  let calls=0, resolveSave;
  const dom=exerciseDOM({createWorkout: exercise => { calls++; assert.equal(exercise.name,"Bench press"); return new Promise(resolve=>{resolveSave=resolve;}); },addExercise:()=>{calls++; throw new Error("unexpected append");}});
  const {window}=dom;
  try {
    assert.equal(calls,0);
    fillResistance(window); assert.equal(window.document.querySelector(".add-another").disabled,false);
    submit(window); submit(window); assert.equal(calls,1); assert.equal(window.document.querySelector(".complete").disabled,true);
    resolveSave({_id:"123456789012345678901234",exercises:[{name:"Bench press"}]}); await tick();
    assert.equal(window.document.querySelector("#name").value,"");
    assert.equal(window.document.querySelector(".add-another").disabled,true);
    assert.equal(window.document.querySelector(".complete").disabled,true);
    submit(window); assert.equal(calls,1);
    assert.equal(new URL(window.location.href).searchParams.get("id"),"123456789012345678901234");
  } finally { window.close(); }
});
test("save failure preserves entries and permits a controlled retry", async () => {
  let calls=0;
  const dom=exerciseDOM({createWorkout:async()=>{calls++; throw new Error("Database unavailable");}});
  const {window}=dom;
  try {
    fillResistance(window); submit(window); await tick();
    assert.equal(calls,1); assert.equal(window.document.querySelector("#name").value,"Bench press");
    assert.equal(window.document.querySelector("#weight").value,"100");
    assert.match(window.document.querySelector("#form-status").textContent,/Database unavailable/);
    assert.equal(window.document.querySelector(".add-another").disabled,false);
  } finally { window.close(); }
});
test("API rejects HTTP failures and unconfirmed save responses", async () => {
  const dom = new JSDOM("", {url:"http://localhost/",runScripts:"outside-only"});
  try {
    dom.window.fetch = async()=>({ok:false,status:404,json:async()=>({error:"Workout not found"})});
    dom.window.eval(script("api.js") + ";window.testAPI=API;");
    await assert.rejects(dom.window.testAPI.addExercise("id",{}),/Workout not found/);
    dom.window.fetch = async()=>({ok:true,status:200,json:async()=>null});
    await assert.rejects(dom.window.testAPI.addExercise("id",{}),/not confirmed as saved/);
  } finally { dom.window.close(); }
});
test("dashboard tables remain available if chart library cannot load", async () => {
  const dom = new JSDOM(script("stats.html"), {url:"http://localhost/stats",runScripts:"outside-only"});
  try {
    dom.window.WorkoutMetrics=metrics;
    dom.window.API={getWorkoutsInRange:async()=>[{_id:"a",day:"2026-02-01",exercises:[{name:"<img src=x onerror=alert(1)>",type:"cardio",duration:10,distance:1}]}]};
    dom.window.eval(script("stats.js")); await tick();
    assert.equal(dom.window.document.querySelector("#dashboard-content").hidden,false);
    assert.equal(dom.window.document.querySelectorAll("#exercise-table tbody tr").length,1);
    assert.equal(dom.window.document.querySelectorAll("#exercise-table img").length,0);
    assert.match(dom.window.document.querySelector("#page-status").textContent,/tables below/);
  } finally { dom.window.close(); }
});
