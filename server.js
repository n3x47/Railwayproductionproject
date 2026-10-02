import express from "express";
import Stripe from "stripe";
import { Resend } from "resend";
import crypto from "crypto";
import fs from "fs";
import path from "path";

const app=express();
const PORT=process.env.PORT||3000;
const stripe=process.env.STRIPE_SECRET_KEY?new Stripe(process.env.STRIPE_SECRET_KEY):null;
const resend=process.env.RESEND_API_KEY?new Resend(process.env.RESEND_API_KEY):null;
const productFile=process.env.PRODUCT_DOWNLOAD_URL||"";

app.use("/webhook", express.raw({type:"application/json"}));
app.use(express.json());
app.use(express.static("public"));

const leads=new Map();
const events=[];

function track(type,data={}) {
  events.push({id:crypto.randomUUID(),type,at:new Date().toISOString(),data});
  if(events.length>5000) events.shift();
}

app.get("/health",(req,res)=>res.json({ok:true,service:"launchkit"}));

app.get("/download",(req,res)=>{
  const zipPath=path.join(process.cwd(),"launchkit-production.zip");
  if(!fs.existsSync(zipPath)) return res.status(404).json({error:"Product file not found"});
  res.download(zipPath,"launchkit-production.zip");
});

app.post("/api/leads", async (req,res)=>{
  const email=String(req.body?.email||"").trim().toLowerCase();
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({error:"Invalid email"});
  leads.set(email,{email,createdAt:new Date().toISOString()});
  track("lead_captured",{email});
  if(resend && process.env.FROM_EMAIL){
    await resend.emails.send({from:process.env.FROM_EMAIL,to:email,subject:"Your LaunchKit resources",html:`<h2>You're in.</h2><p>Thanks for joining LaunchKit. We'll send useful launch resources and occasional product updates.</p>`}).catch(()=>{});
  }
  res.json({ok:true});
});

app.post("/webhook",async(req,res)=>{
  if(!stripe) return res.status(503).send("Stripe not configured");
  let event;
  try {
    event=stripe.webhooks.constructEvent(req.body,req.headers["stripe-signature"],process.env.STRIPE_WEBHOOK_SECRET);
  } catch(e){ return res.status(400).send(`Webhook Error: ${e.message}`); }
  track("stripe_event",{type:event.type});
  if(event.type==="checkout.session.completed"){
    const s=event.data.object;
    const email=s.customer_details?.email;
    if(email && resend && process.env.FROM_EMAIL){
      const download=productFile || "#";
      await resend.emails.send({
        from:process.env.FROM_EMAIL,to:email,subject:"Your LaunchKit download",
        html:`<h1>Thanks for your purchase.</h1><p>Your LaunchKit is ready.</p><p><a href="${download}">Download LaunchKit</a></p><p>If you need help, reply to this email.</p>`
      }).catch(()=>{});
      track("delivery_email_sent",{email});
    }
  }
  res.json({received:true});
});

app.get("/api/analytics",(req,res)=>{
  const counts={};
  for(const e of events) counts[e.type]=(counts[e.type]||0)+1;
  res.json({events:events.slice(-100),counts,leads:leads.size});
});

app.get("/api/cron/content",async(req,res)=>{
  const secret=req.headers["x-cron-secret"];
  if(!process.env.CRON_SECRET || secret!==process.env.CRON_SECRET) return res.status(401).json({error:"Unauthorized"});
  // This endpoint is intentionally provider-agnostic: connect it to your social/email
  // scheduler rather than pretending to publish to accounts without authorization.
  track("content_cycle",{action:"content-cycle-triggered"});
  res.json({ok:true,message:"Content cycle triggered; connect your authorized publishing provider."});
});

app.listen(PORT,()=>console.log(`LaunchKit running on ${PORT}`));

